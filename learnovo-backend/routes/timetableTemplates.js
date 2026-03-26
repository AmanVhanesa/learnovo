const router = require('express').Router();
const { validationResult } = require('express-validator');
const TimetableTemplate = require('../models/TimetableTemplate');
const SchoolTiming = require('../models/SchoolTiming');
const SubjectAllocation = require('../models/SubjectAllocation');
const TeacherConstraint = require('../models/TeacherConstraint');
const TimetableEntry = require('../models/TimetableEntry');
const { authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const {
  validateTemplate,
  validateTiming,
  validateBulkTimings,
  validateAllocation,
  validateConstraint,
} = require('../middleware/timetableValidation');
const timetableService = require('../services/timetableService');

// Mount entries sub-router under /:id/entries (uses mergeParams)
router.use('/:id/entries', require('./timetableEntries'));

// ─── Param middleware: validate template belongs to tenant ───────────────────
router.param('id', async (req, res, next, id) => {
  try {
    const tenantId = req.user.tenantId;
    const template = await TimetableTemplate.findOne({ _id: id, tenantId });
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }
    req.template = template;
    next();
  } catch (error) {
    // Invalid ObjectId format
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID format',
      });
    }
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  TEMPLATE CRUD
// ════════════════════════════════════════════════════════════════════════════

// ─── GET / — List templates ─────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const filter = { tenantId };

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.academicSessionId) {
      filter.academicSessionId = req.query.academicSessionId;
    }

    const templates = await TimetableTemplate.find(filter)
      .populate('academicSessionId', 'name year')
      .populate('createdBy', 'name')
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: templates,
      message: `Found ${templates.length} template(s)`,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST / — Create template (admin only) ─────────────────────────────────
