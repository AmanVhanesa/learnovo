const express = require('express');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const StudentBalance = require('../models/StudentBalance');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../middleware/errorHandler');
const { toNumber, roundToRupee, sumMoney } = require('../utils/money');
const ImportExportService = require('../services/importExportService');

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Online'];

/**
 * Resolve a date range from query params.
 * Custom startDate/endDate override the period preset.
 */
function resolveDateRange({ period, startDate: s, endDate: e }) {
  if (s || e) {
    const start = s ? new Date(s) : new Date(0);
    start.setHours(0, 0, 0, 0);
    const end = e ? new Date(e) : new Date();
    end.setHours(23, 59, 59, 999);
    return { startDate: start, endDate: end, preset: 'custom' };
  }
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  let startDate;
  switch (period) {
  case 'today':
    startDate = new Date(now); startDate.setHours(0, 0, 0, 0); break;
  case 'weekly': {
    startDate = new Date(now);
    const dow = startDate.getDay();
    startDate.setDate(startDate.getDate() - (dow === 0 ? 6 : dow - 1));
    startDate.setHours(0, 0, 0, 0); break;
  }
  case 'monthly':
  default:
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.setHours(0, 0, 0, 0); break;
  }
  return { startDate, endDate, preset: period || 'monthly' };
}

/**
 * Write a compact horizontal "Collection Summary by Payment Method" block.
 * Layout: title | header (methods + GRAND TOTAL) | Transactions row | Amount row.
 * Uses 4 rows instead of the old 9-row vertical block to save paper.
 */
function writeHorizontalSummary(ws, colCount, methods, methodCounts, methodTotals, grandCount, grandTotal) {
  const n = methods.length;
  const labelSpan = 2;
  const gtSpan = Math.max(2, colCount - labelSpan - n);
  const perMethod = 1;
  const used = labelSpan + n * perMethod + gtSpan;
  const pad = Math.max(0, colCount - used);
  const gtStart = labelSpan + n * perMethod + pad + 1;

  const title = ws.addRow(['Collection Summary by Payment Method']);
  ws.mergeCells(title.number, 1, title.number, colCount);
  title.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  title.alignment = { horizontal: 'center' };
  title.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7A3A' } };
  });

  const headerCells = [];
  headerCells.push(''); for (let i = 1; i < labelSpan; i++) headerCells.push('');
  methods.forEach(m => headerCells.push(m));
  for (let i = 0; i < pad; i++) headerCells.push('');
  headerCells.push('GRAND TOTAL');
  for (let i = 1; i < gtSpan; i++) headerCells.push('');
  const header = ws.addRow(headerCells);
  ws.mergeCells(header.number, 1, header.number, labelSpan);
  ws.mergeCells(header.number, gtStart, header.number, colCount);
  header.eachCell(c => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0E8' } };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    c.alignment = { horizontal: 'center' };
  });

  const buildDataRow = (label, values, grand, opts = {}) => {
    const cells = [label];
    for (let i = 1; i < labelSpan; i++) cells.push('');
    values.forEach(v => cells.push(v));
    for (let i = 0; i < pad; i++) cells.push('');
    cells.push(grand);
    for (let i = 1; i < gtSpan; i++) cells.push('');
    const row = ws.addRow(cells);
    ws.mergeCells(row.number, 1, row.number, labelSpan);
    ws.mergeCells(row.number, gtStart, row.number, colCount);
    row.getCell(1).alignment = { horizontal: 'left', indent: 1 };
    row.getCell(1).font = { bold: true };
    for (let c = labelSpan + 1; c < gtStart; c++) {
      row.getCell(c).alignment = { horizontal: opts.numFmt ? 'right' : 'center' };
      if (opts.numFmt) row.getCell(c).numFmt = opts.numFmt;
    }
    row.getCell(gtStart).alignment = { horizontal: 'right', indent: 1 };
    row.getCell(gtStart).font = { bold: true };
    if (opts.numFmt) row.getCell(gtStart).numFmt = opts.numFmt;
    row.eachCell(c => {
      c.border = { top: { style: 'hair' }, bottom: { style: 'hair' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });
    if (opts.fill) {
      row.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
      });
    }
  };

  buildDataRow('Transactions', methods.map(m => methodCounts[m] || 0), grandCount);
  buildDataRow('Amount (INR)', methods.map(m => Number(roundToRupee(methodTotals[m] || 0))), Number(roundToRupee(grandTotal)), { numFmt: '#,##0.00', fill: 'FFD9EAD3' });
}

const planGate = require('../middleware/planGate');

const router = express.Router();

// All fee report routes require fees/finance feature (Basic+)
router.use(planGate.requireActiveSubscription);
router.use(planGate.checkFeesAndFinance);

