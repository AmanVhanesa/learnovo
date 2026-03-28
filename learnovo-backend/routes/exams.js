const express = require('express');
const { body, query } = require('express-validator');
const Exam = require('../models/Exam');
const Result = require('../models/Result');
const User = require('../models/User');
const Class = require('../models/Class');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
let notificationService;
try { notificationService = require('../services/notificationService'); } catch (e) { /* optional */ }

const planGate = require('../middleware/planGate');

const router = express.Router();

// Plan gates: all exam routes require grades/exams feature (Basic+ plan)
// Applied after protect in each route
const examPlanGates = [planGate.requireActiveSubscription, planGate.checkGradesAndExams];

/**
 * Resolve class names a teacher is assigned to (all 4 allocation methods).
 */
async function resolveTeacherClassNames(teacherId, tenantId) {
    const classNames = new Set();
    try {
        // 1. Class model: classTeacher or subjects[].teacher
        const directClasses = await Class.find({
            tenantId,
            $or: [{ classTeacher: teacherId }, { 'subjects.teacher': teacherId }],
        }).select('grade').lean();
        directClasses.forEach(c => c.grade && classNames.add(c.grade));

        // 2. Section model: sectionTeacher
        const Section = require('../models/Section');
        const sectionDocs = await Section.find({
            tenantId, sectionTeacher: teacherId, isActive: true,
        }).select('classId').lean();
        if (sectionDocs.length > 0) {
            const ids = [...new Set(sectionDocs.map(s => s.classId?.toString()).filter(Boolean))];
            const cls = await Class.find({ _id: { $in: ids }, tenantId }).select('grade').lean();
            cls.forEach(c => c.grade && classNames.add(c.grade));
        }

        // 3. TeacherSubjectAssignment
        const TSA = require('../models/TeacherSubjectAssignment');
        const tsaDocs = await TSA.find({ teacherId, tenantId, isActive: true }).select('classId').lean();
        if (tsaDocs.length > 0) {
            const ids = [...new Set(tsaDocs.map(a => a.classId?.toString()).filter(Boolean))];
            const cls = await Class.find({ _id: { $in: ids }, tenantId }).select('grade').lean();
            cls.forEach(c => c.grade && classNames.add(c.grade));
        }

        // 4. Legacy User.assignedClasses
        const teacher = await User.findById(teacherId).select('assignedClasses').lean();
        if (teacher && Array.isArray(teacher.assignedClasses)) {
            teacher.assignedClasses.forEach(c => c && classNames.add(c));
        }
    } catch (e) {
        console.warn('resolveTeacherClassNames error:', e.message);
    }
    return [...classNames];
}

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
router.get('/', protect, examPlanGates, [
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
            // Match by classId (preferred) OR class string for robustness
            const studentClassOr = [];
            if (req.user.classId) studentClassOr.push({ classId: req.user.classId });
            if (req.user.class) studentClassOr.push({ class: req.user.class });

            // Also look up the Class document to match by grade/name
            if (req.user.classId) {
                try {
                    const classDoc = await Class.findById(req.user.classId).select('grade name').lean();
                    if (classDoc) {
                        if (classDoc.grade) studentClassOr.push({ class: classDoc.grade });
                        if (classDoc.name && classDoc.name !== classDoc.grade) studentClassOr.push({ class: classDoc.name });
                    }
                } catch (_) { /* ignore */ }
            } else if (req.user.class) {
                try {
                    const classDoc = await Class.findOne({
                        tenantId: req.user.tenantId,
                        $or: [{ grade: req.user.class }, { name: req.user.class }]
                    }).select('_id grade name').lean();
                    if (classDoc) {
                        studentClassOr.push({ classId: classDoc._id });
                        if (classDoc.grade && classDoc.grade !== req.user.class) studentClassOr.push({ class: classDoc.grade });
                        if (classDoc.name && classDoc.name !== req.user.class) studentClassOr.push({ class: classDoc.name });
                    }
                } catch (_) { /* ignore */ }
            }

            if (studentClassOr.length > 0) {
                // Deduplicate and apply OR filter
                filter.$or = studentClassOr;
            } else {
                // Fallback: no class info on student, return nothing
                filter._id = null;
            }

            // Also filter by section if student has one
            if (req.user.section) {
                filter.$and = filter.$and || [];
                filter.$and.push({
                    $or: [
                        { section: req.user.section },
                        { section: { $exists: false } },
                        { section: null },
                        { section: '' }
                    ]
                });
            }
        } else if (req.user.role === 'teacher') {
            const teacherClassNames = await resolveTeacherClassNames(req.user._id, req.user.tenantId);
            if (teacherClassNames.length > 0) {
                filter.class = { $in: teacherClassNames };
            }
        }

        // Apply query param filters (skip class override for students — they use $or)
        if (req.query.class && req.user.role !== 'student') filter.class = req.query.class;
        if (req.query.subject) filter.subject = req.query.subject;
        if (req.query.section && req.user.role !== 'student') filter.section = req.query.section;
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
router.post('/', protect, examPlanGates, authorize('admin', 'teacher'), [
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
            const teacherClassNames = await resolveTeacherClassNames(req.user._id, req.user.tenantId);
            if (!teacherClassNames.includes(cls)) {
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
router.get('/result-card/:studentId', protect, examPlanGates, async (req, res) => {
    try {
        const { studentId } = req.params;
        const { examSeries, class: className } = req.query;

        // Build result filter
        const resultFilter = {
            tenantId: req.user.tenantId,
            student: studentId
        };

        // Students can only see their own published results
        if (req.user.role === 'student') {
            if (studentId !== req.user._id.toString()) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
            resultFilter.isPublished = true;
        }

        // Fetch all results for this student
        const results = await Result.find(resultFilter)
            .populate({
                path: 'exam',
                select: 'name subject class section date totalMarks passingMarks examSeries examType status'
            })
            .populate('student', 'name rollNumber admissionNumber class section photo skippedSubjects')
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

        // Exclude skipped (optional) subjects from results
        // Skipped subjects still have marks stored but are not displayed or calculated
        const studentDoc = results[0]?.student;
        const skippedSubjects = studentDoc?.skippedSubjects || [];
        if (skippedSubjects.length > 0) {
            filtered = filtered.filter(r =>
                !skippedSubjects.includes(r.exam.subject)
            );
        }

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

// @desc    Download report card PDF for a student
// @route   GET /api/exams/result-card/:studentId/pdf
// @access  Private
router.get('/result-card/:studentId/pdf', protect, examPlanGates, async (req, res) => {
    try {
        const { studentId } = req.params;
        const { examSeries, class: className } = req.query;

        // Build result filter
        const resultFilter = {
            tenantId: req.user.tenantId,
            student: studentId
        };

        if (req.user.role === 'student') {
            resultFilter.isPublished = true;
        }

        const results = await Result.find(resultFilter)
            .populate({
                path: 'exam',
                select: 'name subject class section date totalMarks passingMarks examSeries examType status'
            })
            .populate('student', 'name fullName rollNumber admissionNumber class section dateOfBirth fatherOrHusbandName guardianName photo skippedSubjects')
            .sort({ 'exam.date': 1 });

        if (!results.length) {
            return res.status(404).json({ success: false, message: 'No results found for this student' });
        }

        let filtered = results.filter(r => r.exam);
        if (examSeries) filtered = filtered.filter(r => r.exam.examSeries === examSeries);
        if (className) filtered = filtered.filter(r => r.exam.class === className);

        // Exclude skipped (optional) subjects from the PDF report card
        const pdfStudent = results[0]?.student;
        const pdfSkippedSubjects = pdfStudent?.skippedSubjects || [];
        if (pdfSkippedSubjects.length > 0) {
            filtered = filtered.filter(r =>
                !pdfSkippedSubjects.includes(r.exam.subject)
            );
        }

        if (!filtered.length) {
            return res.status(404).json({ success: false, message: 'No results found for the given filters' });
        }

        const subjects = filtered.map(r => ({
            name: r.exam.subject,
            subject: r.exam.subject,
            examName: r.exam.name,
            date: r.exam.date,
            totalMarks: r.exam.totalMarks,
            marksObtained: r.marksObtained,
            percentage: r.percentage,
            grade: r.grade,
            isPassed: r.isPassed,
            remarks: r.remarks || ''
        }));

        const grandTotal = subjects.reduce((acc, s) => acc + s.totalMarks, 0);
        const grandObtained = subjects.reduce((acc, s) => acc + s.marksObtained, 0);
        const overallPercentage = grandTotal > 0
            ? Math.round((grandObtained / grandTotal) * 100 * 10) / 10
            : 0;
        const overallGrade = calculateGrade(overallPercentage);
        const overallPassed = subjects.every(s => s.isPassed);
        const passCount = subjects.filter(s => s.isPassed).length;

        const student = results[0].student;

        // Get school settings
        const Settings = require('../models/Settings');
        const settings = await Settings.findOne({ tenantId: req.user.tenantId });
        const inst = settings?.institution || {};

        const addressParts = [inst.address?.street, inst.address?.city, inst.address?.state].filter(Boolean);

        const pdfData = {
            school: {
                name: inst.name || 'School',
                address: addressParts.join(', '),
                phone: inst.contact?.phone || '',
                email: inst.contact?.email || '',
                board: inst.board || '',
                affiliation: inst.affiliationNumber || '',
                schoolCode: inst.schoolCode || '',
                udise: inst.udiseCode || '',
                logo: inst.logo || null,
                brand_color: inst.brandColor || '#1E3A5F',
            },
            student: {
                name: student.fullName || student.name || '',
                admissionNumber: student.admissionNumber || '',
                class: student.class || filtered[0]?.exam?.class || '',
                section: student.section || filtered[0]?.exam?.section || '',
                rollNumber: student.rollNumber || '',
                dob: student.dateOfBirth || '',
                fatherOrHusbandName: student.fatherOrHusbandName || '',
                guardianName: student.guardianName || '',
            },
            exam: {
                type: examSeries || filtered[0]?.exam?.examSeries || 'Mid Term',
                academicYear: settings?.academicYear || '',
                date_issued: new Date().toISOString(),
            },
            subjects,
            summary: {
                grandTotal,
                grandObtained,
                overallPercentage,
                overallGrade,
                overallPassed,
                passCount,
                totalSubjects: subjects.length,
            },
            attendance: null,
            signatures: {
                principal: inst.principalSignature || null,
                class_teacher: null,
            },
        };

        const pdfService = require('../services/pdfService');
        const pdfBuffer = await pdfService.generateReportCard(pdfData);

        const filename = `Report_Card_${(student.name || 'Student').replace(/\s+/g, '_')}_${examSeries || 'All'}.pdf`;

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length,
        });

        res.send(pdfBuffer);
    } catch (error) {
        console.error('Generate report card PDF error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate report card PDF' });
    }
});

// @desc    Get logged-in student's published results
// @route   GET /api/exams/my-results
// @access  Private (Student)
router.get('/my-results', protect, examPlanGates, authorize('student'), async (req, res) => {
    try {
        const results = await Result.find({
            tenantId: req.user.tenantId,
            student: req.user._id,
            isPublished: true
        })
            .populate({
                path: 'exam',
                select: 'name subject class section date totalMarks passingMarks examSeries examType status'
            })
            .sort({ createdAt: -1 });

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Get my results error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Get exam details
// @route   GET /api/exams/:id
// @access  Private
router.get('/:id', protect, examPlanGates, async (req, res) => {
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
router.patch('/:id', protect, examPlanGates, authorize('admin', 'teacher'), async (req, res) => {
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
router.delete('/:id', protect, examPlanGates, authorize('admin', 'teacher'), async (req, res) => {
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
router.post('/:id/results', protect, examPlanGates, authorize('admin', 'teacher'), async (req, res) => {
    try {
        const exam = await Exam.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

        const resultsToProcess = req.body.results; // Array of { studentId, marks, remarks }

        if (!Array.isArray(resultsToProcess) || resultsToProcess.length === 0) {
            return res.status(400).json({ success: false, message: 'No results provided' });
        }

        // Pre-fetch skippedSubjects for all students in this batch
        // so we can reject marks entry for skipped optional subjects
        const studentIds = resultsToProcess.map(r => r.studentId).filter(Boolean);
        const studentsWithPrefs = await User.find({
            _id: { $in: studentIds },
            tenantId: req.user.tenantId
        }).select('_id skippedSubjects').lean();
        const skippedMap = {};
        studentsWithPrefs.forEach(s => {
            skippedMap[s._id.toString()] = s.skippedSubjects || [];
        });

        const processed = [];
        const errors = [];

        for (const item of resultsToProcess) {
            try {
                // Reject marks for subjects the student has opted out of
                const studentSkipped = skippedMap[item.studentId] || [];
                if (studentSkipped.includes(exam.subject)) {
                    errors.push({ studentId: item.studentId, error: `Subject "${exam.subject}" is skipped for this student` });
                    continue;
                }

                const marksObtained = Number(item.marks);

                // Validate marks don't exceed total
                if (marksObtained < 0 || marksObtained > exam.totalMarks) {
                    errors.push({ studentId: item.studentId, error: `Marks must be between 0 and ${exam.totalMarks}` });
                    continue;
                }

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
                        tenantId: req.user.tenantId,
                        updatedBy: req.user._id
                    },
                    { new: true, upsert: true, runValidators: true }
                );
                processed.push(result);
            } catch (err) {
                errors.push({ studentId: item.studentId, error: err.message });
            }
        }

        // Notify students about published results (fire-and-forget)
        if (processed.length > 0 && notificationService?.notifyResultsPublished) {
            const studentIds = processed.map(r => r.student);
            const students = await User.find({ _id: { $in: studentIds } }).select('_id name').lean();
            notificationService.notifyResultsPublished(exam, students, req.user.tenantId).catch(err => {
                console.warn('Exam result notification error:', err.message);
            });
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
router.get('/:id/results', protect, examPlanGates, async (req, res) => {
    try {
        const results = await Result.find({ exam: req.params.id, tenantId: req.user.tenantId })
            .populate('student', 'name rollNumber admissionNumber')
            .sort({ 'student.rollNumber': 1 });

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Publish/unpublish all results for an exam
// @route   PUT /api/exams/:id/results/publish
// @access  Private (Admin, Teacher)
router.put('/:id/results/publish', protect, examPlanGates, authorize('admin', 'teacher'), async (req, res) => {
    try {
        const exam = await Exam.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
        if (!exam) return res.status(404).json({ success: false, message: 'Exam not found' });

        const { isPublished } = req.body;
        if (typeof isPublished !== 'boolean') {
            return res.status(400).json({ success: false, message: 'isPublished must be a boolean' });
        }

        const updateData = {
            isPublished,
            updatedBy: req.user._id
        };
        if (isPublished) updateData.publishedAt = new Date();

        const result = await Result.updateMany(
            { exam: req.params.id, tenantId: req.user.tenantId },
            updateData
        );

        // Notify students when results are published
        if (isPublished && result.modifiedCount > 0 && notificationService?.notifyResultsPublished) {
            const results = await Result.find({ exam: req.params.id, tenantId: req.user.tenantId }).select('student').lean();
            const studentIds = results.map(r => r.student);
            const students = await User.find({ _id: { $in: studentIds } }).select('_id name').lean();
            notificationService.notifyResultsPublished(exam, students, req.user.tenantId).catch(err => {
                console.warn('Exam result notification error:', err.message);
            });
        }

        res.json({
            success: true,
            message: `Results ${isPublished ? 'published' : 'unpublished'} successfully`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Publish results error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
