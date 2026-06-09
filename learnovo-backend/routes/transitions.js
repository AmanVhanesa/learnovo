const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getTenantFromRequest } = require('../middleware/tenant');
const transitionService = require('../services/transitionService');

// All routes require auth + tenant
router.use(protect);
router.use(getTenantFromRequest);

// ─── CLASS HIERARCHY ─────────────────────────────────────────────────────────

// GET /api/transitions/class-hierarchy
router.get('/class-hierarchy', async(req, res, next) => {
  try {
    const hierarchy = await transitionService.getClassHierarchy(req.user.tenantId);
    res.json({ success: true, data: hierarchy });
  } catch (error) {
    next(error);
  }
});

// PUT /api/transitions/class-hierarchy (admin only)
router.put('/class-hierarchy', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const { classHierarchy } = req.body;
    if (!classHierarchy || !Array.isArray(classHierarchy) || classHierarchy.length === 0) {
      return res.status(400).json({ success: false, message: 'classHierarchy array is required', requestId: req.requestId });
    }
    // Validate each entry
    for (let i = 0; i < classHierarchy.length; i++) {
      const entry = classHierarchy[i];
      if (!entry.name || entry.order === undefined) {
        return res.status(400).json({ success: false, message: `Entry ${i}: name and order are required`, requestId: req.requestId });
      }
    }

    const Settings = require('../models/Settings');
    const settings = await Settings.getSettings(req.user.tenantId);
    settings.academic.classHierarchy = classHierarchy;
    await settings.save();

    res.json({ success: true, message: 'Class hierarchy updated', data: classHierarchy });
  } catch (error) {
    next(error);
  }
});

// ─── BULK PROMOTION ──────────────────────────────────────────────────────────

