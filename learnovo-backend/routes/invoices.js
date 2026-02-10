const express = require('express');
const { body, query } = require('express-validator');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const StudentBalance = require('../models/StudentBalance');
const FeeAuditLog = require('../models/FeeAuditLog');
const Settings = require('../models/Settings');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// @desc    Generate invoice for student
// @route   POST /api/invoices/generate
// @access  Private (Admin, Accountant)
router.post('/generate', protect, authorize('admin', 'accountant'), [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('academicSessionId').notEmpty().withMessage('Academic Session ID is required'),
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

        // Determine invoice items
        let invoiceItems = items;

        // If feeStructureId is provided but no items, fetch fee structure and convert feeHeads to items
        if (feeStructureId && (!items || items.length === 0)) {
            const FeeStructure = require('../models/FeeStructure');
            const feeStructure = await FeeStructure.findOne({
                _id: feeStructureId,
                tenantId: req.user.tenantId
            });

            if (!feeStructure) {
                return res.status(404).json({
                    success: false,
                    message: 'Fee structure not found'
                });
            }

            // Convert feeHeads to items format
            invoiceItems = feeStructure.feeHeads.map(head => {
                // Capitalize frequency to match FeeInvoice enum
                let frequency = head.frequency || 'one-time';
                if (frequency === 'monthly') frequency = 'Monthly';
                else if (frequency === 'quarterly') frequency = 'Quarterly';
                else if (frequency === 'one-time') frequency = 'One-time';
                else if (frequency === 'annual') frequency = 'Annual';

                return {
                    feeHeadName: head.name,
                    amount: head.amount,
                    frequency: frequency
                };
            });
        }

        // Validate that we have items
        if (!invoiceItems || invoiceItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one fee item is required. Please provide either items array or feeStructureId.'
            });
        }

        // Calculate total
        const totalAmount = invoiceItems.reduce((sum, item) => sum + item.amount, 0);

        // Generate invoice number
        const invoiceNumber = await FeeInvoice.generateInvoiceNumber(req.user.tenantId);

        // Determine classId - use student's classId or find from class name
        let studentClassId = student.classId;
        if (!studentClassId && student.class) {
            const Class = require('../models/Class');
            const classDoc = await Class.findOne({
                name: student.class,
                tenantId: req.user.tenantId
            });

            // Also try matching by grade number
            if (!classDoc) {
                const classList = await Class.find({ tenantId: req.user.tenantId });
                const matchedClass = classList.find(c => {
                    const gradeMatch = c.name.match(/(\d+)/);
                    return gradeMatch && gradeMatch[1] === student.class;
                });
                if (matchedClass) {
                    studentClassId = matchedClass._id;
                }
            } else {
                studentClassId = classDoc._id;
            }
        }

        if (!studentClassId) {
            return res.status(400).json({
                success: false,
                message: 'Unable to determine student class. Please update student record.'
            });
        }

        // Use provided billing period or calculate it
        let billingPeriod = req.body.billingPeriod;
        if (!billingPeriod || !billingPeriod.displayText) {
            // Fallback: Calculate period if not provided
            const primaryFrequency = invoiceItems[0]?.frequency || 'One-time';
            billingPeriod = FeeInvoice.calculateBillingPeriod(new Date(), primaryFrequency);
        }

        // Create invoice
        const invoice = await FeeInvoice.create({
            tenantId: req.user.tenantId,
            invoiceNumber,
            studentId,
            classId: studentClassId,
            sectionId: student.sectionId || null,
            academicSessionId,
            feeStructureId,
            items: invoiceItems,
            totalAmount,
            balanceAmount: totalAmount,
            dueDate,
            billingPeriod,
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
            .populate('studentId', 'name studentId admissionNumber phone email')
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
    body('dueDate').isISO8601().withMessage('Valid due date is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { classId, sectionId, academicSessionId, items, dueDate, feeStructureId } = req.body;

        console.log('\n=== BULK INVOICE DEBUG ===');
        console.log('classId:', classId);
        console.log('sectionId:', sectionId);
        console.log('tenantId:', req.user.tenantId);

        // Get all students in class/section
        // Support both classId (ObjectId) and class (string) fields
        // Try to find students by classId first, then fall back to finding by class name
        const query = {
            tenantId: req.user.tenantId,
            role: 'student',
            isActive: true
        };

        // Build $or condition to support both classId and class string
        const classConditions = [{ classId: classId }];

        // Try to get class name from Class model for string matching
        try {
            const Class = require('../models/Class');
            const classDoc = await Class.findOne({
                _id: classId,
                tenantId: req.user.tenantId
            });

            console.log('Class found:', classDoc ? `${classDoc.name} (${classDoc._id})` : 'NOT FOUND');

            if (classDoc && classDoc.name) {
                classConditions.push({ class: classDoc.name });

                // Extract grade number (e.g., "Class 1" -> "1")
                const gradeMatch = classDoc.name.match(/(\d+)/);
                if (gradeMatch) {
                    classConditions.push({ class: gradeMatch[1] });
                    console.log('Added grade number condition:', gradeMatch[1]);
                }
            }
        } catch (error) {
            console.log('Could not fetch class document, will query by classId only:', error.message);
        }

        query.$or = classConditions;

        if (sectionId) {
            query.sectionId = sectionId;
        }

        console.log('Bulk invoice query:', JSON.stringify(query, null, 2));
        const students = await User.find(query);
        console.log(`Found ${students.length} students`);
        if (students.length > 0) {
            console.log('Sample student:', { name: students[0].name, class: students[0].class, classId: students[0].classId });
        }
        console.log('=== END DEBUG ===\n');

        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No students found in the specified class/section'
            });
        }

        // Determine invoice items
        let invoiceItems = items;

        // If feeStructureId is provided but no items, fetch fee structure and convert feeHeads to items
        if (feeStructureId && (!items || items.length === 0)) {
            const FeeStructure = require('../models/FeeStructure');
            const feeStructure = await FeeStructure.findOne({
                _id: feeStructureId,
                tenantId: req.user.tenantId
            });

            if (!feeStructure) {
                return res.status(404).json({
                    success: false,
                    message: 'Fee structure not found'
                });
            }

            // Convert feeHeads to items format
            invoiceItems = feeStructure.feeHeads.map(head => {
                // Capitalize frequency to match FeeInvoice enum
                let frequency = head.frequency || 'one-time';
                if (frequency === 'monthly') frequency = 'Monthly';
                else if (frequency === 'quarterly') frequency = 'Quarterly';
                else if (frequency === 'one-time') frequency = 'One-time';
                else if (frequency === 'annual') frequency = 'Annual';

                return {
                    feeHeadName: head.name,
                    amount: head.amount,
                    frequency: frequency
                };
            });
        }

        // Validate that we have items
        if (!invoiceItems || invoiceItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one fee item is required. Please provide either items array or feeStructureId.'
            });
        }

        const totalAmount = invoiceItems.reduce((sum, item) => sum + item.amount, 0);
        const results = [];
        const errors = [];

        for (const student of students) {
            try {
                const invoiceNumber = await FeeInvoice.generateInvoiceNumber(req.user.tenantId);

                // Determine classId - use student's classId or find from class name
                let studentClassId = student.classId;
                if (!studentClassId && student.class) {
                    // Try to find classId from class name
                    const Class = require('../models/Class');
                    const classDoc = await Class.findOne({
                        name: student.class,
                        tenantId: req.user.tenantId
                    });
                    if (classDoc) {
                        studentClassId = classDoc._id;
                    }
                }

                // If still no classId, use the provided classId from request
                if (!studentClassId) {
                    studentClassId = classId;
                }

                // Use provided billing period or calculate it
                let billingPeriod = req.body.billingPeriod;
                if (!billingPeriod || !billingPeriod.displayText) {
                    // Fallback: Calculate period if not provided
                    const primaryFrequency = invoiceItems[0]?.frequency || 'One-time';
                    billingPeriod = FeeInvoice.calculateBillingPeriod(new Date(), primaryFrequency);
                }

                const invoice = await FeeInvoice.create({
                    tenantId: req.user.tenantId,
                    invoiceNumber,
                    studentId: student._id,
                    classId: studentClassId,
                    sectionId: student.sectionId || null,
                    academicSessionId,
                    feeStructureId,
                    items: invoiceItems,
                    totalAmount,
                    balanceAmount: totalAmount,
                    dueDate,
                    billingPeriod,
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

// @desc    Update invoice
// @route   PUT /api/invoices/:id
// @access  Private (Admin, Accountant)
router.put('/:id', protect, authorize('admin', 'accountant'), [
    body('items').isArray({ min: 1 }).withMessage('Items array is required'),
    body('items.*.feeHeadName').notEmpty().withMessage('Item name is required'),
    body('items.*.amount').isNumeric().toFloat().withMessage('Item amount is required'),
    body('dueDate').isISO8601().withMessage('Valid due date is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { items, dueDate, remarks } = req.body;
        const tenantId = req.user.tenantId;

        const invoice = await FeeInvoice.findById(req.params.id);

        if (!invoice || invoice.tenantId.toString() !== tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        // Calculate new total
        const newTotal = items.reduce((sum, item) => sum + item.amount, 0);

        // Validate constraint: Cannot reduce total below paid amount
        if (newTotal < invoice.paidAmount) {
            return res.status(400).json({
                success: false,
                message: `New total (${newTotal}) cannot be less than already paid amount (${invoice.paidAmount})`
            });
        }

        // Prepare items with correct frequency (defaulting if missing)
        const updatedItems = items.map(item => ({
            feeHeadName: item.feeHeadName,
            amount: item.amount,
            frequency: item.frequency || 'One-time'
        }));

        // Update fields
        const oldTotal = invoice.totalAmount;
        invoice.items = updatedItems;
        invoice.totalAmount = newTotal;
        invoice.dueDate = dueDate;
        invoice.remarks = remarks;

        // Recalculate balance and status handled by pre-save hook
        // But explicitly ensuring fields are marked modified if needed
        invoice.markModified('items');

        await invoice.save();

        // Log action
        await FeeAuditLog.logAction({
            tenantId,
            action: 'INVOICE_UPDATED',
            entityType: 'FeeInvoice',
            entityId: invoice._id,
            userId: req.user._id,
            userName: req.user.name,
            userRole: req.user.role,
            details: {
                invoiceNumber: invoice.invoiceNumber,
                oldTotal,
                newTotal,
                itemsCount: updatedItems.length
            },
            ipAddress: req.ip
        });

        // Update student balance
        await StudentBalance.updateBalance(tenantId, invoice.studentId, invoice.academicSessionId);

        const updatedInvoice = await FeeInvoice.findById(invoice._id)
            .populate('studentId', 'name fullName studentId admissionNumber phone email')
            .populate('classId', 'name grade')
            .populate('sectionId', 'name')
            .populate('academicSessionId', 'name');

        res.json({
            success: true,
            message: 'Invoice updated successfully',
            data: updatedInvoice
        });

    } catch (error) {
        console.error('Update invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating invoice'
        });
    }
});

// @desc    Delete invoice
// @route   DELETE /api/invoices/:id
// @access  Private (Admin, Accountant)
router.delete('/:id', protect, authorize('admin', 'accountant'), async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const invoice = await FeeInvoice.findById(req.params.id);

        if (!invoice || invoice.tenantId.toString() !== tenantId.toString()) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        // Validate constraint: Cannot delete if any payment is made
        if (invoice.paidAmount > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete invoice with associated payments. Please reverse payments first.'
            });
        }

        const { studentId, academicSessionId, invoiceNumber, totalAmount } = invoice;

        // Delete invoice
        await FeeInvoice.findByIdAndDelete(req.params.id);

        // Log action (using INVOICE_CANCELLED as equivalent to deletion for audit)
        await FeeAuditLog.logAction({
            tenantId,
            action: 'INVOICE_CANCELLED',
            entityType: 'FeeInvoice',
            entityId: invoice._id,
            userId: req.user._id,
            userName: req.user.name,
            userRole: req.user.role,
            details: {
                invoiceNumber,
                totalAmount,
                reason: 'Deleted by user'
            },
            ipAddress: req.ip
        });

        // Update student balance
        await StudentBalance.updateBalance(tenantId, studentId, academicSessionId);

        res.json({
            success: true,
            message: 'Invoice deleted successfully'
        });

    } catch (error) {
        console.error('Delete invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting invoice'
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


// @desc    Collect payment for invoice
// @route   POST /api/invoices/collect-payment
// @access  Private (Admin, Accountant)
router.post('/collect-payment', protect, authorize('admin', 'accountant'), [
    body('studentId').notEmpty().withMessage('Student ID is required'),
    body('invoiceId').notEmpty().withMessage('Invoice ID is required'),
    body('amount').isNumeric().toFloat().withMessage('Valid amount is required'),
    body('paymentMethod').notEmpty().withMessage('Payment method is required'),
    body('paymentDate').isISO8601().withMessage('Valid payment date is required'),
    handleValidationErrors
], async (req, res) => {
    try {
        const { studentId, invoiceId, amount, paymentMethod, paymentDate, transactionDetails, remarks } = req.body;
        const tenantId = req.user.tenantId;

        // Verify invoice exists
        const invoice = await FeeInvoice.findOne({
            _id: invoiceId,
            tenantId
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        // Check if amount exceeds balance + buffer? No, strict check for now.
        // Actually, sometimes people pay more. But let's stick to balance for safety.
        if (amount > invoice.balanceAmount) {
            return res.status(400).json({
                success: false,
                message: `Amount exceeds pending balance of ${invoice.balanceAmount}`
            });
        }

        // Generate receipt number
        const receiptNumber = await Payment.generateReceiptNumber(tenantId);

        // Create Payment
        const payment = new Payment({
            tenantId,
            studentId,
            invoiceId,
            amount,
            paymentMethod,
            paymentDate: new Date(paymentDate),
            transactionDetails,
            remarks,
            receiptNumber,
            isConfirmed: true, // Auto-confirm direct collection
            confirmedAt: new Date(),
            confirmedBy: req.user._id,
            collectedBy: req.user._id
        });

        await payment.save();

        // Update Invoice
        invoice.paidAmount += amount;

        // Recalculate balance to be safe
        invoice.balanceAmount = invoice.totalAmount - invoice.paidAmount;

        // Update status
        if (invoice.balanceAmount <= 0) {
            invoice.status = 'Paid';
            invoice.balanceAmount = 0; // Ensure no negative balance
        } else {
            invoice.status = 'Partial';
        }

        await invoice.save();

        res.json({
            success: true,
            message: 'Payment collected successfully',
            data: {
                payment,
                invoice
            }
        });

    } catch (error) {
        console.error('Collect payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while collecting payment'
        });
    }
});

// @desc    Get payments list
// @route   GET /api/invoices/payments
// @access  Private
router.get('/payments', protect, async (req, res) => {
    try {
        const { studentId, invoiceId, startDate, endDate, paymentMethod } = req.query;
        const tenantId = req.user.tenantId;

        const filter = { tenantId };

        if (studentId) filter.studentId = studentId;
        if (invoiceId) filter.invoiceId = invoiceId;
        if (paymentMethod) filter.paymentMethod = paymentMethod;

        if (startDate || endDate) {
            filter.paymentDate = {};
            if (startDate) filter.paymentDate.$gte = new Date(startDate);
            if (endDate) filter.paymentDate.$lte = new Date(endDate);
        }

        const payments = await Payment.find(filter)
            .populate('studentId', 'name fullName admissionNumber studentId')
            .populate('invoiceId', 'invoiceNumber')
            .populate('collectedBy', 'name')
            .sort({ paymentDate: -1, createdAt: -1 })
            .limit(100);

        res.json({
            success: true,
            data: payments
        });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching payments'
        });
    }
});


// @desc    Get payment receipt details
// @route   GET /api/invoices/payments/:id/receipt
// @access  Private
router.get('/payments/:id/receipt', protect, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const payment = await Payment.findOne({ _id: id, tenantId })
            .populate({
                path: 'studentId',
                select: 'name fullName admissionNumber studentId class section parentName address phone email classId',
                populate: { path: 'classId', select: 'name' }
            })
            .populate('invoiceId')
            .populate('collectedBy', 'name');

        if (!payment) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        const tenant = await Tenant.findById(tenantId).select('schoolName schoolCode address phone email logo fullAddress website');
        const settings = await Settings.getSettings(tenantId);

        const schoolData = tenant.toObject();
        if (settings && settings.institution) {
            // Add contact information
            if (settings.institution.contact) {
                if (settings.institution.contact.phone) schoolData.phone = settings.institution.contact.phone;
                if (settings.institution.contact.email) schoolData.email = settings.institution.contact.email;
            }
            // Add school code, affiliation number, and UDISE code from Settings
            if (settings.institution.schoolCode) schoolData.schoolCode = settings.institution.schoolCode;
            if (settings.institution.affiliationNumber) schoolData.affiliationNumber = settings.institution.affiliationNumber;
            if (settings.institution.udiseCode) schoolData.udiseCode = settings.institution.udiseCode;
            // Add principal signature
            if (settings.institution.principalSignature) schoolData.principalSignature = settings.institution.principalSignature;
        }

        // Fallback: Calculate billing period for old invoices that don't have it
        if (payment.invoiceId && !payment.invoiceId.billingPeriod?.displayText) {
            // Get the primary fee frequency from invoice items
            const primaryFrequency = payment.invoiceId.items?.[0]?.frequency || 'One-time';
            // Calculate period based on payment date
            const calculatedPeriod = FeeInvoice.calculateBillingPeriod(payment.paymentDate, primaryFrequency);
            // Add it to the invoice object (not saved to DB, just for this response)
            payment.invoiceId.billingPeriod = calculatedPeriod;
        }

        res.json({
            success: true,
            data: {
                payment,
                school: schoolData
            }
        });
    } catch (error) {
        console.error('Get receipt error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching receipt'
        });
    }
});

module.exports = router;