// @desc    Get fees dashboard summary
// @route   GET /api/fees/dashboard
// @access  Private (Admin, Accountant)
router.get('/dashboard', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { academicSessionId, startDate, endDate } = req.query;
    // Ensure IDs are cast to ObjectId for aggregation
    const tenantId = new mongoose.Types.ObjectId(req.user.tenantId);
    const sessionObjectId = academicSessionId ? new mongoose.Types.ObjectId(academicSessionId) : null;

    // Total Collected — Payment has no academicSessionId, so filter via invoice lookup
    const collectedPipeline = [
      { $match: { tenantId, isConfirmed: true, isReversed: false, ...(startDate || endDate ? { paymentDate: { ...(startDate && { $gte: new Date(startDate) }), ...(endDate && { $lte: new Date(endDate) }) } } : {}) } }
    ];
    if (sessionObjectId) {
      collectedPipeline.push(
        { $lookup: { from: 'feeinvoices', localField: 'invoiceId', foreignField: '_id', as: '_inv' } },
        { $match: { '_inv.academicSessionId': sessionObjectId } }
      );
    }
    collectedPipeline.push({ $group: { _id: null, total: { $sum: '$amount' } } });

    const collectedAgg = await Payment.aggregate(collectedPipeline);
    const totalCollected = collectedAgg.length > 0 ? collectedAgg[0].total : 0;

    // This Month Collection
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const thisMonthPipeline = [
      { $match: { tenantId, isConfirmed: true, isReversed: false, paymentDate: { $gte: thisMonthStart } } }
    ];
    if (sessionObjectId) {
      thisMonthPipeline.push(
        { $lookup: { from: 'feeinvoices', localField: 'invoiceId', foreignField: '_id', as: '_inv' } },
        { $match: { '_inv.academicSessionId': sessionObjectId } }
      );
    }
    thisMonthPipeline.push({ $group: { _id: null, total: { $sum: '$amount' } } });

    const thisMonthAgg = await Payment.aggregate(thisMonthPipeline);

    const thisMonthCollection = thisMonthAgg.length > 0 ? thisMonthAgg[0].total : 0;

    // Pending Dues
    const invoiceFilter = {
      tenantId,
      status: { $in: ['Pending', 'Partial', 'Overdue'] }
    };

    if (sessionObjectId) {
      invoiceFilter.academicSessionId = sessionObjectId;
    }

    const pendingAgg = await FeeInvoice.aggregate([
      { $match: invoiceFilter },
      { $group: { _id: null, total: { $sum: '$balanceAmount' } } }
    ]);

    const totalPending = pendingAgg.length > 0 ? pendingAgg[0].total : 0;

    // Overdue Amount
    const overdueFilter = { tenantId, status: 'Overdue' };
    if (sessionObjectId) overdueFilter.academicSessionId = sessionObjectId;
    const overdueAgg = await FeeInvoice.aggregate([
      { $match: overdueFilter },
      { $group: { _id: null, total: { $sum: '$balanceAmount' } } }
    ]);

    const totalOverdue = overdueAgg.length > 0 ? overdueAgg[0].total : 0;

    // Recent Payments
    const recentPaymentsFilter = {
      tenantId,
      isConfirmed: true,
      isReversed: false
    };
    if (sessionObjectId) recentPaymentsFilter.academicSessionId = sessionObjectId;

    const recentPayments = await Payment.find(recentPaymentsFilter)
      .populate('studentId', 'name fullName studentId admissionNumber')
      .populate('invoiceId', 'invoiceNumber')
      .populate('collectedBy', 'name')
      .sort({ paymentDate: -1 })
      .limit(10);

    // Payment Method Breakdown
    const methodFilter = {
      tenantId,
      isConfirmed: true,
      isReversed: false
    };
    if (sessionObjectId) methodFilter.academicSessionId = sessionObjectId;
    if (startDate || endDate) {
      methodFilter.paymentDate = {};
      if (startDate) methodFilter.paymentDate.$gte = new Date(startDate);
      if (endDate) methodFilter.paymentDate.$lte = new Date(endDate);
    }
    const methodBreakdown = await Payment.aggregate([
      { $match: methodFilter },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Recent Invoices (all statuses to show complete picture)
    const recentInvoicesFilter = { tenantId };
    if (academicSessionId) {
      recentInvoicesFilter.academicSessionId = academicSessionId;
    }

    const recentInvoices = await FeeInvoice.find(recentInvoicesFilter)
      .populate('studentId', 'name fullName studentId admissionNumber email phone')
      .populate('classId', 'name grade')
      .populate('sectionId', 'name')
      .populate('academicSessionId', 'name')
      .sort({ issuedDate: -1 })
      .limit(10)
      .lean();

    logger.info('Dashboard data fetched', { recentInvoiceCount: recentInvoices.length });

    const response = {
      success: true,
      data: {
        summary: {
          totalCollected,
          totalPending,
          totalOverdue,
          thisMonthCollection
        },
        recentPayments,
        recentInvoices,
        paymentMethodBreakdown: methodBreakdown
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Dashboard error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard data'
    });
  }
});