// POST /api/transitions/promote/bulk
// NOTE: this static route MUST be declared before '/promote/:studentId',
// otherwise Express matches '/bulk' as the :studentId param and tries to cast
// "bulk" to an ObjectId, failing with "Invalid ID format".
router.post('/promote/bulk', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const { fromClass, fromSection, toClass, toSection, academicYear, excludeStudents, includeFailed, forceOverride, remarks } = req.body;
    if (!fromClass) {
      return res.status(400).json({ success: false, message: 'fromClass is required', requestId: req.requestId });
    }
    if (!academicYear) {
      return res.status(400).json({ success: false, message: 'academicYear is required', requestId: req.requestId });
    }

    const result = await transitionService.bulkPromote({
      tenantId: req.user.tenantId,
      fromClass,
      fromSection,
      toClass,
      toSection,
      academicYear,
      excludeStudentIds: excludeStudents || [],
      includeFailed: includeFailed === true,
      forceOverride: forceOverride === true,
      remarks,
      performedBy: req.user._id
    });

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors, requestId: req.requestId });
    }

    res.json({ success: true, message: 'Bulk promotion completed', data: result.data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ─── SINGLE STUDENT PROMOTION ────────────────────────────────────────────────

// POST /api/transitions/promote/:studentId
router.post('/promote/:studentId', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const { toClass, toSection, academicYear, remarks, forceOverride } = req.body;
    if (!academicYear) {
      return res.status(400).json({ success: false, message: 'academicYear is required', requestId: req.requestId });
    }

    const result = await transitionService.promoteStudent({
      tenantId: req.user.tenantId,
      studentId: req.params.studentId,
      toClass,
      toSection,
      academicYear,
      remarks,
      forceOverride: forceOverride === true,
      performedBy: req.user._id
    });

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors, requestId: req.requestId });
    }

    res.json({ success: true, message: 'Student promoted successfully', data: result.data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ─── SINGLE STUDENT DEMOTION ─────────────────────────────────────────────────

// POST /api/transitions/demote/:studentId
router.post('/demote/:studentId', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const { toClass, toSection, academicYear, reason, forceOverride } = req.body;
    if (!academicYear) {
      return res.status(400).json({ success: false, message: 'academicYear is required', requestId: req.requestId });
    }
    if (!toClass) {
      return res.status(400).json({ success: false, message: 'toClass is required for demotion', requestId: req.requestId });
    }
    if (!reason) {
      return res.status(400).json({ success: false, message: 'reason is required for demotion', requestId: req.requestId });
    }

    const result = await transitionService.demoteStudent({
      tenantId: req.user.tenantId,
      studentId: req.params.studentId,
      toClass,
      toSection,
      academicYear,
      reason,
      forceOverride: forceOverride === true,
      performedBy: req.user._id
    });

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors, requestId: req.requestId });
    }

    res.json({ success: true, message: 'Student demoted successfully', data: result.data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ─── BULK SHIFT STUDENTS (by admission numbers) ────────────────────────────

// POST /api/transitions/shift-students
router.post('/shift-students', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const { admissionNumbers, studentIds, toClass, toSection, academicYear, remarks, forceOverride } = req.body;
    if (!toClass) {
      return res.status(400).json({ success: false, message: 'toClass is required', requestId: req.requestId });
    }
    if (!academicYear) {
      return res.status(400).json({ success: false, message: 'academicYear is required', requestId: req.requestId });
    }
    if ((!admissionNumbers || admissionNumbers.length === 0) && (!studentIds || studentIds.length === 0)) {
      return res.status(400).json({ success: false, message: 'Provide admissionNumbers or studentIds', requestId: req.requestId });
    }

    const result = await transitionService.bulkShiftStudents({
      tenantId: req.user.tenantId,
      admissionNumbers: admissionNumbers || [],
      studentIds: studentIds || [],
      toClass,
      toSection,
      academicYear,
      remarks,
      forceOverride: forceOverride === true,
      performedBy: req.user._id
    });

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors, requestId: req.requestId });
    }

    res.json({ success: true, message: 'Student shift completed', data: result.data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// POST /api/transitions/resolve-students — preview students from admission numbers
router.post('/resolve-students', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const { admissionNumbers } = req.body;
    if (!admissionNumbers || !Array.isArray(admissionNumbers) || admissionNumbers.length === 0) {
      return res.status(400).json({ success: false, message: 'admissionNumbers array is required', requestId: req.requestId });
    }

    const result = await transitionService.resolveStudentsByAdmissionNumbers(
      req.user.tenantId,
      admissionNumbers
    );

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors, requestId: req.requestId });
    }

    res.json({ success: true, data: result.data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ─── SECTION SHIFT ───────────────────────────────────────────────────────────

// POST /api/transitions/shift-section/bulk
// NOTE: this static route MUST be declared before '/shift-section/:studentId',
// otherwise Express matches '/bulk' as the :studentId param and tries to cast
// "bulk" to an ObjectId, failing with "Invalid ID format".
router.post('/shift-section/bulk', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const { className, fromSection, toSection, studentIds } = req.body;
    if (!className) {
      return res.status(400).json({ success: false, message: 'className is required', requestId: req.requestId });
    }
    if (!toSection) {
      return res.status(400).json({ success: false, message: 'toSection is required', requestId: req.requestId });
    }

    const result = await transitionService.bulkShiftSection({
      tenantId: req.user.tenantId,
      className,
      fromSection,
      toSection,
      studentIds,
      performedBy: req.user._id
    });

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors, requestId: req.requestId });
    }

    res.json({ success: true, message: 'Bulk section shift completed', data: result.data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// POST /api/transitions/shift-section/:studentId
router.post('/shift-section/:studentId', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const { toSection, reason } = req.body;
    if (!toSection) {
      return res.status(400).json({ success: false, message: 'toSection is required', requestId: req.requestId });
    }

    const result = await transitionService.shiftSection({
      tenantId: req.user.tenantId,
      studentId: req.params.studentId,
      toSection,
      reason,
      performedBy: req.user._id
    });

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors, requestId: req.requestId });
    }

    res.json({ success: true, message: 'Section shifted successfully', data: result.data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ─── SECTION MERGE / SPLIT ──────────────────────────────────────────────────

// POST /api/transitions/sections/merge
router.post('/sections/merge', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const { className, sourceSections, targetSections, distribution, manualAssignments } = req.body;
    if (!className) {
      return res.status(400).json({ success: false, message: 'className is required', requestId: req.requestId });
    }
    if (!sourceSections || sourceSections.length === 0) {
      return res.status(400).json({ success: false, message: 'sourceSections are required', requestId: req.requestId });
    }
    if (!targetSections || targetSections.length === 0) {
      return res.status(400).json({ success: false, message: 'targetSections are required', requestId: req.requestId });
    }

    const result = await transitionService.mergeSections({
      tenantId: req.user.tenantId,
      className,
      sourceSections,
      targetSections,
      distribution: distribution || 'even',
      manualAssignments,
      performedBy: req.user._id
    });

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors, requestId: req.requestId });
    }

    res.json({ success: true, message: 'Sections merged successfully', data: result.data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// POST /api/transitions/sections/split
router.post('/sections/split', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const { className, sourceSection, targetSections, distribution, manualAssignments } = req.body;
    if (!className || !sourceSection || !targetSections || targetSections.length === 0) {
      return res.status(400).json({ success: false, message: 'className, sourceSection, and targetSections are required', requestId: req.requestId });
    }

    const result = await transitionService.splitSection({
      tenantId: req.user.tenantId,
      className,
      sourceSection,
      targetSections,
      distribution: distribution || 'even',
      manualAssignments,
      performedBy: req.user._id
    });

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors, requestId: req.requestId });
    }

    res.json({ success: true, message: 'Section split successfully', data: result.data, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ─── YEAR-END ROLLOVER ──────────────────────────────────────────────────────

// POST /api/transitions/year-rollover
router.post('/year-rollover', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const { currentYear, newYear, promotionRules, highestClass, dryRun } = req.body;
    if (!currentYear || !newYear) {
      return res.status(400).json({ success: false, message: 'currentYear and newYear are required', requestId: req.requestId });
    }

    const result = await transitionService.yearRollover({
      tenantId: req.user.tenantId,
      currentYear,
      newYear,
      promotionRules: promotionRules || {},
      highestClass,
      dryRun: dryRun === true,
      performedBy: req.user._id
    });

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors, requestId: req.requestId });
    }

    res.json({
      success: true,
      message: dryRun ? 'Rollover preview generated' : 'Year-end rollover completed',
      data: result.data,
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});

