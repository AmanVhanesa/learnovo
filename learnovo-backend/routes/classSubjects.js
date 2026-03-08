const express = require('express');
const { body } = require('express-validator');
const ClassSubject = require('../models/ClassSubject');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @desc    Get class-subject assignments
// @route   GET /api/class-subjects
// @access  Private (Admin, Teacher)
router.get('/', protect, async (req, res) => {
    try {
        const { classId, subjectId, academicSessionId } = req.query;
        const filter = { tenantId: req.user.tenantId };

        if (classId) filter.classId = classId;
        if (subjectId) filter.subjectId = subjectId;
        if (academicSessionId) filter.academicSessionId = academicSessionId;

        const assignments = await ClassSubject.find(filter)
            .populate('classId', 'name grade')
            .populate('subjectId', 'name subjectCode type')
            .populate('academicSessionId', 'name')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: assignments
        });
    } catch (error) {
        console.error('Get class-subjects error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching assignments'
        });
    }
});

// @desc    Assign subject to class
// @route   POST /api/class-subjects
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), [
    body('classId').notEmpty().withMessage('Class ID is required'),
    body('subjectId').notEmpty().withMessage('Subject ID is required'),
    body('academicSessionId').notEmpty().withMessage('Academic Session ID is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { classId, subjectId, academicSessionId, maxMarks, passingMarks, isCompulsory } = req.body;

        // Verify class exists
        const classExists = await Class.findOne({ _id: classId, tenantId: req.user.tenantId });
        if (!classExists) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        // Verify subject exists
        const subjectExists = await Subject.findOne({ _id: subjectId, tenantId: req.user.tenantId });
        if (!subjectExists) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        // Check if assignment already exists
        const existing = await ClassSubject.findOne({
            tenantId: req.user.tenantId,
            classId,
            subjectId,
            academicSessionId
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Subject already assigned to this class'
            });
        }

        const assignment = await ClassSubject.create({
            tenantId: req.user.tenantId,
            classId,
            subjectId,
            academicSessionId,
            maxMarks: maxMarks || subjectExists.maxMarks,
            passingMarks: passingMarks || subjectExists.passingMarks,
            isCompulsory: isCompulsory !== undefined ? isCompulsory : true,
            createdBy: req.user._id
        });

        const populated = await ClassSubject.findById(assignment._id)
            .populate('classId', 'name grade')
            .populate('subjectId', 'name subjectCode type');

        res.status(201).json({
            success: true,
            message: 'Subject assigned to class successfully',
            data: populated
        });
    } catch (error) {
        console.error('Assign subject error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while assigning subject'
        });
    }
});

// @desc    Bulk assign subjects to class
// @route   POST /api/class-subjects/bulk
// @access  Private (Admin)
router.post('/bulk', protect, authorize('admin'), [
    body('classId').notEmpty().withMessage('Class ID is required'),
    body('subjectIds').isArray({ min: 1 }).withMessage('Subject IDs array is required'),
    body('academicSessionId').notEmpty().withMessage('Academic Session ID is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { classId, subjectIds, academicSessionId } = req.body;

        // Verify class exists
        const classExists = await Class.findOne({ _id: classId, tenantId: req.user.tenantId });
        if (!classExists) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        const results = [];
        const errors = [];

        for (const subjectId of subjectIds) {
            try {
                // Check if already assigned
                const existing = await ClassSubject.findOne({
                    tenantId: req.user.tenantId,
                    classId,
                    subjectId,
                    academicSessionId
                });

                if (existing) {
                    errors.push({ subjectId, message: 'Already assigned' });
                    continue;
                }

                // Get subject for default marks
                const subject = await Subject.findById(subjectId);
                if (!subject) {
                    errors.push({ subjectId, message: 'Subject not found' });
                    continue;
                }

                const assignment = await ClassSubject.create({
                    tenantId: req.user.tenantId,
                    classId,
                    subjectId,
                    academicSessionId,
                    maxMarks: subject.maxMarks,
                    passingMarks: subject.passingMarks,
                    isCompulsory: true,
                    createdBy: req.user._id
                });

                results.push(assignment);
            } catch (error) {
                errors.push({ subjectId, message: error.message });
            }
        }

        res.status(201).json({
            success: true,
            message: `${results.length} subjects assigned successfully`,
            data: {
                assigned: results.length,
                errors: errors.length,
                details: errors
            }
        });
    } catch (error) {
        console.error('Bulk assign error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while bulk assigning subjects'
        });
    }
});

// @desc    Update class-subject assignment
// @route   PUT /api/class-subjects/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const assignment = await ClassSubject.findById(req.params.id);

        if (!assignment || assignment.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        const allowedUpdates = ['maxMarks', 'passingMarks', 'isCompulsory', 'isActive'];
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                assignment[field] = req.body[field];
            }
        });

        await assignment.save();

        const populated = await ClassSubject.findById(assignment._id)
            .populate('classId', 'name grade')
            .populate('subjectId', 'name subjectCode type');

        res.json({
            success: true,
            message: 'Assignment updated successfully',
            data: populated
        });
    } catch (error) {
        console.error('Update assignment error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while updating assignment'
        });
    }
});

// @desc    Delete class-subject assignment
// @route   DELETE /api/class-subjects/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const assignment = await ClassSubject.findById(req.params.id);

        if (!assignment || assignment.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        // TODO: Check for dependencies (exams, results, timetable)

        await assignment.deleteOne();

        res.json({
            success: true,
            message: 'Subject removed from class successfully'
        });
    } catch (error) {
        console.error('Delete assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting assignment'
        });
    }
});

module.exports = router;
