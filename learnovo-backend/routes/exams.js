const express = require('express');
const { body, query } = require('express-validator');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @desc    Get all exams
// @route   GET /api/exams
// @access  Private
router.get('/', protect, [
    query('class').optional().trim(),
    query('subject').optional().trim(),
    query('from').optional().isDate(),
    query('to').optional().isDate(),
    handleValidationErrors
], async (req, res) => {
    try {
        const filter = { tenantId: req.user.tenantId };

        // Role based filtering
        if (req.user.role === 'student') {
            filter.class = req.user.class;
        } else if (req.user.role === 'parent') {
            // Parents see exams for their children's classes
            // Complex query, for now let's just show all exams or filter by query params
        } else if (req.user.role === 'teacher') {
            // Teachers see all or filtered by their assigned classes
            if (req.user.assignedClasses && req.user.assignedClasses.length > 0) {
                filter.class = { $in: req.user.assignedClasses };
            }
        }

        if (req.query.class) filter.class = req.query.class;
        if (req.query.subject) filter.subject = req.query.subject;

        if (req.query.from || req.query.to) {
            filter.date = {};
            if (req.query.from) filter.date.$gte = new Date(req.query.from);
            if (req.query.to) filter.date.$lte = new Date(req.query.to);
        }

        const exams = await Exam.find(filter).sort({ date: -1 });

        res.json({
            success: true,
            count: exams.length,
            data: exams
        });
    } catch (error) {
        console.error('Get exams error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Create exam
// @route   POST /api/exams
// @access  Private (Admin, Teacher)
router.post('/', protect, authorize('admin', 'teacher'), [
    body('name').notEmpty().withMessage('Name is required'),
    body('class').notEmpty().withMessage('Class is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('totalMarks').isNumeric().withMessage('Total marks must be a number'),
    handleValidationErrors
], async (req, res) => {
    try {
        // For teachers, verify they can only schedule exams for their assigned classes
        if (req.user.role === 'teacher') {
            const Class = require('../models/Class');

            // Find the class by grade to verify teacher assignment
            const classDoc = await Class.findOne({
                grade: req.body.class,
                tenantId: req.user.tenantId
            });

            if (!classDoc) {
                return res.status(404).json({
                    success: false,
                    message: 'Class not found'
                });
            }

            // Check if teacher is assigned to this class
            const isClassTeacher = classDoc.classTeacher && classDoc.classTeacher.toString() === req.user._id.toString();
            const isAssignedToClass = req.user.assignedClasses && req.user.assignedClasses.includes(req.body.class);

            if (!isClassTeacher && !isAssignedToClass) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to schedule exams for this class'
                });
            }
        }

        const exam = await Exam.create({
            ...req.body,
            tenantId: req.user.tenantId
        });

        res.status(201).json({
            success: true,
            data: exam
        });
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Get exam details
// @route   GET /api/exams/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const exam = await Exam.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        res.json({
            success: true,
            data: exam
        });
    } catch (error) {
        console.error('Get exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Delete exam
// @route   DELETE /api/exams/:id
// @access  Private (Admin, Teacher)
router.delete('/:id', protect, authorize('admin', 'teacher'), async (req, res) => {
    try {
        const exam = await Exam.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        // Delete associated results
        await Result.deleteMany({ exam: req.params.id });
        await exam.deleteOne();

        res.json({
            success: true,
            message: 'Exam and associated results deleted'
        });
    } catch (error) {
        console.error('Delete exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Add/Update results for an exam
// @route   POST /api/exams/:id/results
// @access  Private (Admin, Teacher)
router.post('/:id/results', protect, authorize('admin', 'teacher'), async (req, res) => {
    try {
        const exam = await Exam.findById(req.params.id);
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

        const resultsToProcess = req.body.results; // Expect array of { studentId, marks, remarks }

        if (!Array.isArray(resultsToProcess) || resultsToProcess.length === 0) {
            return res.status(400).json({ success: false, message: 'No results provided' });
        }

        const processed = [];
        const errors = [];

        for (const item of resultsToProcess) {
            try {
                // Upsert result
                const result = await Result.findOneAndUpdate(
                    { exam: exam._id, student: item.studentId, tenantId: req.user.tenantId },
                    {
                        marksObtained: item.marks,
                        remarks: item.remarks,
                        tenantId: req.user.tenantId
                    },
                    { new: true, upsert: true, runValidators: true }
                );
                processed.push(result);
            } catch (err) {
                errors.push({ studentId: item.studentId, error: err.message });
            }
        }

        res.json({
            success: true,
            processed: processed.length,
            errors: errors
        });

    } catch (error) {
        console.error('Save results error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Get results for an exam
// @route   GET /api/exams/:id/results
// @access  Private
router.get('/:id/results', protect, async (req, res) => {
    try {
        const results = await Result.find({ exam: req.params.id })
            .populate('student', 'name rollNumber')
            .sort({ 'student.rollNumber': 1 });

        res.json({
            success: true,
            data: results
        });
    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
