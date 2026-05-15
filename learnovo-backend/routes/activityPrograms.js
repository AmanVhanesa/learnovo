const express = require('express');
const { body, param, query } = require('express-validator');
const ActivityProgram = require('../models/ActivityProgram');
const ActivityEnrollment = require('../models/ActivityEnrollment');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const planGate = require('../middleware/planGate');
const { handleValidationErrors } = require('../middleware/validation');
const upload = require('../middleware/upload');
const cloudinaryService = require('../services/cloudinaryService');

const router = express.Router();

const readGates = [protect, planGate.requireActiveSubscription, planGate.checkFeesAndFinance];
const writeGates = [...readGates, authorize('admin', 'accountant')];

const CATEGORIES = ['Sports', 'Music', 'Dance', 'Arts', 'Academic', 'Other'];

// ─── GET /api/activity-programs ────────────────────────────────────────
router.get('/', readGates, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('search').optional().trim().isLength({ max: 100 }),
  query('category').optional().isIn(CATEGORIES),
  query('status').optional().isIn(['active', 'inactive', 'all']),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = { tenantId: req.user.tenantId };
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.status === 'active') filter.isActive = true;
    else if (req.query.status === 'inactive') filter.isActive = false;

    const [programs, total] = await Promise.all([
      ActivityProgram.find(filter)
        .populate('instructor', 'name email phone')
        .sort({ isActive: -1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityProgram.countDocuments(filter)
    ]);

    // Annotate each program with active enrollment count.
    const programIds = programs.map(p => p._id);
    let countsByProgram = {};
    if (programIds.length > 0) {
      const counts = await ActivityEnrollment.aggregate([
        { $match: { tenantId: req.user.tenantId, activityProgram: { $in: programIds }, status: 'active' } },
        { $group: { _id: '$activityProgram', count: { $sum: 1 } } }
      ]);
      countsByProgram = counts.reduce((acc, c) => {
        acc[String(c._id)] = c.count; return acc;
      }, {});
    }

    const enriched = programs.map(p => ({
      ...p,
      enrollmentCount: countsByProgram[String(p._id)] || 0
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: {
        page, limit, total,
        pages: Math.ceil(total / limit)
      },
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/activity-programs/:id ────────────────────────────────────
router.get('/:id', readGates, [
  param('id').isMongoId().withMessage('Invalid program ID'),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const program = await ActivityProgram.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    }).populate('instructor', 'name email phone').lean();

    if (!program) {
      return res.status(404).json({ success: false, message: 'Activity not found', requestId: req.requestId });
    }

    const enrollmentCount = await ActivityEnrollment.countDocuments({
      tenantId: req.user.tenantId,
      activityProgram: program._id,
      status: 'active'
    });

    res.json({
      success: true,
      data: { ...program, enrollmentCount },
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/activity-programs ───────────────────────────────────────
router.post('/', writeGates, [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 120 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('category').optional().isIn(CATEGORIES),
  body('monthlyFee').isFloat({ min: 0 }).withMessage('Monthly fee must be 0 or greater'),
  body('instructor').optional({ nullable: true, checkFalsy: true }).isMongoId(),
  body('schedule').optional().trim().isLength({ max: 200 }),
  body('capacity').optional().isInt({ min: 0 }),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    if (req.body.instructor) {
      const teacher = await User.findOne({
        _id: req.body.instructor,
        tenantId,
        isActive: true,
        role: { $in: ['teacher', 'admin', 'principal', 'vice_principal'] }
      }).select('_id').lean();
      if (!teacher) {
        return res.status(400).json({
          success: false,
          message: 'Selected instructor is not a valid active staff member',
          requestId: req.requestId
        });
      }
    }

    const program = await ActivityProgram.create({
      tenantId,
      name: req.body.name,
      description: req.body.description,
      category: req.body.category || 'Other',
      monthlyFee: req.body.monthlyFee,
      instructor: req.body.instructor || null,
      schedule: req.body.schedule,
      capacity: req.body.capacity || 0,
      createdBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Activity created',
      data: program,
      requestId: req.requestId
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An activity with this name already exists',
        requestId: req.requestId
      });
    }
    next(err);
  }
});

// ─── PUT /api/activity-programs/:id ────────────────────────────────────
router.put('/:id', writeGates, [
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty().isLength({ max: 120 }),
  body('description').optional().trim().isLength({ max: 1000 }),
  body('category').optional().isIn(CATEGORIES),
  body('monthlyFee').optional().isFloat({ min: 0 }),
  body('instructor').optional({ nullable: true, checkFalsy: true }).isMongoId(),
  body('schedule').optional().trim().isLength({ max: 200 }),
  body('capacity').optional().isInt({ min: 0 }),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const program = await ActivityProgram.findOne({ _id: req.params.id, tenantId });
    if (!program) {
      return res.status(404).json({ success: false, message: 'Activity not found', requestId: req.requestId });
    }

    if (req.body.instructor) {
      const teacher = await User.findOne({
        _id: req.body.instructor,
        tenantId,
        isActive: true,
        role: { $in: ['teacher', 'admin', 'principal', 'vice_principal'] }
      }).select('_id').lean();
      if (!teacher) {
        return res.status(400).json({
          success: false,
          message: 'Selected instructor is not a valid active staff member',
          requestId: req.requestId
        });
      }
    }

    const fields = ['name', 'description', 'category', 'monthlyFee', 'schedule', 'capacity'];
    for (const f of fields) {
      if (req.body[f] !== undefined) program[f] = req.body[f];
    }
    if (req.body.instructor !== undefined) {
      program.instructor = req.body.instructor || null;
    }
    program.updatedBy = req.user._id;
    await program.save();

    res.json({ success: true, message: 'Activity updated', data: program, requestId: req.requestId });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An activity with this name already exists',
        requestId: req.requestId
      });
    }
    next(err);
  }
});

// ─── PATCH /api/activity-programs/:id/toggle ───────────────────────────
router.patch('/:id/toggle', writeGates, [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const program = await ActivityProgram.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });
    if (!program) {
      return res.status(404).json({ success: false, message: 'Activity not found', requestId: req.requestId });
    }
    program.isActive = !program.isActive;
    program.updatedBy = req.user._id;
    await program.save();
    res.json({ success: true, message: `Activity ${program.isActive ? 'activated' : 'deactivated'}`, data: program, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/activity-programs/:id ─────────────────────────────────
// Refuses to delete if any active enrollments remain — admin must withdraw them first.
router.delete('/:id', writeGates, [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const program = await ActivityProgram.findOne({ _id: req.params.id, tenantId });
    if (!program) {
      return res.status(404).json({ success: false, message: 'Activity not found', requestId: req.requestId });
    }

    const activeEnrollments = await ActivityEnrollment.countDocuments({
      tenantId,
      activityProgram: program._id,
      status: 'active'
    });

    if (activeEnrollments > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete — ${activeEnrollments} student(s) are still enrolled. Withdraw them first or deactivate the activity instead.`,
        requestId: req.requestId
      });
    }

    await ActivityProgram.deleteOne({ _id: program._id });
    res.json({ success: true, message: 'Activity deleted', requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/activity-programs/:id/photo ─────────────────────────────
router.post('/:id/photo', writeGates,
  upload.single('photo'),
  [param('id').isMongoId(), handleValidationErrors],
  async(req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No photo provided', requestId: req.requestId });
      }
      const tenantId = req.user.tenantId;
      const program = await ActivityProgram.findOne({ _id: req.params.id, tenantId });
      if (!program) {
        return res.status(404).json({ success: false, message: 'Activity not found', requestId: req.requestId });
      }

      const uploaded = await cloudinaryService.uploadFromMulter(req.file, {
        tenantId,
        folder: 'activity-programs',
        subPath: `${program._id}/photos`,
        transformation: { width: 1000, height: 1000, crop: 'fit', quality: 'auto:good' }
      });

      program.photo = uploaded.secure_url;
      program.updatedBy = req.user._id;
      await program.save();

      res.json({ success: true, message: 'Photo uploaded', data: { photo: program.photo }, requestId: req.requestId });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/activity-programs/:id/enrollments ────────────────────────
router.get('/:id/enrollments', readGates, [
  param('id').isMongoId(),
  query('status').optional().isIn(['active', 'paused', 'completed', 'cancelled', 'all']),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const filter = {
      tenantId,
      activityProgram: req.params.id
    };
    const status = req.query.status || 'active';
    if (status !== 'all') filter.status = status;

    const enrollments = await ActivityEnrollment.find(filter)
      .populate('student', 'name admissionNumber class section photo')
      .populate('academicSession', 'name')
      .sort({ status: 1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: enrollments,
      total: enrollments.length,
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/activity-programs/:id/enrollments ───────────────────────
// Bulk enroll students into a program.
router.post('/:id/enrollments', writeGates, [
  param('id').isMongoId(),
  body('studentIds').isArray({ min: 1 }).withMessage('At least one student is required'),
  body('studentIds.*').isMongoId(),
  body('academicSessionId').isMongoId().withMessage('Academic session is required'),
  body('enrolledFrom').optional().isISO8601(),
  body('monthlyFee').optional().isFloat({ min: 0 }),
  body('discountType').optional().isIn(['none', 'percent', 'fixed']),
  body('discountValue').optional().isFloat({ min: 0 }),
  body('notes').optional().trim().isLength({ max: 500 }),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const program = await ActivityProgram.findOne({
      _id: req.params.id, tenantId, isActive: true
    });
    if (!program) {
      return res.status(404).json({ success: false, message: 'Active activity not found', requestId: req.requestId });
    }

    const {
      studentIds, academicSessionId, enrolledFrom, monthlyFee,
      discountType, discountValue, notes
    } = req.body;

    // Capacity check
    if (program.capacity > 0) {
      const currentActive = await ActivityEnrollment.countDocuments({
        tenantId,
        activityProgram: program._id,
        status: 'active'
      });
      const remaining = program.capacity - currentActive;
      if (remaining < studentIds.length) {
        return res.status(409).json({
          success: false,
          message: `Capacity exceeded. Only ${remaining} seat(s) remain.`,
          requestId: req.requestId
        });
      }
    }

    // Validate students belong to this tenant.
    const validStudents = await User.find({
      _id: { $in: studentIds },
      tenantId,
      role: 'student',
      isActive: true
    }).select('_id name').lean();
    const validIds = new Set(validStudents.map(s => String(s._id)));

    const fee = monthlyFee !== undefined ? monthlyFee : program.monthlyFee;
    const dtype = discountType || 'none';
    const dvalue = dtype === 'none' ? 0 : (discountValue || 0);

    const results = { enrolled: [], skipped: [], failed: [] };

    for (const studentId of studentIds) {
      if (!validIds.has(String(studentId))) {
        results.failed.push({ studentId, reason: 'Student not found or inactive' });
        continue;
      }
      try {
        const enrollment = await ActivityEnrollment.create({
          tenantId,
          activityProgram: program._id,
          student: studentId,
          academicSession: academicSessionId,
          monthlyFee: fee,
          discountType: dtype,
          discountValue: dvalue,
          enrolledFrom: enrolledFrom ? new Date(enrolledFrom) : new Date(),
          status: 'active',
          notes,
          createdBy: req.user._id
        });
        results.enrolled.push({ studentId, enrollmentId: enrollment._id });
      } catch (err) {
        if (err.code === 11000) {
          results.skipped.push({ studentId, reason: 'Student is already actively enrolled in this activity' });
        } else {
          results.failed.push({ studentId, reason: err.message });
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `Enrolled ${results.enrolled.length}, skipped ${results.skipped.length}, failed ${results.failed.length}`,
      data: results,
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