// @desc    Get defaulters list
// @route   GET /api/fees/defaulters
// @access  Private (Admin, Accountant)
router.get('/defaulters', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { academicSessionId, classId, minBalance } = req.query;

    const options = {};
    if (minBalance) options.minBalance = parseFloat(minBalance);

    const defaulters = await StudentBalance.getDefaulters(
      req.user.tenantId,
      academicSessionId,
      options
    );

    // Enrich with overdue days, due date, and invoice IDs
    const now = new Date();
    const enrichedResults = await Promise.all(defaulters.map(async(defaulter) => {
      if (!defaulter.studentId) return null;

      // Get all unpaid invoices for this student (sorted by dueDate ascending)
      const unpaidInvoices = await FeeInvoice.find({
        tenantId: req.user.tenantId,
        studentId: defaulter.studentId._id,
        academicSessionId: academicSessionId || defaulter.academicSessionId?._id,
        status: { $in: ['Pending', 'Partial', 'Overdue'] }
      }).sort({ dueDate: 1 }).select('_id dueDate status balanceAmount');

      // Skip if no unpaid invoices exist (balance may be stale)
      if (unpaidInvoices.length === 0) return null;

      const oldestInvoice = unpaidInvoices[0];
      const overdueDays = oldestInvoice.dueDate
        ? Math.max(0, Math.floor((now - oldestInvoice.dueDate) / (1000 * 60 * 60 * 24)))
        : 0;

      // Compute live balance from unpaid invoices to avoid stale StudentBalance data
      const liveBalance = sumMoney(unpaidInvoices.map(inv => inv.balanceAmount || 0));

      // Skip students with zero or negative live balance (already paid)
      if (liveBalance <= 0) return null;

      return {
        ...defaulter.toObject(),
        overdueDays,
        oldestDueDate: oldestInvoice.dueDate,
        invoiceIds: unpaidInvoices.map(inv => inv._id),
        unpaidInvoiceCount: unpaidInvoices.length,
        liveBalance
      };
    }));

    // Filter out nulls (paid students, missing data)
    const enriched = enrichedResults.filter(Boolean);

    // Optionally filter by classId on the populated studentId
    let filtered = enriched;
    if (classId) {
      filtered = enriched.filter(d => {
        const sClassId = d.studentId?.classId;
        return sClassId && sClassId.toString() === classId;
      });
    }

    res.json({
      success: true,
      data: filtered
    });
  } catch (error) {
    logger.error('Defaulters error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching defaulters'
    });
  }
});

