const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const StudentList = require('../models/StudentList');
const User = require('../models/User');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Utility to find students by admission numbers
const findStudentsByAdmissionNumbers = async (admissionNumbers, tenantId) => {
    // Find all students matching the admission numbers for this tenant
    const students = await User.find({
        admissionNumber: { $in: admissionNumbers },
        tenantId: tenantId,
        role: 'student'
    }).select('_id admissionNumber name fullName class section phone');

    const foundAdmissionNumbers = students.map(s => s.admissionNumber);
    const notFoundNumbers = admissionNumbers.filter(num => !foundAdmissionNumbers.includes(num));

    return { students, notFoundNumbers };
};

// @desc    Create a new student list
// @route   POST /api/student-lists
// @access  Private
router.post('/', protect, async (req, res) => {
    try {
        const { name, description, admissionNumbers } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'List name is required' });
        }

        let studentIds = [];
        let notFound = [];

        if (admissionNumbers && Array.isArray(admissionNumbers) && admissionNumbers.length > 0) {
            const { students, notFoundNumbers } = await findStudentsByAdmissionNumbers(admissionNumbers, req.user.tenantId);
            studentIds = students.map(s => s._id);
            notFound = notFoundNumbers;
        }

        const newList = await StudentList.create({
            name,
            description,
            students: studentIds,
            tenantId: req.user.tenantId,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            message: 'Student list created successfully',
            data: newList,
            warnings: notFound.length > 0 ? `Could not find students with admission numbers: ${notFound.join(', ')}` : null,
            notFoundNumbers: notFound
        });
    } catch (error) {
        console.error('Create student list error:', error);
        res.status(500).json({ success: false, message: 'Server error while creating student list' });
    }
});

// @desc    Get all student lists for the tenant
// @route   GET /api/student-lists
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const lists = await StudentList.find({ tenantId: req.user.tenantId })
            .select('-students') // Exclude heavy student array for the listing
            .sort({ createdAt: -1 });

        // We also need student counts, but since we didn't populate, let's just get the lengths or we can aggregate
        const listsWithCounts = await StudentList.aggregate([
            { $match: { tenantId: req.user.tenantId } },
            {
                $project: {
                    name: 1,
                    description: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    studentCount: { $size: { $ifNull: ['$students', []] } }
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        res.json({
            success: true,
            data: listsWithCounts
        });
    } catch (error) {
        console.error('Get student lists error:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching student lists' });
    }
});

// @desc    Get a single student list with populated students
// @route   GET /api/student-lists/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
    try {
        const list = await StudentList.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
            .populate('students', 'admissionNumber name fullName class section phone rollNumber email');

        if (!list) {
            return res.status(404).json({ success: false, message: 'Student list not found' });
        }

        res.json({
            success: true,
            data: list
        });
    } catch (error) {
        console.error('Get single student list error:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching student list' });
    }
});

// @desc    Add more students to a list
// @route   PATCH /api/student-lists/:id/add-students
// @access  Private
router.patch('/:id/add-students', protect, async (req, res) => {
    try {
        const { admissionNumbers } = req.body;

        if (!admissionNumbers || !Array.isArray(admissionNumbers) || admissionNumbers.length === 0) {
            return res.status(400).json({ success: false, message: 'Please provide admission numbers to add' });
        }

        const list = await StudentList.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
        if (!list) {
            return res.status(404).json({ success: false, message: 'Student list not found' });
        }

        const { students, notFoundNumbers } = await findStudentsByAdmissionNumbers(admissionNumbers, req.user.tenantId);
        const newStudentIds = students.map(s => s._id.toString());

        // Filter out students already in the list
        const existingIds = list.students.map(id => id.toString());
        const idsToAdd = newStudentIds.filter(id => !existingIds.includes(id));

        if (idsToAdd.length > 0) {
            list.students.push(...idsToAdd);
            await list.save();
        }

        res.json({
            success: true,
            message: `${idsToAdd.length} students added to the list`,
            warnings: notFoundNumbers.length > 0 ? `Could not find admission numbers: ${notFoundNumbers.join(', ')}` : null,
            notFoundNumbers
        });
    } catch (error) {
        console.error('Add students to list error:', error);
        res.status(500).json({ success: false, message: 'Server error while adding students' });
    }
});

// @desc    Remove a student from a list
// @route   PATCH /api/student-lists/:id/remove-student/:studentId
// @access  Private
router.patch('/:id/remove-student/:studentId', protect, async (req, res) => {
    try {
        const { id, studentId } = req.params;

        const list = await StudentList.findOne({ _id: id, tenantId: req.user.tenantId });
        if (!list) {
            return res.status(404).json({ success: false, message: 'Student list not found' });
        }

        list.students = list.students.filter(sId => sId.toString() !== studentId.toString());
        await list.save();

        res.json({
            success: true,
            message: 'Student removed from list'
        });
    } catch (error) {
        console.error('Remove student from list error:', error);
        res.status(500).json({ success: false, message: 'Server error while removing student' });
    }
});

// @desc    Delete a student list
// @route   DELETE /api/student-lists/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
    try {
        const list = await StudentList.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });

        if (!list) {
            return res.status(404).json({ success: false, message: 'Student list not found' });
        }

        res.json({
            success: true,
            message: 'Student list deleted successfully'
        });
    } catch (error) {
        console.error('Delete student list error:', error);
        res.status(500).json({ success: false, message: 'Server error while deleting student list' });
    }
});

// ==========================================
// EXPORT ENDPOINTS
// ==========================================

