const express = require('express');
const { body, query } = require('express-validator');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// Helper: calculate grade from percentage
function calculateGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B';
    if (percentage >= 60) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
}

// Helper: check time overlap  (HH:MM strings)
function timesOverlap(startA, endA, startB, endB) {
    if (!startA || !endA || !startB || !endB) return false;
    // compare as minutes since midnight
    const toMin = (t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };
    const sA = toMin(startA), eA = toMin(endA);
    const sB = toMin(startB), eB = toMin(endB);
    return sA < eB && eA > sB;
}

// @desc    Get all exams
// @route   GET /api/exams
// @access  Private
router.get('/', protect, [
    query('class').optional().trim(),
    query('subject').optional().trim(),
    query('section').optional().trim(),
    query('status').optional().trim(),
    query('from').optional().isDate(),
    query('to').optional().isDate(),
    handleValidationErrors
], async (req, res) => {
    try {
        const filter = { tenantId: req.user.tenantId };

        // Role based filtering
        if (req.user.role === 'student') {
            filter.class = req.user.class;
        } else if (req.user.role === 'teacher') {
            if (req.user.assignedClasses && req.user.assignedClasses.length > 0) {
                filter.class = { $in: req.user.assignedClasses };
            }
        }

        if (req.query.class) filter.class = req.query.class;
        if (req.query.subject) filter.subject = req.query.subject;
        if (req.query.section) filter.section = req.query.section;
        if (req.query.status) filter.status = req.query.status;

        if (req.query.from || req.query.to) {
            filter.date = {};
            if (req.query.from) filter.date.$gte = new Date(req.query.from);
            if (req.query.to) filter.date.$lte = new Date(req.query.to);
        }

        const exams = await Exam.find(filter)
            .populate('supervisor', 'name')
            .sort({ date: -1 });

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
    body('name').notEmpty().withMessage('Exam name is required'),
    body('class').notEmpty().withMessage('Class is required'),
    body('subject').notEmpty().withMessage('Subject is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('totalMarks').isNumeric().withMessage('Total marks must be a number'),
    body('passingMarks').optional().isNumeric().withMessage('Passing marks must be a number'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { class: cls, section, date, startTime, endTime, totalMarks, passingMarks } = req.body;

        // Validate passing marks
        if (passingMarks !== undefined && passingMarks !== null && passingMarks !== '') {
            if (Number(passingMarks) >= Number(totalMarks)) {
                return res.status(400).json({
                    success: false,
                    message: 'Passing marks must be less than total marks'
                });
            }
        }

        // For teachers, verify they can only schedule exams for their assigned classes
        if (req.user.role === 'teacher') {
            const Class = require('../models/Class');
            const classDoc = await Class.findOne({ grade: cls, tenantId: req.user.tenantId });

            if (!classDoc) {
                return res.status(404).json({ success: false, message: 'Class not found' });
            }

            const isClassTeacher = classDoc.classTeacher && classDoc.classTeacher.toString() === req.user._id.toString();
            const isAssignedToClass = req.user.assignedClasses && req.user.assignedClasses.includes(cls);

            if (!isClassTeacher && !isAssignedToClass) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not authorized to schedule exams for this class'
                });
            }
        }

        // Overlap check: same class, same section, same date, overlapping time
        if (startTime && endTime) {
            const examDate = new Date(date);
            const dayStart = new Date(examDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(examDate);
            dayEnd.setHours(23, 59, 59, 999);

            const existingExams = await Exam.find({
                tenantId: req.user.tenantId,
                class: cls,
                section: section || null,
                date: { $gte: dayStart, $lte: dayEnd },
                status: { $ne: 'Cancelled' }
            });

            for (const existing of existingExams) {
                if (timesOverlap(startTime, endTime, existing.startTime, existing.endTime)) {
                    return res.status(409).json({
                        success: false,
                        message: `Exam time overlaps with "${existing.name}" (${existing.startTime} - ${existing.endTime}) for this class/section on the same day`
                    });
                }
            }
        }

        const exam = await Exam.create({
            ...req.body,
            tenantId: req.user.tenantId
        });

        res.status(201).json({ success: true, data: exam });
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Get result card for a student (aggregated across exams)
// @route   GET /api/exams/result-card/:studentId
// @access  Private
router.get('/result-card/:studentId', protect, async (req, res) => {
    try {
        const { studentId } = req.params;
        const { examSeries, class: className } = req.query;

        // Build result filter
        const resultFilter = {
            tenantId: req.user.tenantId,
            student: studentId
        };

        // Fetch all results for this student
        const results = await Result.find(resultFilter)
            .populate({
                path: 'exam',
                select: 'name subject class section date totalMarks passingMarks examSeries examType status'
            })
            .populate('student', 'name rollNumber admissionNumber class section photo')
            .sort({ 'exam.date': 1 });

        if (!results.length) {
            return res.json({
                success: true,
                data: { student: null, subjects: [], summary: null }
            });
        }

        // Filter by examSeries / class if provided
        let filtered = results.filter(r => r.exam); // ensure exam populated
        if (examSeries) filtered = filtered.filter(r => r.exam.examSeries === examSeries);
        if (className) filtered = filtered.filter(r => r.exam.class === className);

        // Build subject rows
        const subjects = filtered.map(r => ({
            examId: r.exam._id,
            examName: r.exam.name,
            examSeries: r.exam.examSeries,
            subject: r.exam.subject,
            class: r.exam.class,
            section: r.exam.section,
            date: r.exam.date,
            examType: r.exam.examType,
            totalMarks: r.exam.totalMarks,
            passingMarks: r.exam.passingMarks ?? Math.ceil(r.exam.totalMarks * 0.4),
            marksObtained: r.marksObtained,
            percentage: r.percentage,
            grade: r.grade,
            isPassed: r.isPassed,
            remarks: r.remarks || ''
        }));

        // Compute overall summary
        const grandTotal = subjects.reduce((acc, s) => acc + s.totalMarks, 0);
        const grandObtained = subjects.reduce((acc, s) => acc + s.marksObtained, 0);
        const overallPercentage = grandTotal > 0
            ? Math.round((grandObtained / grandTotal) * 100 * 10) / 10
            : 0;
        const overallGrade = calculateGrade(overallPercentage);
        const overallPassed = subjects.every(s => s.isPassed);
        const passCount = subjects.filter(s => s.isPassed).length;
        const failCount = subjects.length - passCount;

        const student = results[0].student;

        res.json({
            success: true,
            data: {
                student,
                subjects,
                summary: {
                    grandTotal,
                    grandObtained,
                    overallPercentage,
                    overallGrade,
                    overallPassed,
                    passCount,
                    failCount,
                    totalSubjects: subjects.length
                }
            }
        });
    } catch (error) {
        console.error('Get result card error:', error);
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
        }).populate('supervisor', 'name');

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        res.json({ success: true, data: exam });
    } catch (error) {
        console.error('Get exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Update exam (status, fields)
// @route   PATCH /api/exams/:id
// @access  Private (Admin, Teacher)
router.patch('/:id', protect, authorize('admin', 'teacher'), async (req, res) => {
    try {
        const exam = await Exam.findOne({ _id: req.params.id, tenantId: req.user.tenantId });

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        // Validate passing marks if being updated
        const totalMarks = req.body.totalMarks !== undefined ? req.body.totalMarks : exam.totalMarks;
        const passingMarks = req.body.passingMarks !== undefined ? req.body.passingMarks : exam.passingMarks;

        if (passingMarks !== undefined && passingMarks !== null && Number(passingMarks) >= Number(totalMarks)) {
            return res.status(400).json({
                success: false,
                message: 'Passing marks must be less than total marks'
            });
        }

        const allowedFields = [
            'name', 'examSeries', 'class', 'classId', 'section', 'subject',
            'date', 'startTime', 'endTime', 'totalMarks', 'passingMarks',
            'examType', 'examMode', 'supervisor', 'examRoom', 'description', 'status'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                exam[field] = req.body[field];
            }
        });

        await exam.save();

        res.json({ success: true, data: exam });
    } catch (error) {
        console.error('Update exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Delete exam
// @route   DELETE /api/exams/:id
// @access  Private (Admin, Teacher)
router.delete('/:id', protect, authorize('admin', 'teacher'), async (req, res) => {
    try {
        const exam = await Exam.findOne({ _id: req.params.id, tenantId: req.user.tenantId });

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        await Result.deleteMany({ exam: req.params.id });
        await exam.deleteOne();

        res.json({ success: true, message: 'Exam and associated results deleted' });
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

        const resultsToProcess = req.body.results; // Array of { studentId, marks, remarks }

        if (!Array.isArray(resultsToProcess) || resultsToProcess.length === 0) {
            return res.status(400).json({ success: false, message: 'No results provided' });
        }

        const processed = [];
        const errors = [];

        for (const item of resultsToProcess) {
            try {
                const marksObtained = Number(item.marks);
                const percentage = exam.totalMarks > 0
                    ? Math.round((marksObtained / exam.totalMarks) * 100 * 10) / 10
                    : 0;
                const grade = calculateGrade(percentage);
                const isPassed = exam.passingMarks != null
                    ? marksObtained >= exam.passingMarks
                    : percentage >= 40;

                const result = await Result.findOneAndUpdate(
                    { exam: exam._id, student: item.studentId, tenantId: req.user.tenantId },
                    {
                        marksObtained,
                        percentage,
                        grade,
                        isPassed,
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

        res.json({ success: true, processed: processed.length, errors });
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
            .populate('student', 'name rollNumber admissionNumber')
            .sort({ 'student.rollNumber': 1 });

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