// @desc    Export defaulters list as CSV or Excel
// @route   GET /api/fees/defaulters/export
// @access  Private (Admin, Accountant)
router.get('/defaulters/export', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { academicSessionId, classId, minBalance, format: fmt } = req.query;
    const tenantId = req.user.tenantId;

    if (!academicSessionId) {
      return res.status(400).json({
        success: false,
        message: 'academicSessionId is required'
      });
    }

    const options = {};
    if (minBalance) options.minBalance = parseFloat(minBalance);

    const defaulters = await StudentBalance.find({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      academicSessionId: new mongoose.Types.ObjectId(academicSessionId),
      totalBalance: options.minBalance ? { $gte: options.minBalance, $gt: 0 } : { $gt: 0 }
    })
      .populate({
        path: 'studentId',
        select: 'name fullName studentId admissionNumber phone email classId sectionId',
        populate: [
          { path: 'classId', select: 'name' },
          { path: 'sectionId', select: 'name' }
        ]
      })
      .populate('academicSessionId', 'name')
      .sort({ totalBalance: -1 })
      .limit(5000);

    const now = new Date();
    const enriched = (await Promise.all(defaulters.map(async(d) => {
      if (!d.studentId) return null;
      if (classId && (!d.studentId.classId || d.studentId.classId._id.toString() !== classId)) return null;

      const unpaidInvoices = await FeeInvoice.find({
        tenantId,
        studentId: d.studentId._id,
        academicSessionId,
        status: { $in: ['Pending', 'Partial', 'Overdue'] }
      }).sort({ dueDate: 1 }).select('_id dueDate status balanceAmount');

      if (unpaidInvoices.length === 0) return null;

      const oldest = unpaidInvoices[0];
      const overdueDays = oldest.dueDate
        ? Math.max(0, Math.floor((now - oldest.dueDate) / (1000 * 60 * 60 * 24)))
        : 0;
      const liveBalance = sumMoney(unpaidInvoices.map(inv => inv.balanceAmount || 0));
      if (liveBalance <= 0) return null;

      return {
        admissionNumber: d.studentId.admissionNumber || d.studentId.studentId || '-',
        studentName: d.studentId.fullName || d.studentId.name || 'N/A',
        className: d.studentId.classId?.name || '-',
        sectionName: d.studentId.sectionId?.name || '-',
        phone: d.studentId.phone || '-',
        email: d.studentId.email || '-',
        totalBalance: roundToRupee(liveBalance),
        unpaidInvoiceCount: unpaidInvoices.length,
        oldestDueDate: oldest.dueDate,
        overdueDays
      };
    }))).filter(Boolean);

    const columns = [
      { key: 'admissionNumber', header: 'Admission No.' },
      { key: 'studentName', header: 'Student Name' },
      { key: 'className', header: 'Class' },
      { key: 'sectionName', header: 'Section' },
      { key: 'phone', header: 'Phone' },
      { key: 'email', header: 'Email' },
      {
        key: 'totalBalance',
        header: 'Total Pending',
        format: (v) => (v != null ? Number(v).toFixed(2) : '0.00')
      },
      { key: 'unpaidInvoiceCount', header: 'Unpaid Invoices' },
      {
        key: 'oldestDueDate',
        header: 'Oldest Due Date',
        format: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '-')
      },
      {
        key: 'overdueDays',
        header: 'Overdue Days',
        format: (v) => (v > 0 ? `${v}` : 'Not yet due')
      }
    ];

    const today = new Date().toISOString().split('T')[0];
    const headerInfo = await ImportExportService.getExportHeaderInfo(tenantId, 'Fee Defaulters Report');
    let buffer, contentType, ext;

    if (fmt === 'excel') {
      buffer = ImportExportService.exportToExcel(enriched, columns, 'Defaulters', headerInfo);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      ext = 'xlsx';
    } else {
      buffer = await ImportExportService.exportToCSV(enriched, columns, headerInfo);
      contentType = 'text/csv';
      ext = 'csv';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=fee_defaulters_${today}.${ext}`);
    res.status(200).send(buffer);
  } catch (error) {
    logger.error('Defaulters export error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting defaulters'
    });
  }
});

// @desc    Get collection report
// @route   GET /api/fees/collection-report
// @access  Private (Admin, Accountant)
router.get('/collection-report', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { startDate, endDate, classId, paymentMethod, academicSessionId } = req.query;

    const filter = {
      tenantId: req.user.tenantId,
      isConfirmed: true,
      isReversed: false
    };

    if (academicSessionId) filter.academicSessionId = academicSessionId;

    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) filter.paymentDate.$lte = new Date(endDate);
    }

    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const skip = (page - 1) * limit;

    const payments = await Payment.find(filter)
      .populate('studentId', 'name studentId classId sectionId')
      .populate('invoiceId', 'invoiceNumber')
      .populate('collectedBy', 'name')
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limit);

    // Filter by class if needed
    let filteredPayments = payments;
    if (classId) {
      filteredPayments = payments.filter(p => p.studentId?.classId?.toString() === classId);
    }

    // Calculate totals
    const totalAmount = sumMoney(filteredPayments.map(p => p.amount));

    // Group by date
    const byDate = {};
    filteredPayments.forEach(payment => {
      const date = payment.paymentDate.toISOString().split('T')[0];
      if (!byDate[date]) {
        byDate[date] = { date, amount: 0, count: 0 };
      }
      byDate[date].amount += toNumber(payment.amount);
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
    logger.error('Collection report error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating collection report'
    });
  }
});

// @desc    Get pending dues report
// @route   GET /api/fees/pending-report
// @access  Private (Admin, Accountant)
router.get('/pending-report', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { academicSessionId, classId } = req.query;

    const filter = {
      tenantId: req.user.tenantId,
      status: { $in: ['Pending', 'Partial', 'Overdue'] }
    };

    if (academicSessionId) filter.academicSessionId = academicSessionId;
    if (classId) filter.classId = classId;

    // Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const skip = (page - 1) * limit;

    const invoices = await FeeInvoice.find(filter)
      .populate('studentId', 'name studentId phone email')
      .populate('classId', 'name grade')
      .populate('sectionId', 'name')
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limit);

    const totalPending = sumMoney(invoices.map(inv => inv.balanceAmount));

    // Group by class
    const byClass = {};
    invoices.forEach(invoice => {
      const className = invoice.classId?.name || 'Unknown';
      if (!byClass[className]) {
        byClass[className] = { className, amount: 0, count: 0 };
      }
      byClass[className].amount += toNumber(invoice.balanceAmount);
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
    logger.error('Pending report error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating pending report'
    });
  }
});

// @desc    Get class-wise collection report
// @route   GET /api/fees/class-wise-report
// @access  Private (Admin, Accountant)
router.get('/class-wise-report', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { academicSessionId } = req.query;

    const filter = { tenantId: req.user.tenantId };
    if (academicSessionId) filter.academicSessionId = academicSessionId;

    // Use aggregation instead of loading all documents into memory
    const invoices = await FeeInvoice.find(filter)
      .populate('classId', 'name grade')
      .lean();

    const paymentFilter = {
      tenantId: req.user.tenantId,
      isConfirmed: true,
      isReversed: false
    };
    if (academicSessionId) paymentFilter.academicSessionId = academicSessionId;

    const payments = await Payment.find(paymentFilter).populate({
      path: 'invoiceId',
      populate: { path: 'classId', select: 'name grade' }
    }).lean();

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
      classData[className].totalInvoiced += toNumber(invoice.totalAmount) + toNumber(invoice.lateFeeApplied);
      classData[className].totalPending += toNumber(invoice.balanceAmount);
      classData[className].studentCount.add(invoice.studentId.toString());
    });

    payments.forEach(payment => {
      const className = payment.invoiceId?.classId?.name || 'Unknown';
      if (classData[className]) {
        classData[className].totalCollected += toNumber(payment.amount);
      }
    });

    // Convert Set to count and round accumulated amounts
    Object.values(classData).forEach(data => {
      data.studentCount = data.studentCount.size;
      data.totalInvoiced = roundToRupee(data.totalInvoiced);
      data.totalCollected = roundToRupee(data.totalCollected);
      data.totalPending = roundToRupee(data.totalPending);
    });

    res.json({
      success: true,
      data: Object.values(classData)
    });
  } catch (error) {
    logger.error('Class-wise report error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating class-wise report'
    });
  }
});

// @desc    Export receipts / fee collection list as CSV or Excel
// @route   GET /api/fees/receipts/export
// @access  Private (Admin, Accountant)
router.get('/receipts/export', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { paymentMethod, format: fmt } = req.query;
    const tenantId = req.user.tenantId;
    const { startDate, endDate, preset } = resolveDateRange(req.query);

    const filter = { tenantId, isReversed: false };
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (req.query.startDate || req.query.endDate || req.query.period) {
      filter.paymentDate = { $gte: startDate, $lte: endDate };
    }

    const payments = await Payment.find(filter)
      .populate('studentId', 'name fullName admissionNumber studentId classId')
      .populate({ path: 'studentId', populate: { path: 'classId', select: 'name' } })
      .populate('invoiceId', 'invoiceNumber')
      .populate('collectedBy', 'name')
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();

    // Totals by method
    const methodTotals = {};
    const methodCounts = {};
    PAYMENT_METHODS.forEach(m => {
      methodTotals[m] = 0; methodCounts[m] = 0;
    });
    payments.forEach(p => {
      const m = p.paymentMethod || 'Unknown';
      if (methodTotals[m] == null) {
        methodTotals[m] = 0; methodCounts[m] = 0;
      }
      methodTotals[m] += toNumber(p.amount);
      methodCounts[m] += 1;
    });
    const grandTotal = sumMoney(payments.map(p => p.amount));
    const grandCount = payments.length;

    const periodLabel = preset === 'custom'
      ? `${startDate.toLocaleDateString('en-IN')} — ${endDate.toLocaleDateString('en-IN')}`
      : preset === 'today' ? 'Today'
        : preset === 'weekly' ? 'This Week'
          : 'This Month';
    const methodLabel = paymentMethod ? ` - ${paymentMethod}` : ' - All Methods';
    const headerInfo = await ImportExportService.getExportHeaderInfo(
      tenantId,
      `Fee Receipts Report (${periodLabel}${methodLabel})`
    );

    const today = new Date().toISOString().split('T')[0];
    const fmtINR = (n) => Number(n || 0).toFixed(2);

    if (fmt === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Learnovo';
      const ws = workbook.addWorksheet('Receipts', {
        pageSetup: {
          paperSize: 9, orientation: 'landscape', fitToPage: true,
          fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
          margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
        }
      });

      const colCount = 10;

      if (headerInfo.schoolName) {
        ws.addRow([headerInfo.schoolName]);
        ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
        ws.lastRow.font = { bold: true, size: 14 };
        ws.lastRow.alignment = { horizontal: 'center' };
      }
      ws.addRow([`Fee Receipts Report — ${periodLabel}${methodLabel}`]);
      ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
      ws.lastRow.font = { bold: true, size: 12 };
      ws.lastRow.alignment = { horizontal: 'center' };

      ws.addRow([`Period: ${startDate.toLocaleDateString('en-IN')} to ${endDate.toLocaleDateString('en-IN')}`]);
      ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
      ws.lastRow.alignment = { horizontal: 'center' };

      ws.addRow([headerInfo.dateTime]);
      ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
      ws.lastRow.alignment = { horizontal: 'center' };
      ws.lastRow.font = { italic: true, size: 9 };
      ws.addRow([]);

      ws.columns = [
        { width: 6 }, { width: 14 }, { width: 14 }, { width: 24 },
        { width: 10 }, { width: 14 }, { width: 11 }, { width: 13 },
        { width: 12 }, { width: 16 }
      ];

      const headerRow = ws.addRow(['S.No', 'Receipt No.', 'Admission No.', 'Student Name', 'Class', 'Invoice No.', 'Amount', 'Method', 'Date', 'Collected By']);
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7A3A' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
      });

      payments.forEach((p, idx) => {
        const row = ws.addRow([
          idx + 1,
          p.receiptNumber || '',
          p.studentId?.admissionNumber || p.studentId?.studentId || '-',
          p.studentId?.fullName || p.studentId?.name || 'N/A',
          p.studentId?.classId?.name || '-',
          p.invoiceId?.invoiceNumber || '',
          Number(p.amount || 0),
          p.paymentMethod || '-',
          p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '',
          p.collectedBy?.name || '-'
        ]);
        row.eachCell((cell, colNumber) => {
          cell.border = { top: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' }, bottom: { style: 'hair' } };
          if (colNumber === 7) {
            cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right' };
          } else if (colNumber === 1 || colNumber === 9) cell.alignment = { horizontal: 'center' };
          else cell.alignment = { horizontal: 'left' };
        });
        if (idx % 2 === 1) row.eachCell(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7F6' } };
        });
      });

      // Grand total row within table
      const totalRow = ws.addRow(['', '', '', '', '', 'TOTAL', Number(roundToRupee(grandTotal)), '', '', `${grandCount  } txns`]);
      totalRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
        cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
        if (colNumber === 7) {
          cell.numFmt = '#,##0.00'; cell.alignment = { horizontal: 'right' };
        } else if (colNumber === 6) cell.alignment = { horizontal: 'right' };
        else cell.alignment = { horizontal: 'center' };
      });

      // Method-wise summary block (compact horizontal layout)
      ws.addRow([]);
      const summaryMethods = [...PAYMENT_METHODS, ...Object.keys(methodTotals).filter(m => !PAYMENT_METHODS.includes(m))]
        .filter(m => methodTotals[m] != null);
      writeHorizontalSummary(ws, colCount, summaryMethods, methodCounts, methodTotals, grandCount, grandTotal);

      ws.addRow([]); ws.addRow([]);
      const sigRow = ws.addRow(['Prepared by: ______________________', '', '', '', '', '', '', '', 'Verified by: ______________________', '']);
      ws.mergeCells(sigRow.number, 1, sigRow.number, 5);
      ws.mergeCells(sigRow.number, 6, sigRow.number, colCount);
      sigRow.font = { size: 10 };
      sigRow.getCell(1).alignment = { horizontal: 'left' };
      sigRow.getCell(6).alignment = { horizontal: 'right' };

      ws.pageSetup.printTitlesRow = `${headerRow.number}:${headerRow.number}`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=fee_receipts_${today}.xlsx`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    // CSV export
    const lines = [];
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    if (headerInfo.schoolName) lines.push(q(headerInfo.schoolName));
    lines.push(q(`Fee Receipts Report - ${periodLabel}${methodLabel}`));
    lines.push(q(`Period: ${startDate.toLocaleDateString('en-IN')} to ${endDate.toLocaleDateString('en-IN')}`));
    lines.push(q(headerInfo.dateTime));
    lines.push('');

    const csvHeaders = ['S.No', 'Receipt No.', 'Admission No.', 'Student Name', 'Class', 'Invoice No.', 'Amount', 'Method', 'Date', 'Collected By'];
    lines.push(csvHeaders.map(q).join(','));

    payments.forEach((p, idx) => {
      lines.push([
        idx + 1,
        p.receiptNumber || '',
        p.studentId?.admissionNumber || p.studentId?.studentId || '-',
        p.studentId?.fullName || p.studentId?.name || 'N/A',
        p.studentId?.classId?.name || '-',
        p.invoiceId?.invoiceNumber || '',
        fmtINR(p.amount),
        p.paymentMethod || '-',
        p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('en-IN') : '',
        p.collectedBy?.name || '-'
      ].map(q).join(','));
    });

    lines.push(['', '', '', '', '', 'TOTAL', fmtINR(grandTotal), '', '', `${grandCount} txns`].map(q).join(','));
    lines.push('');
    lines.push(q('Collection Summary by Payment Method'));
    {
      const csvMethods = [...PAYMENT_METHODS, ...Object.keys(methodTotals).filter(m => !PAYMENT_METHODS.includes(m))].filter(m => methodTotals[m] != null);
      lines.push(['', ...csvMethods, 'GRAND TOTAL'].map(q).join(','));
      lines.push(['Transactions', ...csvMethods.map(m => methodCounts[m] || 0), grandCount].map(q).join(','));
      lines.push(['Amount (INR)', ...csvMethods.map(m => fmtINR(methodTotals[m])), fmtINR(grandTotal)].map(q).join(','));
    }
    lines.push('');
    lines.push([q('Prepared by: ______________________'), '', q('Verified by: ______________________')].join(','));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=fee_receipts_${today}.csv`);
    return res.status(200).send(lines.join('\n'));
  } catch (error) {
    logger.error('Receipts export error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting receipts'
    });
  }
});

// @desc    Export collection report summary as CSV or Excel
// @route   GET /api/fees/collection-report/export
// @access  Private (Admin, Accountant)
router.get('/collection-report/export', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { startDate, endDate, paymentMethod, classId, format: fmt } = req.query;
    const tenantId = req.user.tenantId;

    const filter = {
      tenantId,
      isConfirmed: true,
      isReversed: false
    };

    if (paymentMethod) filter.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      filter.paymentDate = {};
      if (startDate) filter.paymentDate.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.paymentDate.$lte = end;
      }
    }

    let payments = await Payment.find(filter)
      .populate('studentId', 'name fullName admissionNumber studentId classId')
      .populate({
        path: 'studentId',
        populate: { path: 'classId', select: 'name' }
      })
      .populate('invoiceId', 'invoiceNumber')
      .populate('collectedBy', 'name')
      .sort({ paymentDate: -1 })
      .lean();

    if (classId) {
      payments = payments.filter(p => p.studentId?.classId?._id?.toString() === classId);
    }

    const columns = [
      { key: 'receiptNumber', header: 'Receipt No.' },
      { key: 'studentId.admissionNumber', header: 'Admission No.' },
      {
        key: 'studentName',
        header: 'Student Name',
        format: (v) => v || 'N/A'
      },
      {
        key: 'className',
        header: 'Class',
        format: (v) => v || '-'
      },
      { key: 'invoiceId.invoiceNumber', header: 'Invoice No.' },
      {
        key: 'amount',
        header: 'Amount',
        format: (v) => (v != null ? Number(v).toFixed(2) : '0.00')
      },
      { key: 'paymentMethod', header: 'Payment Method' },
      {
        key: 'paymentDate',
        header: 'Payment Date',
        format: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '')
      },
      {
        key: 'collectedBy.name',
        header: 'Collected By',
        format: (v) => v || '-'
      }
    ];

    const data = payments.map(p => ({
      ...p,
      studentName: p.studentId?.fullName || p.studentId?.name || 'N/A',
      className: p.studentId?.classId?.name || '-'
    }));

    const today = new Date().toISOString().split('T')[0];
    const headerInfo = await ImportExportService.getExportHeaderInfo(tenantId, 'Fee Collection Report');
    let buffer, contentType, ext;

    if (fmt === 'excel') {
      buffer = ImportExportService.exportToExcel(data, columns, 'Collection Report', headerInfo);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      ext = 'xlsx';
    } else {
      buffer = await ImportExportService.exportToCSV(data, columns, headerInfo);
      contentType = 'text/csv';
      ext = 'csv';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=collection_report_${today}.${ext}`);
    res.status(200).send(buffer);
  } catch (error) {
    logger.error('Collection report export error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting collection report'
    });
  }
});

