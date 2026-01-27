const express = require('express');
const { body, query } = require('express-validator');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const StudentBalance = require('../models/StudentBalance');
const FeeAuditLog = require('../models/FeeAuditLog');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @desc    Generate invoice for student
// @route   POST /api/invoices/generate
// @access  Private (Admin, Accountant)
router.post('/generate', protect, authorize('admin', 'accountant'), [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('academicSessionId').notEmpty().withMessage('Academic Session ID is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one fee item is required'),
    body('dueDate').isISO8601().withMessage('Valid due date is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { studentId, academicSessionId, items, dueDate, feeStructureId, remarks } = req.body;

        // Verify student exists
        const student = await User.findOne({
            _id: studentId,
            tenantId: req.user.tenantId,
            role: 'student'
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Calculate total
        const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

        // Generate invoice number
        const invoiceNumber = await FeeInvoice.generateInvoiceNumber(req.user.tenantId);

        // Create invoice
        const invoice = await FeeInvoice.create({
            tenantId: req.user.tenantId,
            invoiceNumber,
            studentId,
            classId: student.classId,
            sectionId: student.sectionId,
            academicSessionId,
            feeStructureId,
            items,
            totalAmount,
            balanceAmount: totalAmount,
            dueDate,
            remarks,
            generatedBy: req.user._id
        });

        // Log action
        await FeeAuditLog.logAction({
            tenantId: req.user.tenantId,
            action: 'INVOICE_GENERATED',
            entityType: 'FeeInvoice',
            entityId: invoice._id,
            userId: req.user._id,
            userName: req.user.name,
            userRole: req.user.role,
            details: {
                studentId,
                studentName: student.name,
                invoiceNumber,
                totalAmount
            },
            ipAddress: req.ip
        });

        // Update student balance
        await StudentBalance.updateBalance(req.user.tenantId, studentId, academicSessionId);

        const populated = await FeeInvoice.findById(invoice._id)
            .populate('studentId', 'name studentId phone email')
            .populate('classId', 'name grade')
            .populate('sectionId', 'name')
            .populate('academicSessionId', 'name');

        res.status(201).json({
            success: true,
            message: 'Invoice generated successfully',
            data: populated
        });
    } catch (error) {
        console.error('Generate invoice error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while generating invoice'
        });
    }
});

// @desc    Bulk generate invoices for class
// @route   POST /api/invoices/generate-bulk
// @access  Private (Admin)
router.post('/generate-bulk', protect, authorize('admin'), [
    body('classId').notEmpty().withMessage('Class ID is required'),
    body('academicSessionId').notEmpty().withMessage('Academic Session ID is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one fee item is required'),
    body('dueDate').isISO8601().withMessage('Valid due date is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { classId, sectionId, academicSessionId, items, dueDate, feeStructureId } = req.body;

        // Get all students in class/section
        const query = {
            tenantId: req.user.tenantId,
            role: 'student',
            classId,
            isActive: true
        };

        if (sectionId) {
            query.sectionId = sectionId;
        }

        const students = await User.find(query);

        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No students found in the specified class/section'
            });
        }

        const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
        const results = [];
        const errors = [];

        for (const student of students) {
            try {
                const invoiceNumber = await FeeInvoice.generateInvoiceNumber(req.user.tenantId);

                const invoice = await FeeInvoice.create({
                    tenantId: req.user.tenantId,
                    invoiceNumber,
                    studentId: student._id,
                    classId: student.classId,
                    sectionId: student.sectionId,
                    academicSessionId,
                    feeStructureId,
                    items,
                    totalAmount,
                    balanceAmount: totalAmount,
                    dueDate,
                    generatedBy: req.user._id
                });

                results.push(invoice);

                // Update balance
                await StudentBalance.updateBalance(req.user.tenantId, student._id, academicSessionId);
            } catch (error) {
                errors.push({
                    studentId: student._id,
                    studentName: student.name,
                    error: error.message
                });
            }
        }

        // Log bulk action
        await FeeAuditLog.logAction({
            tenantId: req.user.tenantId,
            action: 'INVOICE_BULK_GENERATED',
            entityType: 'FeeInvoice',
            entityId: null,
            userId: req.user._id,
            userName: req.user.name,
            userRole: req.user.role,
            details: {
                classId,
                sectionId,
                totalStudents: students.length,
                successCount: results.length,
                errorCount: errors.length
            },
            ipAddress: req.ip
        });

        res.status(201).json({
            success: true,
            message: `Generated ${results.length} invoices successfully`,
            data: {
                generated: results.length,
                errors: errors.length,
                errorDetails: errors
            }
        });
    } catch (error) {
        console.error('Bulk generate error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while generating bulk invoices'
        });
    }
});

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private (Admin, Accountant)
router.get('/', protect, authorize('admin', 'accountant'), async (req, res) => {
    try {
        const { studentId, classId, status, academicSessionId, startDate, endDate } = req.query;
        const filter = { tenantId: req.user.tenantId };

        if (studentId) filter.studentId = studentId;
        if (classId) filter.classId = classId;
        if (status) filter.status = status;
        if (academicSessionId) filter.academicSessionId = academicSessionId;

        if (startDate || endDate) {
            filter.issuedDate = {};
            if (startDate) filter.issuedDate.$gte = new Date(startDate);
            if (endDate) filter.issuedDate.$lte = new Date(endDate);
        }

        const invoices = await FeeInvoice.find(filter)
            .populate('studentId', 'name studentId phone email')
            .populate('classId', 'name grade')
            .populate('sectionId', 'name')
            .populate('academicSessionId', 'name')
            .sort({ issuedDate: -1 })
            .limit(100);

        res.json({
            success: true,
            data: invoices
        });
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching invoices'
        });
    }
});