// ─── TRANSITION HISTORY ─────────────────────────────────────────────────────

// GET /api/transitions/history
router.get('/history', async(req, res, next) => {
  try {
    const { studentId, type, batchId, fromDate, toDate, page, limit } = req.query;

    const result = await transitionService.getTransitionHistory({
      tenantId: req.user.tenantId,
      studentId,
      type,
      batchId,
      fromDate,
      toDate,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json({ ...result, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ─── UNDO TRANSITION ────────────────────────────────────────────────────────

// POST /api/transitions/undo/:logId
router.post('/undo/:logId', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const result = await transitionService.undoTransition({
      tenantId: req.user.tenantId,
      transitionLogId: req.params.logId,
      performedBy: req.user._id
    });

    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.errors, requestId: req.requestId });
    }

    res.json({ success: true, message: result.data.message, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ─── RECALCULATE SECTION STRENGTHS ──────────────────────────────────────────

// POST /api/transitions/recalculate-strengths
router.post('/recalculate-strengths', authorize('admin', 'principal'), async(req, res, next) => {
  try {
    const result = await transitionService.recalculateSectionStrengths(req.user.tenantId);
    res.json({ success: true, message: `Updated ${result.updated} of ${result.total} sections`, data: result, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ─── GET SECTIONS FOR A CLASS ────────────────────────────────────────────────

// GET /api/transitions/sections/:className
router.get('/sections/:className', async(req, res, next) => {
  try {
    const sections = await transitionService.getSectionsForClass(
      req.user.tenantId,
      req.params.className
    );
    res.json({ success: true, data: sections, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