// @desc    Get fee collection summary with method-wise breakdown
// @route   GET /api/fees/collection-summary
// @access  Private (Admin, Accountant)
router.get('/collection-summary', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { paymentMethod, academicSessionId } = req.query;
    const tenantId = new mongoose.Types.ObjectId(req.user.tenantId);
    const { startDate, endDate, preset } = resolveDateRange(req.query);

    const filter = {
      tenantId,
      isConfirmed: true,
      isReversed: false,
      paymentDate: { $gte: startDate, $lte: endDate }
    };

    if (academicSessionId) filter.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Method-wise breakdown aggregation
    const methodBreakdown = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Date-wise breakdown
    const dateBreakdown = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    // Date + method breakdown (for detailed table)
    const dateMethodBreakdown = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
            method: '$paymentMethod'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': -1, '_id.method': 1 } }
    ]);

    // Get transaction list (paginated)
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const skip = (page - 1) * limit;

    const payments = await Payment.find(filter)
      .populate('studentId', 'name fullName admissionNumber studentId classId')
      .populate({ path: 'studentId', populate: { path: 'classId', select: 'name' } })
      .populate('invoiceId', 'invoiceNumber')
      .populate('collectedBy', 'name')
      .sort({ paymentDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Totals
    const grandTotal = sumMoney(methodBreakdown.map(m => m.total));
    const totalCount = methodBreakdown.reduce((sum, m) => sum + m.count, 0);

    res.json({
      success: true,
      data: {
        period: preset,
        dateRange: { startDate, endDate },
        summary: {
          grandTotal,
          totalCount,
          dailyAverage: roundToRupee(grandTotal / (dateBreakdown.length || 1))
        },
        methodBreakdown: methodBreakdown.map(m => ({
          method: m._id,
          total: roundToRupee(m.total),
          count: m.count,
          percentage: grandTotal > 0 ? roundToRupee((m.total / grandTotal) * 100) : 0
        })),
        byDate: dateBreakdown.map(d => ({
          date: d._id,
          total: roundToRupee(d.total),
          count: d.count
        })),
        dateMethodBreakdown: dateMethodBreakdown.map(d => ({
          date: d._id.date,
          method: d._id.method,
          total: roundToRupee(d.total),
          count: d.count
        })),
        payments
      }
    });
  } catch (error) {
    logger.error('Collection summary error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching collection summary'
    });
  }
});

