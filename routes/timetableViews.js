const router = require('express').Router();
const { authorize } = require('../middleware/auth');
const { getEffectiveSchedule, getWeekSchedule, getTodayForUser } = require('../services/timetableViewService');
const { generatePDF, generateExcel } = require('../services/timetableExportService');

// ─── GET /today — Today's effective schedule (role-based) ────────────────────
router.get('/today', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { classId, sectionId, teacherId, roomId } = req.query;

    // Admin must pass explicit filters; others get auto-filtered by role
    if (req.user.role === 'admin' && !classId && !teacherId && !roomId) {
      // Admin with no filters — get full overview
      const schedule = await getTodayForUser(tenantId, req.user);
      if (schedule.error) {
        return res.status(404).json({ success: false, message: schedule.error });
      }
      return res.status(200).json({
        success: true,
        data: schedule,
        message: "Today's schedule retrieved successfully"
      });
    }

    if (req.user.role !== 'admin') {
      // Role-based auto-filtering
      const schedule = await getTodayForUser(tenantId, req.user);
      if (schedule.error) {
        return res.status(404).json({ success: false, message: schedule.error });
      }
      return res.status(200).json({
        success: true,
        data: schedule,
        message: "Today's schedule retrieved successfully"
      });
    }

    // Admin with explicit filters
    const filters = {};
    if (classId) filters.classId = classId;
    if (sectionId) filters.sectionId = sectionId;
    if (teacherId) filters.teacherId = teacherId;
    if (roomId) filters.roomId = roomId;

    const schedule = await getEffectiveSchedule(tenantId, new Date(), filters);
    if (schedule.error) {
      return res.status(404).json({ success: false, message: schedule.error });
    }

    return res.status(200).json({
      success: true,
      data: schedule,
      message: "Today's schedule retrieved successfully"
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /week — Weekly schedule ─────────────────────────────────────────────
router.get('/week', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { date, classId, sectionId, teacherId, roomId } = req.query;

    const startDate = date ? new Date(date) : new Date();

    // Teachers can only see their own timetable
    if (req.user.role === 'teacher' && teacherId && teacherId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own timetable'
      });
    }

    const filters = {};
    if (classId) filters.classId = classId;
    if (sectionId) filters.sectionId = sectionId;
    if (teacherId) filters.teacherId = teacherId;
    else if (req.user.role === 'teacher') filters.teacherId = req.user._id;
    if (roomId) filters.roomId = roomId;

    // Students auto-filter
    if (req.user.role === 'student') {
      if (req.user.classId) filters.classId = req.user.classId;
      if (req.user.sectionId) filters.sectionId = req.user.sectionId;
    }

    const schedule = await getWeekSchedule(tenantId, startDate, filters);
    if (schedule.error) {
      return res.status(404).json({ success: false, message: schedule.error });
    }

    return res.status(200).json({
      success: true,
      data: schedule,
      message: 'Weekly schedule retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /class/:classId — Weekly class timetable ────────────────────────────
router.get('/class/:classId', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { classId } = req.params;
    const { sectionId, date } = req.query;

    const startDate = date ? new Date(date) : new Date();
    const filters = { classId };
    if (sectionId) filters.sectionId = sectionId;

    const schedule = await getWeekSchedule(tenantId, startDate, filters);
    if (schedule.error) {
      return res.status(404).json({ success: false, message: schedule.error });
    }

    return res.status(200).json({
      success: true,
      data: schedule,
      message: 'Class timetable retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /teacher/:teacherId — Weekly teacher timetable ──────────────────────
router.get('/teacher/:teacherId', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { teacherId } = req.params;
    const { date } = req.query;

    // Teachers can only view their own timetable (unless admin)
    if (req.user.role === 'teacher' && teacherId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own timetable'
      });
    }

    const startDate = date ? new Date(date) : new Date();
    const schedule = await getWeekSchedule(tenantId, startDate, { teacherId });
    if (schedule.error) {
      return res.status(404).json({ success: false, message: schedule.error });
    }

    return res.status(200).json({
      success: true,
      data: schedule,
      message: 'Teacher timetable retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /room/:roomId — Weekly room occupancy ──────────────────────────────
router.get('/room/:roomId', authorize('admin', 'teacher'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { roomId } = req.params;
    const { date } = req.query;

    const startDate = date ? new Date(date) : new Date();
    const schedule = await getWeekSchedule(tenantId, startDate, { roomId });
    if (schedule.error) {
      return res.status(404).json({ success: false, message: schedule.error });
    }

    return res.status(200).json({
      success: true,
      data: schedule,
      message: 'Room occupancy retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /export/pdf — Export timetable as PDF ───────────────────────────────
router.get('/export/pdf', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { classId, sectionId, teacherId, templateId } = req.query;

    // Teachers can only export their own
    if (req.user.role === 'teacher' && teacherId && teacherId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only export your own timetable'
      });
    }

    const options = {};
    if (classId) options.classId = classId;
    if (sectionId) options.sectionId = sectionId;
    if (teacherId) options.teacherId = teacherId;
    else if (req.user.role === 'teacher') options.teacherId = req.user._id;
    if (templateId) options.templateId = templateId;

    // Students auto-filter
    if (req.user.role === 'student') {
      if (req.user.classId) options.classId = req.user.classId;
      if (req.user.sectionId) options.sectionId = req.user.sectionId;
    }

    const { buffer, filename } = await generatePDF(tenantId, options);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length
    });
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// ─── GET /export/excel — Export timetable as Excel ───────────────────────────
router.get('/export/excel', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { classId, sectionId, teacherId, templateId } = req.query;

    // Teachers can only export their own
    if (req.user.role === 'teacher' && teacherId && teacherId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only export your own timetable'
      });
    }

    const options = {};
    if (classId) options.classId = classId;
    if (sectionId) options.sectionId = sectionId;
    if (teacherId) options.teacherId = teacherId;
    else if (req.user.role === 'teacher') options.teacherId = req.user._id;
    if (templateId) options.templateId = templateId;

    // Students auto-filter
    if (req.user.role === 'student') {
      if (req.user.classId) options.classId = req.user.classId;
      if (req.user.sectionId) options.sectionId = req.user.sectionId;
    }

    const { buffer, filename } = await generateExcel(tenantId, options);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length
    });
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
