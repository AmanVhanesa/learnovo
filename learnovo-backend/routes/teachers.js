const express = require('express');
const mongoose = require('mongoose');
const { body, query } = require('express-validator');
const User = require('../models/User');
const Class = require('../models/Class');
const Section = require('../models/Section');
const TeacherSubjectAssignment = require('../models/TeacherSubjectAssignment');
const ClassSubject = require('../models/ClassSubject');
const AcademicSession = require('../models/AcademicSession');
const StudentBalance = require('../models/StudentBalance');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const planGate = require('../middleware/planGate');

const router = express.Router();

// @desc    Get all teachers
// @route   GET /api/teachers
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters'),
  handleValidationErrors
], async(req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { role: 'teacher' };

    // Add tenant filtering
    if (req.user && req.user.tenantId) {
      filter.tenantId = req.user.tenantId;
    }

    console.log('📋 Fetching teachers with filter:', filter);

    // Add search filter
    const searchTerm = req.query.search;
    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { fullName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } },
        { employeeId: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    const [teachers, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter)
    ]);

    // When searching, sort exact name/email matches first
    if (searchTerm && teachers.length > 1) {
      const term = searchTerm.toLowerCase();
      teachers.sort((a, b) => {
        const aName = (a.name || a.fullName || '').toLowerCase();
        const bName = (b.name || b.fullName || '').toLowerCase();
        const aExact = aName === term || (a.employeeId || '').toLowerCase() === term;
        const bExact = bName === term || (b.employeeId || '').toLowerCase() === term;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aStarts = aName.startsWith(term) || (a.employeeId || '').toLowerCase().startsWith(term);
        const bStarts = bName.startsWith(term) || (b.employeeId || '').toLowerCase().startsWith(term);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return 0;
      });
    }

    res.json({
      success: true,
      data: teachers,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching teachers'
    });
  }
});

// @desc    Create teacher
// @route   POST /api/teachers
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), planGate.requireActiveSubscription, planGate.checkTeacherLimit, [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('subjects').isArray().withMessage('Subjects must be an array'),
  body('qualifications').trim().notEmpty().withMessage('Qualifications are required'),
  body('assignedClasses').isArray().withMessage('Assigned classes must be an array'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { name, email, password, subjects, qualifications, assignedClasses, phone } = req.body;

    const existingTeacher = await User.findOne({ email });
    if (existingTeacher) {
      return res.status(400).json({
        success: false,
        message: 'Teacher with this email already exists'
      });
    }

    // Store plain password before creation (it gets hashed in the model)
    const plainPassword = password;

    const teacher = await User.create({
      name,
      email,
      password,
      role: 'teacher',
      tenantId: req.user.tenantId, // Ensure tenantId is set
      subjects,
      qualifications,
      assignedClasses,
      phone
    });

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        subjects: teacher.subjects,
        qualifications: teacher.qualifications,
        assignedClasses: teacher.assignedClasses,
        // Include credentials for admin to share
        credentials: {
          email: teacher.email,
          password: plainPassword // Return the plain password so admin can share it
        }
      }
    });
  } catch (error) {
    console.error('Create teacher error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating teacher'
    });
  }
});
// @desc    Update teacher
// @route   PUT /api/teachers/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('subjects').optional().isArray().withMessage('Subjects must be an array'),
  body('qualifications').optional().trim().notEmpty().withMessage('Qualifications are required'),
  body('assignedClasses').optional().isArray().withMessage('Assigned classes must be an array'),
  handleValidationErrors
], async(req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }
    if (req.body.email && req.body.email !== teacher.email) {
      const existing = await User.findOne({ email: req.body.email });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already in use' });
      }
    }
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-password');
    res.json({ success: true, message: 'Teacher updated successfully', data: updated });
  } catch (error) {
    console.error('Update teacher error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating teacher' });
  }
});

// @desc    Delete teacher
// @route   DELETE /api/teachers/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async(req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher || teacher.role !== 'teacher') {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (error) {
    console.error('Delete teacher error:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting teacher' });
  }
});

