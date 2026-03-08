const express = require('express');
const { body } = require('express-validator');
const TeacherSubjectAssignment = require('../models/TeacherSubjectAssignment');
const User = require('../models/User');
const ClassSubject = require('../models/ClassSubject');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @desc    Get teacher-subject assignments
// @route   GET /api/teacher-assignments
// @access  Private (Admin, Teacher)
router.get('/', protect, async (req, res) => {
    try {
        const { teacherId, classId, subjectId, academicSessionId } = req.query;
        const filter = { tenantId: req.user.tenantId };

        if (teacherId) filter.teacherId = teacherId;
        if (classId) filter.classId = classId;
        if (subjectId) filter.subjectId = subjectId;
        if (academicSessionId) filter.academicSessionId = academicSessionId;

        // Teachers can only see their own assignments
        if (req.user.role === 'teacher') {
            filter.teacherId = req.user._id;
        }

        const assignments = await TeacherSubjectAssignment.find(filter)
            .populate('teacherId', 'name email phone')
            .populate('subjectId', 'name subjectCode type')
            .populate('classId', 'name grade')
            .populate('sectionId', 'name')
            .populate('academicSessionId', 'name')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: assignments
        });
    } catch (error) {
        console.error('Get teacher assignments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching assignments'
        });
    }
});

// @desc    Get teacher's assignments
// @route   GET /api/teacher-assignments/teacher/:id
// @access  Private (Admin, Teacher - self only)
router.get('/teacher/:id', protect, async (req, res) => {
    try {
        // Teachers can only view their own assignments
        if (req.user.role === 'teacher' && req.user._id.toString() !== req.params.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view these assignments'
            });
        }

        const assignments = await TeacherSubjectAssignment.find({
            tenantId: req.user.tenantId,
            teacherId: req.params.id,
            isActive: true
        })
            .populate('subjectId', 'name subjectCode type')
            .populate('classId', 'name grade')
            .populate('sectionId', 'name')
            .populate('academicSessionId', 'name');

        // Group by class
        const grouped = {};
        assignments.forEach(assignment => {
            const classId = assignment.classId._id.toString();
            if (!grouped[classId]) {
                grouped[classId] = {
                    class: assignment.classId,
                    subjects: []
                };
            }
            grouped[classId].subjects.push({
                subject: assignment.subjectId,
                section: assignment.sectionId,
                isPrimary: assignment.isPrimary
            });
        });

        res.json({
            success: true,
            data: {
                assignments,
                grouped: Object.values(grouped),
                totalSubjects: assignments.length
            }
        });
    } catch (error) {
        console.error('Get teacher assignments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching teacher assignments'
        });
    }
});

// @desc    Assign teacher to subject
// @route   POST /api/teacher-assignments
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), [
    body('teacherId').notEmpty().withMessage('Teacher ID is required'),
    body('subjectId').notEmpty().withMessage('Subject ID is required'),
    body('classId').notEmpty().withMessage('Class ID is required'),
    body('academicSessionId').notEmpty().withMessage('Academic Session ID is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { teacherId, subjectId, classId, sectionId, academicSessionId, isPrimary } = req.body;

        // Verify teacher exists and has teacher role
        const teacher = await User.findOne({
            _id: teacherId,
            tenantId: req.user.tenantId,
            role: { $in: ['teacher', 'admin'] }
        });

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found or invalid role'
            });
        }

        // Verify subject is assigned to class
        const classSubject = await ClassSubject.findOne({
            tenantId: req.user.tenantId,
            classId,
            subjectId,
            academicSessionId
        });

        if (!classSubject) {
            return res.status(400).json({
                success: false,
                message: 'Subject must be assigned to class first'
            });
        }

        // Check if assignment already exists
        const existing = await TeacherSubjectAssignment.findOne({
            tenantId: req.user.tenantId,
            teacherId,
            subjectId,
            classId,
            sectionId: sectionId || null,
            academicSessionId
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Teacher already assigned to this subject/class/section'
            });
        }

        const assignment = await TeacherSubjectAssignment.create({
            tenantId: req.user.tenantId,
            teacherId,
            subjectId,
            classId,
            sectionId: sectionId || null,
            academicSessionId,
            isPrimary: isPrimary !== undefined ? isPrimary : true,
            createdBy: req.user._id
        });

        const populated = await TeacherSubjectAssignment.findById(assignment._id)
            .populate('teacherId', 'name email')
            .populate('subjectId', 'name subjectCode')
            .populate('classId', 'name grade')
            .populate('sectionId', 'name');

        res.status(201).json({
            success: true,
            message: 'Teacher assigned successfully',
            data: populated
        });
    } catch (error) {
        console.error('Assign teacher error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while assigning teacher'
        });
    }
});

// @desc    Update teacher assignment
// @route   PUT /api/teacher-assignments/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const assignment = await TeacherSubjectAssignment.findById(req.params.id);

        if (!assignment || assignment.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        const allowedUpdates = ['isPrimary', 'isActive'];
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                assignment[field] = req.body[field];
            }
        });

        await assignment.save();

        const populated = await TeacherSubjectAssignment.findById(assignment._id)
            .populate('teacherId', 'name email')
            .populate('subjectId', 'name subjectCode')
            .populate('classId', 'name grade')
            .populate('sectionId', 'name');

        res.json({
            success: true,
            message: 'Assignment updated successfully',
            data: populated
        });
    } catch (error) {
        console.error('Update assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating assignment'
        });
    }
});

// @desc    Delete teacher assignment
// @route   DELETE /api/teacher-assignments/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const assignment = await TeacherSubjectAssignment.findById(req.params.id);

        if (!assignment || assignment.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        // TODO: Check for dependencies (timetable, attendance)

        await assignment.deleteOne();

        res.json({
            success: true,
            message: 'Teacher assignment removed successfully'
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
