const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const homeworkService = require('../services/homeworkService');

/**
 * @route   POST /api/homework
 * @desc    Create new homework (teacher only)
 * @access  Private (Teacher)
 */
router.post('/', protect, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const homework = await homeworkService.createHomework(
            req.body,
            req.user._id,
            req.user.tenantId
        );

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
router.get('/', protect, async (req, res) => {
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
router.get('/stats', protect, async (req, res) => {
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
router.get('/my-submissions', protect, authorize('student'), async (req, res) => {
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
router.get('/:id', protect, async (req, res) => {
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
 * @desc    Update homework (teacher only)
 * @access  Private (Teacher)
 */
router.put('/:id', protect, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const homework = await homeworkService.updateHomework(
            req.params.id,
            req.body,
            req.user._id,
            req.user.tenantId
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
 * @desc    Delete homework (hard delete)
 * @access  Private (Teacher)
 */
router.delete('/:id', protect, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const result = await homeworkService.deleteHomework(
            req.params.id,
            req.user._id,
            req.user.tenantId
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
router.post('/:id/submit', protect, authorize('student'), async (req, res) => {
    try {
        const submission = await homeworkService.submitHomework(
            req.params.id,
            req.user._id,
            req.body,
            req.user.tenantId
        );

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
router.get('/:id/submissions', protect, authorize('teacher', 'admin'), async (req, res) => {
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
router.put('/submissions/:id', protect, authorize('teacher', 'admin'), async (req, res) => {
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

module.exports = router;