// @desc    Get teacher's assigned classes
// @route   GET /api/teachers/my-classes
// @access  Private (Teacher)
router.get('/my-classes', protect, authorize('teacher'), async(req, res) => {
  try {
    const teacherId = req.user._id;
    const tenantId = req.user.tenantId;

    // Strategy 1: Find classes via Class.classTeacher or Class.subjects[].teacher
    const classesFromModel = await Class.find({
      tenantId,
      $or: [
        { classTeacher: teacherId },
        { 'subjects.teacher': teacherId }
      ],
      isActive: true
    })
      .populate('classTeacher', 'name email')
      .populate('subjects.subject', 'name subjectCode')
      .populate('subjects.teacher', 'name email')
      .select('name grade academicYear classTeacher subjects isActive')
      .sort({ name: 1 });

    // Strategy 2: Find classes via TeacherSubjectAssignment
    const teacherAssignments = await TeacherSubjectAssignment.find({
      tenantId,
      teacherId,
      isActive: true
    })
      .populate('classId', 'name grade academicYear isActive')
      .populate('subjectId', 'name subjectCode')
      .populate('sectionId', 'name');

    // Strategy 3: Find classes where the teacher is a section teacher of any section
    const teacherSections = await Section.find({
      tenantId,
      sectionTeacher: teacherId,
      isActive: true
    }).select('classId').lean();

    // Collect class IDs from all strategies that weren't found in Strategy 1
    const classIdsFromModel = new Set(classesFromModel.map(c => c._id.toString()));
    const extraClassIds = new Set();
    teacherAssignments.forEach(a => {
      if (a.classId && a.classId._id && !classIdsFromModel.has(a.classId._id.toString())) {
        extraClassIds.add(a.classId._id.toString());
      }
    });
    teacherSections.forEach(s => {
      if (s.classId && !classIdsFromModel.has(s.classId.toString())) {
        extraClassIds.add(s.classId.toString());
      }
    });

    // Fetch any additional classes from Strategy 2 / Strategy 3
    let extraClasses = [];
    if (extraClassIds.size > 0) {
      extraClasses = await Class.find({
        _id: { $in: Array.from(extraClassIds) },
        tenantId,
        isActive: true
      })
        .populate('classTeacher', 'name email')
        .populate('subjects.subject', 'name subjectCode')
        .populate('subjects.teacher', 'name email')
        .select('name grade academicYear classTeacher subjects isActive')
        .sort({ name: 1 });
    }

    let allClasses = [...classesFromModel, ...extraClasses];

    // Backward-compat fallback: if no assignments found via any strategy and
    // the caller hasn't opted into strict mode, return all tenant classes so
    // existing flows (attendance) still work for unassigned teachers. The
    // academics page passes ?strict=true to suppress this — showing all
    // classes there hides the fact that the teacher isn't actually assigned.
    if (
      allClasses.length === 0 &&
      teacherAssignments.length === 0 &&
      req.query.strict !== 'true'
    ) {
      allClasses = await Class.find({ tenantId, isActive: true })
        .populate('classTeacher', 'name email')
        .populate('subjects.subject', 'name subjectCode')
        .populate('subjects.teacher', 'name email')
        .select('name grade academicYear classTeacher subjects isActive')
        .sort({ name: 1 });
    }

    // Fetch sections for all found classes
    const classIds = allClasses.map(c => c._id);
    const sections = await Section.find({ classId: { $in: classIds }, tenantId })
      .populate('sectionTeacher', 'name fullName email')
      .sort({ name: 1 });

    // Per-section student counts (match by sectionId OR legacy string section + class)
    const sectionStudentCounts = await User.aggregate([
      { $match: {
        tenantId, role: 'student', isActive: true,
        sectionId: { $in: sections.map(s => s._id) }
      } },
      { $group: { _id: '$sectionId', count: { $sum: 1 } } }
    ]);
    const studentCountBySection = {};
    sectionStudentCounts.forEach(sc => {
      if (sc._id) studentCountBySection[sc._id.toString()] = sc.count;
    });

    // Group sections by classId, attaching studentCount
    const sectionsByClass = {};
    sections.forEach(sec => {
      const cid = sec.classId.toString();
      if (!sectionsByClass[cid]) sectionsByClass[cid] = [];
      sectionsByClass[cid].push({
        ...sec.toObject(),
        studentCount: studentCountBySection[sec._id.toString()] || 0
      });
    });

    // Get subjects from ClassSubject collection (admin-configured class-subject mappings)
    const classSubjects = await ClassSubject.find({
      tenantId,
      classId: { $in: classIds },
      isActive: true
    }).populate('subjectId', 'name subjectCode');

    // Group ClassSubject entries by classId
    const classSubjectsByClass = {};
    classSubjects.forEach(cs => {
      const cid = cs.classId.toString();
      if (!classSubjectsByClass[cid]) classSubjectsByClass[cid] = [];
      if (cs.subjectId) {
        classSubjectsByClass[cid].push({
          _id: cs.subjectId._id,
          name: cs.subjectId.name,
          subjectCode: cs.subjectId.subjectCode
        });
      }
    });

    // Build subject info from TeacherSubjectAssignment keyed by classId
    const assignmentSubjectsByClass = {};
    teacherAssignments.forEach(a => {
      if (a.classId && a.subjectId) {
        const cid = a.classId._id.toString();
        if (!assignmentSubjectsByClass[cid]) assignmentSubjectsByClass[cid] = [];
        assignmentSubjectsByClass[cid].push({
          _id: a.subjectId._id,
          name: a.subjectId.name,
          subjectCode: a.subjectId.subjectCode,
          section: a.sectionId || null
        });
      }
    });

    // Transform classes to include sections and subject information
    const classesWithDetails = allClasses.map(classDoc => {
      const cid = classDoc._id.toString();

      // Collect subjects from all sources and deduplicate
      const subjectMap = new Map();

      // Source 1: Embedded Class.subjects for this teacher
      (classDoc.subjects || [])
        .filter(sub => sub.teacher && sub.teacher._id.toString() === teacherId.toString())
        .forEach(sub => {
          if (sub.subject?._id) {
            subjectMap.set(sub.subject._id.toString(), {
              _id: sub.subject._id,
              name: sub.subject.name || 'Not specified',
              subjectCode: sub.subject.subjectCode || '',
              teacher: sub.teacher
            });
          }
        });

      // Source 2: TeacherSubjectAssignment
      (assignmentSubjectsByClass[cid] || []).forEach(as => {
        if (!subjectMap.has(as._id.toString())) {
          subjectMap.set(as._id.toString(), as);
        }
      });

      // Source 3: ClassSubject (admin-configured subjects for this class)
      (classSubjectsByClass[cid] || []).forEach(cs => {
        if (!subjectMap.has(cs._id.toString())) {
          subjectMap.set(cs._id.toString(), cs);
        }
      });

      return {
        _id: classDoc._id,
        name: classDoc.name,
        grade: classDoc.grade,
        academicYear: classDoc.academicYear,
        classTeacher: classDoc.classTeacher,
        subjects: Array.from(subjectMap.values()),
        sections: sectionsByClass[cid] || [],
        isActive: classDoc.isActive
      };
    });

    res.json({
      success: true,
      data: classesWithDetails,
      count: classesWithDetails.length
    });
  } catch (error) {
    console.error('Get my classes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching classes'
    });
  }
});

