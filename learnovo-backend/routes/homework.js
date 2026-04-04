const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const homeworkService = require('../services/homeworkService');
const notificationService = require('../services/notificationService');
const Homework = require('../models/Homework');
const ImportExportService = require('../services/importExportService');

/**
 * @route   GET /api/homework/export
 * @desc    Export homework list as CSV
 * @access  Private (Admin, Teacher)
 */
router.get('/export', protect, authorize('admin', 'teacher'), async(req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    if (req.query.classId) filter.class = req.query.classId;
    if (req.query.subject) filter.subject = req.query.subject;
    if (req.query.status) filter.status = req.query.status;

    const homework = await Homework.find(filter)
      .populate('subject', 'name')
      .populate('class', 'name')
      .populate('section', 'name')
      .populate('assignedBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const columns = [
      { key: 'title', header: 'Title' },
      { key: 'description', header: 'Description' },
      { key: 'subject', header: 'Subject', format: (val) => val?.name || '' },
      { key: 'class', header: 'Class', format: (val) => val?.name || '' },
      { key: 'section', header: 'Section', format: (val) => val?.name || 'All' },
      { key: 'assignedBy', header: 'Assigned By', format: (val) => val?.name || '' },
      { key: 'assignedDate', header: 'Assigned Date', format: (val) => val ? new Date(val).toLocaleDateString() : '' },
      { key: 'dueDate', header: 'Due Date', format: (val) => val ? new Date(val).toLocaleDateString() : '' },
      { key: 'status', header: 'Status' },
      { key: 'isActive', header: 'Active', format: (val) => val ? 'Yes' : 'No' }
    ];

    const csvBuffer = await ImportExportService.exportToCSV(homework, columns);
    const filename = `homework_export_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvBuffer);
  } catch (error) {
    console.error('Export homework error:', error);
    res.status(500).json({ success: false, message: 'Server error while exporting homework' });
  }
});

/**
 * @route   POST /api/homework
 * @desc    Create new homework (teacher only)
 * @access  Private (Teacher)
 */
router.post('/', protect, authorize('teacher', 'admin'), async(req, res) => {
  try {
    const homework = await homeworkService.createHomework(
      req.body,
      req.user._id,
      req.user.tenantId
    );

    // Fire homework assignment notifications (async, non-blocking)
    notificationService.notifyHomeworkAssigned(homework, req.user._id, req.user.tenantId)
      .catch(err => console.error('notifyHomeworkAssigned failed:', err));

    res.status(201).json({
      success: true,
      data: homework
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/homework
 * @desc    Get homework list (filtered by role)
 * @access  Private
 */
router.get('/', protect, async(req, res) => {
  try {
    const filters = {
      subject: req.query.subject,
      class: req.query.class,
      section: req.query.section,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const homework = await homeworkService.getHomeworkList(
      filters,
      req.user.role,
      req.user._id,
      req.user.tenantId
    );

    res.json({
      success: true,
      count: homework.length,
      data: homework
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/homework/stats
 * @desc    Get homework statistics for dashboard
 * @access  Private
 */
router.get('/stats', protect, async(req, res) => {
  try {
    const stats = await homeworkService.getHomeworkStats(
      req.user._id,
      req.user.role,
      req.user.tenantId
    );

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/homework/my-submissions
 * @desc    Get student's submissions
 * @access  Private (Student)
 */
router.get('/my-submissions', protect, authorize('student'), async(req, res) => {
  try {
    const filters = {
      status: req.query.status
    };

    const submissions = await homeworkService.getStudentSubmissions(
      req.user._id,
      req.user.tenantId,
      filters
    );

    res.json({
      success: true,
      count: submissions.length,
      data: submissions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/homework/:id
 * @desc    Get homework by ID
 * @access  Private
 */
router.get('/:id', protect, async(req, res) => {
  try {
    const homework = await homeworkService.getHomeworkById(
      req.params.id,
      req.user._id,
      req.user.role,
      req.user.tenantId
    );

    res.json({
      success: true,
      data: homework
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/homework/:id
 * @desc    Update homework (teacher or admin)
 * @access  Private (Teacher, Admin)
 */
router.put('/:id', protect, authorize('teacher', 'admin'), async(req, res) => {
  try {
    const homework = await homeworkService.updateHomework(
      req.params.id,
      req.body,
      req.user._id,
      req.user.tenantId,
      req.user.role
    );

    res.json({
      success: true,
      data: homework
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/homework/:id
 * @desc    Delete homework (teacher or admin)
 * @access  Private (Teacher, Admin)
 */
router.delete('/:id', protect, authorize('teacher', 'admin'), async(req, res) => {
  try {
    const result = await homeworkService.deleteHomework(
      req.params.id,
      req.user._id,
      req.user.tenantId,
      req.user.role
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/homework/:id/submit
 * @desc    Submit homework (student only)
 * @access  Private (Student)
 */
router.post('/:id/submit', protect, authorize('student'), async(req, res) => {
  try {
    const submission = await homeworkService.submitHomework(
      req.params.id,
      req.user._id,
      req.body,
      req.user.tenantId
    );

    // Notify the assigning teacher about the submission (async, non-blocking)
    const Homework = require('../models/Homework');
    Homework.findById(req.params.id).select('assignedBy title').lean()
      .then(hw => {
        if (hw) {
          notificationService.notifyHomeworkSubmitted(hw, req.user, req.user.tenantId)
            .catch(err => console.error('notifyHomeworkSubmitted failed:', err));
        }
      });

    res.status(201).json({
      success: true,
      data: submission
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/homework/:id/submissions
 * @desc    Get submissions for homework (teacher only)
 * @access  Private (Teacher)
 */
router.get('/:id/submissions', protect, authorize('teacher', 'admin'), async(req, res) => {
  try {
    const submissions = await homeworkService.getSubmissions(
      req.params.id,
      req.user._id,
      req.user.tenantId
    );

    res.json({
      success: true,
      count: submissions.length,
      data: submissions
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/homework/submissions/:id
 * @desc    Update submission feedback (teacher only)
 * @access  Private (Teacher)
 */
router.put('/submissions/:id', protect, authorize('teacher', 'admin'), async(req, res) => {
  try {
    const submission = await homeworkService.updateSubmissionFeedback(
      req.params.id,
      req.body,
      req.user._id,
      req.user.tenantId
    );

    res.json({
      success: true,
      data: submission
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/homework/:id/submission
 * @desc    Delete own submission (student only)
 * @access  Private (Student)
 */
router.delete('/:id/submission', protect, authorize('student'), async(req, res) => {
  try {
    await homeworkService.deleteSubmission(
      req.params.id,
      req.user._id,
      req.user.tenantId
    );

    res.json({
      success: true,
      message: 'Submission deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