// @desc    Get student's invoices
// @route   GET /api/invoices/student/:studentId
// @access  Private (Admin, Accountant)
router.get('/student/:studentId', protect, authorize('admin', 'accountant'), async (req, res) => {
    try {
        const invoices = await FeeInvoice.find({
            tenantId: req.user.tenantId,
            studentId: req.params.studentId
        })
            .populate('academicSessionId', 'name')
            .sort({ issuedDate: -1 });

        res.json({
            success: true,
            data: invoices
        });
    } catch (error) {
        console.error('Get student invoices error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching student invoices'
        });
    }
});

// @desc    Apply late fee to invoice
// @route   PUT /api/invoices/:id/apply-late-fee
// @access  Private (Admin, Accountant)
router.put('/:id/apply-late-fee', protect, authorize('admin', 'accountant'), [
    body('amount').isNumeric().withMessage('Late fee amount is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { amount } = req.body;

        const invoice = await FeeInvoice.findById(req.params.id);

        if (!invoice || invoice.tenantId.toString() !== req.user.tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        if (invoice.status === 'Paid') {
            return res.status(400).json({
                success: false,
                message: 'Cannot apply late fee to paid invoice'
            });
        }

        await invoice.applyLateFee(amount);

        // Log action
        await FeeAuditLog.logAction({
            tenantId: req.user.tenantId,
            action: 'LATE_FEE_APPLIED',
            entityType: 'FeeInvoice',
            entityId: invoice._id,
            userId: req.user._id,
            userName: req.user.name,
            userRole: req.user.role,
            details: {
                invoiceNumber: invoice.invoiceNumber,
                lateFeeAmount: amount
            },
            ipAddress: req.ip
        });

        // Update balance
        await StudentBalance.updateBalance(req.user.tenantId, invoice.studentId, invoice.academicSessionId);

        res.json({
            success: true,
            message: 'Late fee applied successfully',
            data: invoice
        });
    } catch (error) {
        console.error('Apply late fee error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while applying late fee'
        });
    }
});

module.exports = router;