// Helper: resolve the classes a teacher is linked to via any of the 4
// allocation methods (Class.classTeacher, Class.subjects[].teacher,
// Section.sectionTeacher, TeacherSubjectAssignment, legacy assignedClasses).
// Matches the same broad lookup the dashboard uses so a teacher who
// only appears in one allocation method is still recognized.
async function resolveTeacherClasses(tenantId, teacherUser) {
  const teacherId = teacherUser._id;
  const classMap = new Map();

  const directClasses = await Class.find({
    tenantId,
    $or: [
      { classTeacher: teacherId },
      { 'subjects.teacher': teacherId }
    ]
  }).select('name grade').lean();
  directClasses.forEach(c => classMap.set(c._id.toString(), { _id: c._id, name: c.name, grade: c.grade }));

  const teacherSections = await Section.find({
    tenantId, sectionTeacher: teacherId, isActive: true
  }).select('classId').lean();
  if (teacherSections.length > 0) {
    const sectionClassIds = [...new Set(teacherSections.map(s => s.classId?.toString()).filter(Boolean))];
    const missing = sectionClassIds.filter(id => !classMap.has(id));
    if (missing.length > 0) {
      const secClasses = await Class.find({ _id: { $in: missing }, tenantId }).select('name grade').lean();
      secClasses.forEach(c => classMap.set(c._id.toString(), { _id: c._id, name: c.name, grade: c.grade }));
    }
  }

  const tsaRecords = await TeacherSubjectAssignment.find({
    teacherId, tenantId, isActive: true
  }).select('classId').lean();
  if (tsaRecords.length > 0) {
    const tsaClassIds = [...new Set(tsaRecords.map(a => a.classId?.toString()).filter(Boolean))];
    const missing = tsaClassIds.filter(id => !classMap.has(id));
    if (missing.length > 0) {
      const tsaClasses = await Class.find({ _id: { $in: missing }, tenantId }).select('name grade').lean();
      tsaClasses.forEach(c => classMap.set(c._id.toString(), { _id: c._id, name: c.name, grade: c.grade }));
    }
  }

  const legacyNames = Array.isArray(teacherUser.assignedClasses) ? teacherUser.assignedClasses : [];
  if (legacyNames.length > 0) {
    const legacyFound = await Class.find({ tenantId, name: { $in: legacyNames } }).select('name grade').lean();
    legacyFound.forEach(c => {
      if (!classMap.has(c._id.toString())) {
        classMap.set(c._id.toString(), { _id: c._id, name: c.name, grade: c.grade });
      }
    });
  }

  return Array.from(classMap.values());
}