router.post('/', authorize('admin'), validateTemplate, handleValidationErrors, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { name, description, academicSessionId, workingDays, effectiveFrom, effectiveTo } = req.body;

    const template = await TimetableTemplate.create({
      tenantId,
      name,
      description,
      academicSessionId,
      workingDays,
      effectiveFrom,
      effectiveTo,
      createdBy: req.user._id,
      status: 'draft',
    });

    return res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /:id — Get template with stats ────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const template = await TimetableTemplate.findOne({ _id: req.params.id, tenantId })
      .populate('academicSessionId', 'name year')
      .populate('createdBy', 'name')
      .populate('publishedBy', 'name')
      .lean();

    const stats = await timetableService.getTemplateStats(tenantId, req.params.id);

    return res.status(200).json({
      success: true,
      data: { ...template, stats },
      message: 'Template retrieved successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /:id — Update template (admin, draft only) ────────────────────────
router.put('/:id', authorize('admin'), validateTemplate, handleValidationErrors, async (req, res, next) => {
  try {
    const template = req.template;

    if (template.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot edit a template that is ${template.status}. Duplicate it first.`,
      });
    }

    const { name, description, academicSessionId, workingDays, effectiveFrom, effectiveTo } = req.body;

    if (name !== undefined) template.name = name;
    if (description !== undefined) template.description = description;
    if (academicSessionId !== undefined) template.academicSessionId = academicSessionId;
    if (workingDays !== undefined) template.workingDays = workingDays;
    if (effectiveFrom !== undefined) template.effectiveFrom = effectiveFrom;
    if (effectiveTo !== undefined) template.effectiveTo = effectiveTo;

    await template.save();

    return res.status(200).json({
      success: true,
      data: template,
      message: 'Template updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /:id — Delete template (admin, draft only) ─────────────────────
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const template = req.template;

    if (template.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete a template that is ${template.status}`,
      });
    }

    const tenantId = req.user.tenantId;
    const templateId = template._id;

    // Delete all related data
    await Promise.all([
      SchoolTiming.deleteMany({ tenantId, templateId }),
      SubjectAllocation.deleteMany({ tenantId, templateId }),
      TeacherConstraint.deleteMany({ tenantId, templateId }),
      TimetableEntry.deleteMany({ tenantId, templateId }),
      TimetableTemplate.deleteOne({ _id: templateId, tenantId }),
    ]);

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Template and all related data deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /:id/publish — Publish template (admin only) ─────────────────────
router.post('/:id/publish', authorize('admin'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const template = req.template;

    if (template.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot publish a template that is ${template.status}`,
      });
    }

    // Validate completeness
    const validation = await timetableService.validateForPublish(tenantId, template._id);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Template is not ready for publishing',
        errors: validation.errors,
      });
    }

    template.status = 'published';
    template.publishedAt = new Date();
    template.publishedBy = req.user._id;
    await template.save();

    return res.status(200).json({
      success: true,
      data: template,
      message: 'Template published successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /:id/archive — Archive template (admin only) ─────────────────────
router.post('/:id/archive', authorize('admin'), async (req, res, next) => {
  try {
    const template = req.template;

    if (template.status === 'archived') {
      return res.status(400).json({
        success: false,
        message: 'Template is already archived',
      });
    }

    template.status = 'archived';
    await template.save();

    return res.status(200).json({
      success: true,
      data: template,
      message: 'Template archived successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /:id/duplicate — Duplicate template (admin only) ─────────────────
router.post('/:id/duplicate', authorize('admin'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { name } = req.body;

    const newTemplate = await timetableService.duplicateTemplate(
      tenantId,
      req.params.id,
      name,
      req.user._id
    );

    return res.status(201).json({
      success: true,
      data: newTemplate,
      message: 'Template duplicated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  TIMINGS (Bell Schedule)
// ════════════════════════════════════════════════════════════════════════════

// ─── GET /:id/timings — Get timing slots for template ───────────────────────
router.get('/:id/timings', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const timings = await SchoolTiming.find({
      tenantId,
      templateId: req.params.id,
    }).sort({ slotNumber: 1 }).lean();

    return res.status(200).json({
      success: true,
      data: timings,
      message: `Found ${timings.length} timing slot(s)`,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /:id/timings — Bulk create/replace timing slots (admin only) ─────
router.post('/:id/timings', authorize('admin'), validateBulkTimings, handleValidationErrors, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const templateId = req.params.id;
    const template = req.template;

    if (template.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot modify timings for a ${template.status} template`,
      });
    }

    const { timings } = req.body;

    // Delete existing timings for this template
    await SchoolTiming.deleteMany({ tenantId, templateId });

    // Create new timings
    const newTimings = await SchoolTiming.insertMany(
      timings.map(t => ({
        tenantId,
        templateId,
        slotNumber: t.slotNumber,
        label: t.label,
        startTime: t.startTime,
        endTime: t.endTime,
        type: t.type || 'period',
      }))
    );

    return res.status(201).json({
      success: true,
      data: newTimings,
      message: `${newTimings.length} timing slot(s) created successfully`,
    });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /:id/timings/:slotId — Update single timing slot (admin only) ─────
router.put('/:id/timings/:slotId', authorize('admin'), validateTiming, handleValidationErrors, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const template = req.template;

    if (template.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot modify timings for a ${template.status} template`,
      });
    }

    const timing = await SchoolTiming.findOne({
      _id: req.params.slotId,
      tenantId,
      templateId: req.params.id,
    });

    if (!timing) {
      return res.status(404).json({
        success: false,
        message: 'Timing slot not found',
      });
    }

    const { slotNumber, label, startTime, endTime, type } = req.body;
    if (slotNumber !== undefined) timing.slotNumber = slotNumber;
    if (label !== undefined) timing.label = label;
    if (startTime !== undefined) timing.startTime = startTime;
    if (endTime !== undefined) timing.endTime = endTime;
    if (type !== undefined) timing.type = type;

    await timing.save();

    return res.status(200).json({
      success: true,
      data: timing,
      message: 'Timing slot updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /:id/timings/:slotId — Delete timing slot (admin only) ──────────
router.delete('/:id/timings/:slotId', authorize('admin'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const template = req.template;

    if (template.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: `Cannot modify timings for a ${template.status} template`,
      });
    }

    const timing = await SchoolTiming.findOneAndDelete({
      _id: req.params.slotId,
      tenantId,
      templateId: req.params.id,
    });

    if (!timing) {
      return res.status(404).json({
        success: false,
        message: 'Timing slot not found',
      });
    }

    // Also delete any entries that reference this timing slot
    await TimetableEntry.deleteMany({
      tenantId,
      templateId: req.params.id,
      timingSlotId: req.params.slotId,
    });

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Timing slot deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  ALLOCATIONS (Subject-Class mapping)
// ════════════════════════════════════════════════════════════════════════════

// ─── GET /:id/allocations — List allocations ────────────────────────────────
router.get('/:id/allocations', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const filter = { tenantId, templateId: req.params.id, isActive: true };

    if (req.query.classId) filter.classId = req.query.classId;
    if (req.query.sectionId) filter.sectionId = req.query.sectionId;
    if (req.query.teacherId) filter.teacherId = req.query.teacherId;

    const allocations = await SubjectAllocation.find(filter)
      .populate('classId', 'grade name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: allocations,
      message: `Found ${allocations.length} allocation(s)`,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /:id/allocations — Create allocation (admin only) ────────────────
router.post('/:id/allocations', authorize('admin'), validateAllocation, handleValidationErrors, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const templateId = req.params.id;
    const { classId, sectionId, subjectId, teacherId, periodsPerWeek, preferConsecutive, consecutiveCount, preferredRoomType } = req.body;

    // Check for duplicate: same subject for same class+section in same template
    const duplicate = await SubjectAllocation.findOne({
      tenantId,
      templateId,
      classId,
      sectionId: sectionId || null,
      subjectId,
      isActive: true,
    });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'This subject is already allocated for this class/section in this template',
      });
    }

    const allocation = await SubjectAllocation.create({
      tenantId,
      templateId,
      classId,
      sectionId: sectionId || null,
      subjectId,
      teacherId,
      periodsPerWeek,
      preferConsecutive,
      consecutiveCount,
      preferredRoomType,
    });

    const populated = await SubjectAllocation.findById(allocation._id)
      .populate('classId', 'grade name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .lean();

    return res.status(201).json({
      success: true,
      data: populated,
      message: 'Allocation created successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /:id/allocations/:allocId — Update allocation (admin only) ────────
router.put('/:id/allocations/:allocId', authorize('admin'), validateAllocation, handleValidationErrors, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    const allocation = await SubjectAllocation.findOne({
      _id: req.params.allocId,
      tenantId,
      templateId: req.params.id,
    });

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found',
      });
    }

    const { classId, sectionId, subjectId, teacherId, periodsPerWeek, preferConsecutive, consecutiveCount, preferredRoomType } = req.body;

    // Check for duplicate if subject/class/section changed
    if (
      (subjectId && subjectId !== allocation.subjectId.toString()) ||
      (classId && classId !== allocation.classId.toString()) ||
      (sectionId !== undefined && String(sectionId || null) !== String(allocation.sectionId || null))
    ) {
      const duplicate = await SubjectAllocation.findOne({
        tenantId,
        templateId: req.params.id,
        classId: classId || allocation.classId,
        sectionId: sectionId !== undefined ? (sectionId || null) : allocation.sectionId,
        subjectId: subjectId || allocation.subjectId,
        isActive: true,
        _id: { $ne: allocation._id },
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'This subject is already allocated for this class/section in this template',
        });
      }
    }

    if (classId !== undefined) allocation.classId = classId;
    if (sectionId !== undefined) allocation.sectionId = sectionId || null;
    if (subjectId !== undefined) allocation.subjectId = subjectId;
    if (teacherId !== undefined) allocation.teacherId = teacherId;
    if (periodsPerWeek !== undefined) allocation.periodsPerWeek = periodsPerWeek;
    if (preferConsecutive !== undefined) allocation.preferConsecutive = preferConsecutive;
    if (consecutiveCount !== undefined) allocation.consecutiveCount = consecutiveCount;
    if (preferredRoomType !== undefined) allocation.preferredRoomType = preferredRoomType;

    await allocation.save();

    const populated = await SubjectAllocation.findById(allocation._id)
      .populate('classId', 'grade name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name email')
      .lean();

    return res.status(200).json({
      success: true,
      data: populated,
      message: 'Allocation updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /:id/allocations/:allocId — Delete allocation (admin only) ──────
router.delete('/:id/allocations/:allocId', authorize('admin'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    const allocation = await SubjectAllocation.findOne({
      _id: req.params.allocId,
      tenantId,
      templateId: req.params.id,
    });

    if (!allocation) {
      return res.status(404).json({
        success: false,
        message: 'Allocation not found',
      });
    }

    allocation.isActive = false;
    await allocation.save();

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Allocation deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  CONSTRAINTS (Teacher preferences)
// ════════════════════════════════════════════════════════════════════════════

// ─── GET /:id/constraints — List constraints ────────────────────────────────
router.get('/:id/constraints', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const filter = { tenantId, templateId: req.params.id };

    // Teachers can only see their own constraints
    if (req.user.role === 'teacher') {
      filter.teacherId = req.user._id;
    } else if (req.query.teacherId) {
      filter.teacherId = req.query.teacherId;
    }

    const constraints = await TeacherConstraint.find(filter)
      .populate('teacherId', 'name email')
      .populate('timingSlotId', 'label slotNumber startTime endTime')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: constraints,
      message: `Found ${constraints.length} constraint(s)`,
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /:id/constraints — Create constraint (admin or teacher for own) ──
router.post('/:id/constraints', validateConstraint, handleValidationErrors, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { teacherId, type, dayOfWeek, timingSlotId, value, reason, priority } = req.body;

    // Teachers can only create constraints for themselves
    if (req.user.role === 'teacher' && teacherId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Teachers can only create constraints for themselves',
      });
    }

    // Non-admin, non-teacher users cannot create constraints
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and teachers can create constraints',
      });
    }

    const constraint = await TeacherConstraint.create({
      tenantId,
      templateId: req.params.id,
      teacherId,
      type,
      dayOfWeek: dayOfWeek || null,
      timingSlotId: timingSlotId || null,
      value,
      reason,
      priority,
      createdBy: req.user._id,
    });

    const populated = await TeacherConstraint.findById(constraint._id)
      .populate('teacherId', 'name email')
      .populate('timingSlotId', 'label slotNumber startTime endTime')
      .lean();

    return res.status(201).json({
      success: true,
      data: populated,
      message: 'Constraint created successfully',
    });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /:id/constraints/:cId — Delete constraint (admin or teacher for own) ─
router.delete('/:id/constraints/:cId', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    const constraint = await TeacherConstraint.findOne({
      _id: req.params.cId,
      tenantId,
      templateId: req.params.id,
    });

    if (!constraint) {
      return res.status(404).json({
        success: false,
        message: 'Constraint not found',
      });
    }

    // Teachers can only delete their own constraints
    if (req.user.role === 'teacher' && constraint.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Teachers can only delete their own constraints',
      });
    }

    // Non-admin, non-teacher users cannot delete constraints
    if (!['admin', 'teacher'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and teachers can delete constraints',
      });
    }

    await TeacherConstraint.deleteOne({ _id: constraint._id });

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Constraint deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