// Helper to get list with students
const getExportData = async (listId, tenantId) => {
    const list = await StudentList.findOne({ _id: listId, tenantId })
        .populate('students', 'admissionNumber name fullName class section phone');
    if (!list) throw new Error('List not found');
    return list;
};

// @desc    Export list as PDF
// @route   GET /api/student-lists/:id/export/pdf
// @access  Private
router.get('/:id/export/pdf', protect, async (req, res) => {
    try {
        const list = await getExportData(req.params.id, req.user.tenantId);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${list.name.replace(/\\s+/g, '_')}_List.pdf"`);

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        doc.pipe(res);

        // Header
        doc.fontSize(20).text(list.name, { align: 'center' });
        if (list.description) {
            doc.fontSize(12).text(list.description, { align: 'center' });
        }
        doc.moveDown(1);
        doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'right' });
        doc.moveDown(1);

        // Table settings
        const tableTop = doc.y;
        const colWidths = [40, 90, 180, 80, 120];
        const colPositions = [30, 70, 160, 340, 420];
        const headers = ['S.No', 'Admission No', 'Student Name', 'Class/Sec', 'Phone'];

        // Draw Headers
        doc.font('Helvetica-Bold').fontSize(10);
        headers.forEach((header, i) => {
            doc.text(header, colPositions[i], tableTop);
        });

        doc.moveTo(30, tableTop + 15).lineTo(560, tableTop + 15).stroke();

        let y = tableTop + 20;

        // Draw Rows
        doc.font('Helvetica').fontSize(10);
        list.students.forEach((student, index) => {
            if (y > 750) {
                doc.addPage();
                y = 30; // reset y for new page
            }

            const classSec = `${student.class || 'N/A'} ${student.section ? '- ' + student.section : ''}`;

            doc.text((index + 1).toString(), colPositions[0], y);
            doc.text(student.admissionNumber || '-', colPositions[1], y);
            doc.text(student.fullName || student.name || '-', colPositions[2], y, { width: 170 });
            doc.text(classSec, colPositions[3], y);
            doc.text(student.phone || '-', colPositions[4], y);

            doc.moveTo(30, y + 15).lineTo(560, y + 15).strokeColor('#e5e7eb').stroke();
            y += 20;
        });

        doc.end();
    } catch (error) {
        console.error('PDF export error:', error);
        res.status(error.message === 'List not found' ? 404 : 500).json({ success: false, message: error.message });
    }
});

// @desc    Export list as Excel
// @route   GET /api/student-lists/:id/export/excel
// @access  Private
router.get('/:id/export/excel', protect, async (req, res) => {
    try {
        const list = await getExportData(req.params.id, req.user.tenantId);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Students');

        worksheet.columns = [
            { header: 'S.No', key: 'sno', width: 10 },
            { header: 'Admission No', key: 'admissionNo', width: 20 },
            { header: 'Student Name', key: 'name', width: 30 },
            { header: 'Class', key: 'class', width: 15 },
            { header: 'Section', key: 'section', width: 15 },
            { header: 'Phone', key: 'phone', width: 20 },
        ];

        worksheet.getRow(1).font = { bold: true };

        list.students.forEach((student, index) => {
            worksheet.addRow({
                sno: index + 1,
                admissionNo: student.admissionNumber || '-',
                name: student.fullName || student.name || '-',
                class: student.class || '-',
                section: student.section || '-',
                phone: student.phone || '-'
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${list.name.replace(/\\s+/g, '_')}_List.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Excel export error:', error);
        res.status(error.message === 'List not found' ? 404 : 500).json({ success: false, message: error.message });
    }
});

// @desc    Export list as CSV
// @route   GET /api/student-lists/:id/export/csv
// @access  Private
router.get('/:id/export/csv', protect, async (req, res) => {
    try {
        const list = await getExportData(req.params.id, req.user.tenantId);

        const headers = ['S.No', 'Admission No', 'Student Name', 'Class', 'Section', 'Phone'];
        const rows = list.students.map((s, i) => {
            return [
                i + 1,
                `"${s.admissionNumber || '-'}"`,
                `"${s.fullName || s.name || '-'}"`,
                `"${s.class || '-'}"`,
                `"${s.section || '-'}"`,
                `"${s.phone || '-'}"`
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${list.name.replace(/\\s+/g, '_')}_List.csv"`);
        res.send(csvContent);
    } catch (error) {
        console.error('CSV export error:', error);
        res.status(error.message === 'List not found' ? 404 : 500).json({ success: false, message: error.message });
    }
});

// @desc    Export list as TXT
// @route   GET /api/student-lists/:id/export/txt
// @access  Private
router.get('/:id/export/txt', protect, async (req, res) => {
    try {
        const list = await getExportData(req.params.id, req.user.tenantId);

        const headers = ['S.No', 'Admission No', 'Student Name', 'Class', 'Section', 'Phone'].join('\t');
        const rows = list.students.map((s, i) => {
            return [
                i + 1,
                s.admissionNumber || '-',
                s.fullName || s.name || '-',
                s.class || '-',
                s.section || '-',
                s.phone || '-'
            ].join('\t');
        });

        const txtContent = [`${list.name}\n${'-'.repeat(50)}\n`, headers, ...rows].join('\n');

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${list.name.replace(/\\s+/g, '_')}_List.txt"`);
        res.send(txtContent);
    } catch (error) {
        console.error('TXT export error:', error);
        res.status(error.message === 'List not found' ? 404 : 500).json({ success: false, message: error.message });
    }
});

module.exports = router;