// @desc    Get classes a teacher is linked to (any allocation method,
//          incl. inactive classes and legacy assignedClasses) for the
//          Class Fee Status picker.
// @route   GET /api/teachers/assigned-classes
// @access  Private (Teacher)
router.get('/assigned-classes', protect, authorize('teacher'), async(req, res, next) => {
  try {
    const classes = await resolveTeacherClasses(req.user.tenantId, req.user);
    classes.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json({ success: true, data: classes, count: classes.length, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// @desc    Get pending fee summary for students of a class
//          (any teacher linked to the class — read-only summary)
// @route   GET /api/teachers/my-classes/:classId/pending-fees
// @access  Private (Teacher linked to :classId via any allocation method)
router.get('/my-classes/:classId/pending-fees', protect, authorize('teacher'), async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { classId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ success: false, message: 'Invalid class ID', requestId: req.requestId });
    }

    const classDoc = await Class.findOne({ _id: classId, tenantId }).select('name grade').lean();
    if (!classDoc) {
      return res.status(404).json({ success: false, message: 'Class not found', requestId: req.requestId });
    }

    // Match the same 4-strategy linkage logic used by the dashboard.
    const linkedClasses = await resolveTeacherClasses(tenantId, req.user);
    const isLinked = linkedClasses.some(c => c._id.toString() === classId.toString());

    if (!isLinked) {
      return res.status(403).json({
        success: false,
        message: 'You are not assigned to this class',
        requestId: req.requestId
      });
    }

    const activeSession = await AcademicSession.findOne({ tenantId, isActive: true }).select('_id name').lean();
    if (!activeSession) {
      return res.status(404).json({
        success: false,
        message: 'No active academic session found',
        requestId: req.requestId
      });
    }

    const students = await User.find({
      tenantId,
      role: 'student',
      classId,
      isActive: true
    })
      .select('name fullName admissionNumber rollNumber sectionId')
      .populate('sectionId', 'name')
      .sort({ rollNumber: 1, name: 1 })
      .lean();

    const studentIds = students.map(s => s._id);
    const balances = await StudentBalance.find({
      tenantId,
      academicSessionId: activeSession._id,
      studentId: { $in: studentIds }
    }).lean();

    const balanceByStudent = new Map(
      balances.map(b => [b.studentId.toString(), b])
    );

    const rows = students.map(s => {
      const bal = balanceByStudent.get(s._id.toString());
      return {
        studentId: s._id,
        name: s.fullName || s.name,
        admissionNumber: s.admissionNumber || '',
        rollNumber: s.rollNumber || '',
        sectionName: s.sectionId?.name || '',
        totalInvoiced: bal?.totalInvoiced || 0,
        totalPaid: bal?.totalPaid || 0,
        totalBalance: bal?.totalBalance || 0,
        lastPaymentDate: bal?.lastPaymentDate || null
      };
    });

    const totals = rows.reduce((acc, r) => {
      acc.totalInvoiced += r.totalInvoiced;
      acc.totalPaid += r.totalPaid;
      acc.totalBalance += r.totalBalance;
      if (r.totalBalance > 0) acc.pendingCount += 1;
      return acc;
    }, { totalInvoiced: 0, totalPaid: 0, totalBalance: 0, pendingCount: 0, studentCount: rows.length });

    res.json({
      success: true,
      data: {
        class: { _id: classDoc._id, name: classDoc.name, grade: classDoc.grade },
        session: { _id: activeSession._id, name: activeSession.name },
        totals,
        students: rows
      },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
