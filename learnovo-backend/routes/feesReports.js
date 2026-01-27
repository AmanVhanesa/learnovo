const express = require('express');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const StudentBalance = require('../models/StudentBalance');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// @desc    Get fees dashboard summary
// @route   GET /api/fees/dashboard
// @access  Private (Admin, Accountant)
router.get('/dashboard', protect, authorize('admin', 'accountant'), async (req, res) => {
    try {
        const { academicSessionId, startDate, endDate } = req.query;
        const tenantId = req.user.tenantId;

        // Total Collected
        const collectedFilter = {
            tenantId,
            isConfirmed: true,
            isReversed: false
        };

        if (startDate || endDate) {
            collectedFilter.paymentDate = {};
            if (startDate) collectedFilter.paymentDate.$gte = new Date(startDate);
            if (endDate) collectedFilter.paymentDate.$lte = new Date(endDate);
        }

        const collectedAgg = await Payment.aggregate([
            { $match: collectedFilter },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const totalCollected = collectedAgg.length > 0 ? collectedAgg[0].total : 0;

        // This Month Collection
        const thisMonthStart = new Date();
        thisMonthStart.setDate(1);
        thisMonthStart.setHours(0, 0, 0, 0);

        const thisMonthAgg = await Payment.aggregate([
            {
                $match: {
                    tenantId,
                    isConfirmed: true,
                    isReversed: false,
                    paymentDate: { $gte: thisMonthStart }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const thisMonthCollection = thisMonthAgg.length > 0 ? thisMonthAgg[0].total : 0;

        // Pending Dues
        const invoiceFilter = {
            tenantId,
            status: { $in: ['Pending', 'Partial', 'Overdue'] }
        };

        if (academicSessionId) {
            invoiceFilter.academicSessionId = academicSessionId;
        }

        const pendingAgg = await FeeInvoice.aggregate([
            { $match: invoiceFilter },
            { $group: { _id: null, total: { $sum: '$balanceAmount' } } }
        ]);

        const totalPending = pendingAgg.length > 0 ? pendingAgg[0].total : 0;

        // Overdue Amount
        const overdueAgg = await FeeInvoice.aggregate([
            {
                $match: {
                    tenantId,
                    status: 'Overdue'
                }
            },
            { $group: { _id: null, total: { $sum: '$balanceAmount' } } }
        ]);

        const totalOverdue = overdueAgg.length > 0 ? overdueAgg[0].total : 0;

        // Recent Payments
        const recentPayments = await Payment.find({
            tenantId,
            isConfirmed: true,
            isReversed: false
        })
            .populate('studentId', 'name studentId')
            .populate('invoiceId', 'invoiceNumber')
            .populate('collectedBy', 'name')
            .sort({ paymentDate: -1 })
            .limit(10);

        // Payment Method Breakdown
        const methodBreakdown = await Payment.aggregate([
            {
                $match: {
                    tenantId,
                    isConfirmed: true,
                    isReversed: false,
                    ...(startDate || endDate ? {
                        paymentDate: {
                            ...(startDate ? { $gte: new Date(startDate) } : {}),
                            ...(endDate ? { $lte: new Date(endDate) } : {})
                        }
                    } : {})
                }
            },
            {
                $group: {
                    _id: '$paymentMethod',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                summary: {
                    totalCollected,
                    totalPending,
                    totalOverdue,
                    thisMonthCollection
                },
                recentPayments,
                paymentMethodBreakdown: methodBreakdown
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching dashboard data'
        });
    }
});

// @desc    Get defaulters list
// @route   GET /api/fees/defaulters
// @access  Private (Admin, Accountant)
router.get('/defaulters', protect, authorize('admin', 'accountant'), async (req, res) => {
    try {
        const { academicSessionId, classId, minBalance } = req.query;

        const options = {};
        if (minBalance) options.minBalance = parseFloat(minBalance);

        const defaulters = await StudentBalance.getDefaulters(
            req.user.tenantId,
            academicSessionId,
            options
        );

        // Enrich with overdue days
        const enriched = await Promise.all(defaulters.map(async (defaulter) => {
            // Get oldest unpaid invoice
            const oldestInvoice = await FeeInvoice.findOne({
                tenantId: req.user.tenantId,
                studentId: defaulter.studentId._id,
                status: { $in: ['Pending', 'Partial', 'Overdue'] }
            }).sort({ dueDate: 1 });

            const overdueDays = oldestInvoice
                ? Math.floor((new Date() - oldestInvoice.dueDate) / (1000 * 60 * 60 * 24))
                : 0;

            return {
                ...defaulter.toObject(),
                overdueDays: Math.max(0, overdueDays)
            };
        }));

        res.json({
            success: true,
            data: enriched
        });
    } catch (error) {
        console.error('Defaulters error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching defaulters'
        });
    }
});

// @desc    Get collection report
// @route   GET /api/fees/collection-report
// @access  Private (Admin, Accountant)
router.get('/collection-report', protect, authorize('admin', 'accountant'), async (req, res) => {
    try {
        const { startDate, endDate, classId, paymentMethod } = req.query;

        const filter = {
            tenantId: req.user.tenantId,
            isConfirmed: true,
            isReversed: false
        };

        if (startDate || endDate) {
            filter.paymentDate = {};
            if (startDate) filter.paymentDate.$gte = new Date(startDate);
            if (endDate) filter.paymentDate.$lte = new Date(endDate);
        }

        if (paymentMethod) filter.paymentMethod = paymentMethod;

        const payments = await Payment.find(filter)
            .populate('studentId', 'name studentId classId sectionId')
            .populate('invoiceId', 'invoiceNumber')
            .populate('collectedBy', 'name')
            .sort({ paymentDate: -1 });

        // Filter by class if needed
        let filteredPayments = payments;
        if (classId) {
            filteredPayments = payments.filter(p => p.studentId?.classId?.toString() === classId);
        }

        // Calculate totals
        const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

        // Group by date
        const byDate = {};
        filteredPayments.forEach(payment => {
            const date = payment.paymentDate.toISOString().split('T')[0];
            if (!byDate[date]) {
                byDate[date] = { date, amount: 0, count: 0 };
            }
            byDate[date].amount += payment.amount;
            byDate[date].count += 1;
        });

        res.json({
            success: true,
            data: {
                payments: filteredPayments,
                summary: {
                    totalAmount,
                    totalCount: filteredPayments.length
                },
                byDate: Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date))
            }
        });
    } catch (error) {
        console.error('Collection report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while generating collection report'
        });
    }
});

// @desc    Get pending dues report
// @route   GET /api/fees/pending-report
// @access  Private (Admin, Accountant)
router.get('/pending-report', protect, authorize('admin', 'accountant'), async (req, res) => {
    try {
        const { academicSessionId, classId } = req.query;

        const filter = {
            tenantId: req.user.tenantId,
            status: { $in: ['Pending', 'Partial', 'Overdue'] }
        };

        if (academicSessionId) filter.academicSessionId = academicSessionId;
        if (classId) filter.classId = classId;

        const invoices = await FeeInvoice.find(filter)
            .populate('studentId', 'name studentId phone email')
            .populate('classId', 'name grade')
            .populate('sectionId', 'name')
            .sort({ dueDate: 1 });

        const totalPending = invoices.reduce((sum, inv) => sum + inv.balanceAmount, 0);

        // Group by class
        const byClass = {};
        invoices.forEach(invoice => {
            const className = invoice.classId?.name || 'Unknown';
            if (!byClass[className]) {
                byClass[className] = { className, amount: 0, count: 0 };
            }
            byClass[className].amount += invoice.balanceAmount;
            byClass[className].count += 1;
        });

        res.json({
            success: true,
            data: {
                invoices,
                summary: {
                    totalPending,
                    totalCount: invoices.length
                },
                byClass: Object.values(byClass)
            }
        });
    } catch (error) {
        console.error('Pending report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while generating pending report'
        });
    }
});

// @desc    Get class-wise collection report
// @route   GET /api/fees/class-wise-report
// @access  Private (Admin, Accountant)
router.get('/class-wise-report', protect, authorize('admin', 'accountant'), async (req, res) => {
    try {
        const { academicSessionId } = req.query;

        const filter = { tenantId: req.user.tenantId };
        if (academicSessionId) filter.academicSessionId = academicSessionId;

        // Get all invoices
        const invoices = await FeeInvoice.find(filter)
            .populate('classId', 'name grade');

        // Get all payments
        const payments = await Payment.find({
            tenantId: req.user.tenantId,
            isConfirmed: true,
            isReversed: false
        }).populate({
            path: 'invoiceId',
            populate: { path: 'classId', select: 'name grade' }
        });

        // Group by class
        const classData = {};

        invoices.forEach(invoice => {
            const className = invoice.classId?.name || 'Unknown';
            if (!classData[className]) {
                classData[className] = {
                    className,
                    totalInvoiced: 0,
                    totalCollected: 0,
                    totalPending: 0,
                    studentCount: new Set()
                };
            }
            classData[className].totalInvoiced += invoice.totalAmount + invoice.lateFeeApplied;
            classData[className].totalPending += invoice.balanceAmount;
            classData[className].studentCount.add(invoice.studentId.toString());
        });

        payments.forEach(payment => {
            const className = payment.invoiceId?.classId?.name || 'Unknown';
            if (classData[className]) {
                classData[className].totalCollected += payment.amount;
            }
        });

        // Convert Set to count
        Object.values(classData).forEach(data => {
            data.studentCount = data.studentCount.size;
        });

        res.json({
            success: true,
            data: Object.values(classData)
        });
    } catch (error) {
        console.error('Class-wise report error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while generating class-wise report'
        });
    }
});

module.exports = router;