// @desc    Export daily fee collection summary (date × payment method pivot), A4 ready
// @route   GET /api/fees/collection-summary/export
// @access  Private (Admin, Accountant)
router.get('/collection-summary/export', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { paymentMethod, format: fmt } = req.query;
    const tenantId = req.user.tenantId;
    const { startDate, endDate, preset } = resolveDateRange(req.query);
    const period = preset;

    const filter = {
      tenantId: new mongoose.Types.ObjectId(tenantId),
      isConfirmed: true,
      isReversed: false,
      paymentDate: { $gte: startDate, $lte: endDate }
    };
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    // Aggregate date × method totals
    const rows = await Payment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
            method: '$paymentMethod'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Build method list (fixed order + any extras)
    const extraMethods = [...new Set(rows.map(r => r._id.method).filter(m => m && !PAYMENT_METHODS.includes(m)))];
    const methods = paymentMethod ? [paymentMethod] : [...PAYMENT_METHODS, ...extraMethods];

    // Build date→method→{total,count} map
    const byDate = {};
    rows.forEach(r => {
      const d = r._id.date;
      const m = r._id.method || 'Unknown';
      if (!byDate[d]) byDate[d] = {};
      byDate[d][m] = { total: toNumber(r.total), count: r.count };
    });

    // Sorted descending (most recent first)
    const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

    // Build pivoted rows
    const pivot = dates.map(d => {
      const row = { date: d };
      let dayTotal = 0;
      let dayCount = 0;
      methods.forEach(m => {
        const cell = byDate[d][m];
        row[m] = cell ? roundToRupee(cell.total) : 0;
        row[`${m}__count`] = cell ? cell.count : 0;
        if (cell) {
          dayTotal += cell.total;
          dayCount += cell.count;
        }
      });
      row.dayTotal = roundToRupee(dayTotal);
      row.dayCount = dayCount;
      return row;
    });

    // Method-wise grand totals (column footer)
    const methodTotals = {};
    const methodCounts = {};
    methods.forEach(m => {
      methodTotals[m] = 0; methodCounts[m] = 0;
    });
    rows.forEach(r => {
      const m = r._id.method || 'Unknown';
      if (methodTotals[m] == null) {
        methodTotals[m] = 0; methodCounts[m] = 0;
      }
      methodTotals[m] += toNumber(r.total);
      methodCounts[m] += r.count;
    });
    const grandTotal = sumMoney(Object.values(methodTotals));
    const grandCount = Object.values(methodCounts).reduce((a, b) => a + b, 0);

    const periodLabel = period === 'today' ? 'Today'
      : period === 'weekly' ? 'This Week'
        : period === 'custom' ? `${startDate.toLocaleDateString('en-IN')} — ${endDate.toLocaleDateString('en-IN')}`
          : 'This Month';
    const methodLabel = paymentMethod ? ` - ${paymentMethod}` : ' - All Methods';
    const headerInfo = await ImportExportService.getExportHeaderInfo(
      tenantId,
      `Daily Fee Collection Report (${periodLabel}${methodLabel})`
    );

    const today = new Date().toISOString().split('T')[0];
    const fmtINR = (n) => Number(n || 0).toFixed(2);
    const fmtDate = (d) => new Date(`${d  }T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

    const periodSlug = period || 'monthly';

    if (fmt === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Learnovo';
      const ws = workbook.addWorksheet('Daily Collection', {
        pageSetup: {
          paperSize: 9, // 9 = A4
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          horizontalCentered: true,
          margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
        },
        views: [{ state: 'frozen', ySplit: 0 }]
      });

      const colCount = 2 + methods.length + 2; // S.No + Date + methods + Day Total + Txns

      // Title rows
      if (headerInfo.schoolName) {
        ws.addRow([headerInfo.schoolName]);
        ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
        ws.lastRow.font = { bold: true, size: 14 };
        ws.lastRow.alignment = { horizontal: 'center' };
      }
      ws.addRow([`Daily Fee Collection Report — ${periodLabel}${methodLabel}`]);
      ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
      ws.lastRow.font = { bold: true, size: 12 };
      ws.lastRow.alignment = { horizontal: 'center' };

      ws.addRow([`Period: ${startDate.toLocaleDateString('en-IN')} to ${endDate.toLocaleDateString('en-IN')}`]);
      ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
      ws.lastRow.alignment = { horizontal: 'center' };

      ws.addRow([headerInfo.dateTime]);
      ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
      ws.lastRow.alignment = { horizontal: 'center' };
      ws.lastRow.font = { italic: true, size: 9 };
      ws.addRow([]);

      // Column widths — constrained to fit A4 landscape
      ws.columns = [
        { width: 6 },
        { width: 22 },
        ...methods.map(() => ({ width: 13 })),
        { width: 14 },
        { width: 8 }
      ];

      // Header row
      const headerRow = ws.addRow(['S.No', 'Date', ...methods, 'Day Total', 'Txns']);
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7A3A' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
      });

      // Data rows
      pivot.forEach((r, idx) => {
        const values = [
          idx + 1,
          fmtDate(r.date),
          ...methods.map(m => Number(r[m] || 0)),
          Number(r.dayTotal || 0),
          r.dayCount || 0
        ];
        const row = ws.addRow(values);
        row.eachCell((cell, colNumber) => {
          cell.border = { top: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' }, bottom: { style: 'hair' } };
          if (colNumber === 1) cell.alignment = { horizontal: 'center' };
          else if (colNumber === 2) cell.alignment = { horizontal: 'left' };
          else cell.alignment = { horizontal: 'right' };
          if (colNumber >= 3 && colNumber <= 2 + methods.length + 1) {
            cell.numFmt = '#,##0.00';
          }
        });
        if (idx % 2 === 1) {
          row.eachCell(c => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7F6' } };
          });
        }
      });

      // Daily-table column totals footer
      const totalRow = ws.addRow([
        '', 'TOTAL',
        ...methods.map(m => Number(roundToRupee(methodTotals[m] || 0))),
        Number(roundToRupee(grandTotal)),
        grandCount
      ]);
      totalRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
        cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } };
        if (colNumber >= 3 && colNumber <= 2 + methods.length + 1) {
          cell.numFmt = '#,##0.00';
          cell.alignment = { horizontal: 'right' };
        } else if (colNumber === 2) {
          cell.alignment = { horizontal: 'right' };
        } else {
          cell.alignment = { horizontal: 'center' };
        }
      });

      // Spacer
      ws.addRow([]);

      // ── Collection Summary by Payment Method (compact horizontal) ──
      writeHorizontalSummary(ws, colCount, methods, methodCounts, methodTotals, grandCount, grandTotal);

      // Spacer
      ws.addRow([]);
      ws.addRow([]);

      // Signature line for file storage
      const sigRow = ws.addRow(['Prepared by: ______________________', '', '', '', 'Verified by: ______________________']);
      ws.mergeCells(sigRow.number, 1, sigRow.number, Math.floor(colCount / 2));
      ws.mergeCells(sigRow.number, Math.floor(colCount / 2) + 1, sigRow.number, colCount);
      sigRow.font = { size: 10 };
      sigRow.getCell(1).alignment = { horizontal: 'left' };
      sigRow.getCell(Math.floor(colCount / 2) + 1).alignment = { horizontal: 'right' };

      // Repeat header on every printed page
      ws.pageSetup.printTitlesRow = `${headerRow.number}:${headerRow.number}`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=daily_collection_${periodSlug}_${today}.xlsx`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    // CSV export
    const lines = [];
    const q = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    if (headerInfo.schoolName) lines.push(q(headerInfo.schoolName));
    lines.push(q(`Daily Fee Collection Report - ${periodLabel}${methodLabel}`));
    lines.push(q(`Period: ${startDate.toLocaleDateString('en-IN')} to ${endDate.toLocaleDateString('en-IN')}`));
    lines.push(q(headerInfo.dateTime));
    lines.push('');

    const headers = ['S.No', 'Date', ...methods, 'Day Total', 'Txns'];
    lines.push(headers.map(q).join(','));

    pivot.forEach((r, idx) => {
      const row = [
        idx + 1,
        fmtDate(r.date),
        ...methods.map(m => fmtINR(r[m])),
        fmtINR(r.dayTotal),
        r.dayCount
      ];
      lines.push(row.map(q).join(','));
    });

    lines.push([
      '', 'TOTAL',
      ...methods.map(m => fmtINR(methodTotals[m])),
      fmtINR(grandTotal),
      grandCount
    ].map(q).join(','));

    // Collection Summary by Payment Method block
    lines.push('');
    lines.push(q('Collection Summary by Payment Method'));
    lines.push(['', ...methods, 'GRAND TOTAL'].map(q).join(','));
    lines.push(['Transactions', ...methods.map(m => methodCounts[m] || 0), grandCount].map(q).join(','));
    lines.push(['Amount (INR)', ...methods.map(m => fmtINR(methodTotals[m])), fmtINR(grandTotal)].map(q).join(','));

    lines.push('');
    lines.push([q('Prepared by: ______________________'), '', q('Verified by: ______________________')].join(','));

    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=daily_collection_${periodSlug}_${today}.csv`);
    return res.status(200).send(csv);
  } catch (error) {
    logger.error('Collection summary export error', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting collection summary'
    });
  }
});

module.exports = router;
