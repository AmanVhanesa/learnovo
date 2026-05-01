const express = require('express');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const router = express.Router();
const { body, query, param } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { logger } = require('../middleware/errorHandler');
const { roundToRupee, sumMoney } = require('../utils/money');
const Expense = require('../models/Expense');
const ExpenseCategory = require('../models/ExpenseCategory');
const ExpenseBudget = require('../models/ExpenseBudget');

// All routes require auth + admin role
router.use(protect, authorize('admin'));

// ── GET /api/expenses/summary/monthly ────────────────────────────────────────
router.get('/summary/monthly', async(req, res, next) => {
  try {
    const { academicYear, academicSessionId } = req.query;
    const filter = { tenantId: req.user.tenantId, isDeleted: false };
    if (academicSessionId) filter.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);
    else if (academicYear) filter.academicYear = academicYear;

    const monthlyData = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { year: { $year: '$expenseDate' }, month: { $month: '$expenseDate' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json({ success: true, data: monthlyData, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/expenses/summary/category ───────────────────────────────────────
router.get('/summary/category', async(req, res, next) => {
  try {
    const { startDate, endDate, academicSessionId } = req.query;
    const filter = { tenantId: req.user.tenantId, isDeleted: false };
    if (academicSessionId) filter.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);
    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    const categoryData = await Expense.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'expensecategories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: '$categoryInfo' },
      {
        $project: {
          _id: 1,
          total: 1,
          count: 1,
          name: '$categoryInfo.name',
          color: '$categoryInfo.color',
          icon: '$categoryInfo.icon'
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json({ success: true, data: categoryData, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/expenses/summary/dashboard ──────────────────────────────────────
router.get('/summary/dashboard', async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { academicSessionId } = req.query;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Academic year: Apr-Mar
    const academicYearStart = currentMonth >= 3
      ? new Date(currentYear, 3, 1)
      : new Date(currentYear - 1, 3, 1);

    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    const baseFilter = { tenantId, isDeleted: false };
    if (academicSessionId) baseFilter.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);

    const [monthTotal, yearTotal, pendingCount, monthBudgets] = await Promise.all([
      // Total expenses this month
      Expense.aggregate([
        { $match: { ...baseFilter, expenseDate: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Total expenses this academic year
      Expense.aggregate([
        { $match: { ...baseFilter, expenseDate: { $gte: academicYearStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      // Pending approvals
      Expense.countDocuments({ ...baseFilter, status: 'Pending' }),
      // Total budget for this month
      ExpenseBudget.aggregate([
        { $match: { tenantId, month: currentMonth + 1, year: currentYear } },
        { $group: { _id: null, total: { $sum: '$budgetAmount' } } }
      ])
    ]);

    const totalThisMonth = monthTotal[0]?.total || 0;
    const totalThisYear = yearTotal[0]?.total || 0;
    const totalBudget = monthBudgets[0]?.total || 0;
    const budgetUtilization = totalBudget > 0 ? Math.round((totalThisMonth / totalBudget) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalThisMonth,
        totalThisYear,
        pendingApprovals: pendingCount,
        budgetUtilization,
        totalBudget
      },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/expenses/export ─────────────────────────────────────────────────
router.get('/export', async(req, res, next) => {
  try {
    const { startDate, endDate, category, status, paymentMethod, academicSessionId, format } = req.query;
    const fmt = (format || 'excel').toLowerCase();
    const filter = { tenantId: req.user.tenantId, isDeleted: false };
    if (academicSessionId) filter.academicSessionId = academicSessionId;

    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }
    if (category) filter.category = category;
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    const expenses = await Expense.find(filter)
      .populate('category', 'name')
      .populate('addedBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ expenseDate: -1 })
      .lean();

    const ImportExportService = require('../services/importExportService');

    // Period label
    const sd = startDate ? new Date(startDate) : null;
    const ed = endDate ? new Date(endDate) : null;
    let periodText = 'All Dates';
    if (sd && ed) {
      const sameMonth = sd.getMonth() === ed.getMonth() && sd.getFullYear() === ed.getFullYear();
      const monthName = sd.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      const range = `${sd.toLocaleDateString('en-IN')} to ${ed.toLocaleDateString('en-IN')}`;
      periodText = sameMonth ? `${range} (${monthName})` : range;
    } else if (sd) periodText = `From ${sd.toLocaleDateString('en-IN')}`;
    else if (ed) periodText = `Until ${ed.toLocaleDateString('en-IN')}`;

    const methodLabel = paymentMethod ? `Method: ${paymentMethod}` : 'All Payment Methods';
    const statusLabel = status ? `Status: ${status}` : 'All Statuses';
    const headerInfo = await ImportExportService.getExportHeaderInfo(
      req.user.tenantId,
      `Expense Report - ${periodText}`
    );

    // Totals by category & method
    const categoryTotals = {};
    const categoryCounts = {};
    const methodTotals = {};
    const methodCounts = {};
    expenses.forEach(e => {
      const c = e.category?.name || 'Uncategorized';
      const m = e.paymentMethod || 'Unknown';
      categoryTotals[c] = (categoryTotals[c] || 0) + Number(e.amount || 0);
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
      methodTotals[m] = (methodTotals[m] || 0) + Number(e.amount || 0);
      methodCounts[m] = (methodCounts[m] || 0) + 1;
    });
    const grandTotal = sumMoney(expenses.map(e => e.amount));
    const grandCount = expenses.length;

    const today = new Date().toISOString().split('T')[0];

    if (fmt === 'excel' || fmt === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Learnovo';
      const ws = workbook.addWorksheet('Expenses', {
        pageSetup: {
          paperSize: 9, orientation: 'portrait', fitToPage: true,
          fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
          margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
        }
      });

      const colCount = 10;
      ws.columns = [
        { width: 5 },   // #
        { width: 11 },  // Date
        { width: 24 },  // Title
        { width: 16 },  // Category
        { width: 13 },  // Amount
        { width: 13 },  // Method
        { width: 14 },  // Reference
        { width: 11 },  // Status
        { width: 16 },  // Added By
        { width: 16 }   // Approved By
      ];

      // ── Logo ──
      if (headerInfo.logo) {
        try {
          const axios = require('axios');
          const resp = await axios.get(headerInfo.logo, { responseType: 'arraybuffer', timeout: 5000 });
          const m = headerInfo.logo.match(/\.(png|jpe?g|gif)(?:\?|$)/i);
          const ext = (m?.[1] || 'png').toLowerCase().replace('jpg', 'jpeg');
          const imageId = workbook.addImage({
            buffer: Buffer.from(resp.data),
            extension: ext
          });
          ws.addImage(imageId, {
            tl: { col: 0, row: 0 },
            ext: { width: 80, height: 80 }
          });
        } catch (e) {
          logger.warn('Failed to embed logo in expense export', { error: e.message });
        }
      }

      // ── Header block ──
      if (headerInfo.schoolName) {
        ws.addRow([headerInfo.schoolName]);
        ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
        ws.lastRow.font = { bold: true, size: 16 };
        ws.lastRow.alignment = { horizontal: 'center' };
      }
      ws.addRow(['Expense Report']);
      ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
      ws.lastRow.font = { bold: true, size: 12 };
      ws.lastRow.alignment = { horizontal: 'center' };

      ws.addRow([`${periodText} · ${methodLabel} · ${statusLabel}`]);
      ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
      ws.lastRow.font = { size: 10 };
      ws.lastRow.alignment = { horizontal: 'center' };

      ws.addRow([headerInfo.dateTime]);
      ws.mergeCells(ws.lastRow.number, 1, ws.lastRow.number, colCount);
      ws.lastRow.alignment = { horizontal: 'center' };
      ws.lastRow.font = { italic: true, size: 9, color: { argb: 'FF666666' } };
      ws.addRow([]);

      // ── Expense details ──
      const listTitle = ws.addRow(['EXPENSE DETAILS']);
      ws.mergeCells(listTitle.number, 1, listTitle.number, colCount);
      listTitle.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      listTitle.alignment = { horizontal: 'center' };
      listTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7A3A' } };

      const headerRow = ws.addRow(['#', 'Date', 'Title', 'Category', 'Amount', 'Method', 'Reference', 'Status', 'Added By', 'Approved By']);
      headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF333333' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
      });
      headerRow.height = 22;

      expenses.forEach((e, idx) => {
        const row = ws.addRow([
          idx + 1,
          e.expenseDate ? new Date(e.expenseDate).toLocaleDateString('en-IN') : '',
          e.title || '',
          e.category?.name || '-',
          Number(e.amount || 0),
          e.paymentMethod || '-',
          e.paymentReference || '-',
          e.status || '-',
          e.addedBy?.name || '-',
          e.approvedBy?.name || '-'
        ]);
        row.height = 18;
        row.eachCell((cell, colNumber) => {
          cell.border = { top: { style: 'hair' }, left: { style: 'hair' }, right: { style: 'hair' }, bottom: { style: 'hair' } };
          if (colNumber === 5) {
            cell.numFmt = '₹#,##0.00'; cell.alignment = { horizontal: 'right' };
          } else if (colNumber === 1 || colNumber === 2 || colNumber === 6 || colNumber === 8) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else cell.alignment = { horizontal: 'left', vertical: 'middle' };
        });
        if (idx % 2 === 1) row.eachCell(c => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } };
        });
      });

      // Grand total
      const totalRow = ws.addRow(['', '', '', 'TOTAL', Number(roundToRupee(grandTotal)), '', '', '', '', '']);
      ws.mergeCells(totalRow.number, 1, totalRow.number, 4);
      totalRow.eachCell((cell, colNumber) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } };
        cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
        if (colNumber === 5) {
          cell.numFmt = '₹#,##0.00'; cell.alignment = { horizontal: 'right' };
        } else cell.alignment = { horizontal: 'right' };
      });
      totalRow.height = 20;
      ws.addRow([]);

      // ── Category summary ──
      const catTitle = ws.addRow(['CATEGORY SUMMARY']);
      ws.mergeCells(catTitle.number, 1, catTitle.number, colCount);
      catTitle.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      catTitle.alignment = { horizontal: 'center' };
      catTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7A3A' } };

      const ch = ws.addRow(['Category', '', '', 'Transactions', '', '', 'Amount (INR)', '', '', '']);
      ws.mergeCells(ch.number, 1, ch.number, 3);
      ws.mergeCells(ch.number, 4, ch.number, 6);
      ws.mergeCells(ch.number, 7, ch.number, 10);
      ch.font = { bold: true, size: 10 };
      ch.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
        c.alignment = { horizontal: 'center' };
        c.border = { bottom: { style: 'thin' } };
      });
      Object.keys(categoryTotals).sort((a, b) => categoryTotals[b] - categoryTotals[a]).forEach(c => {
        const r = ws.addRow([c, '', '', categoryCounts[c] || 0, '', '', Number(roundToRupee(categoryTotals[c] || 0)), '', '', '']);
        ws.mergeCells(r.number, 1, r.number, 3);
        ws.mergeCells(r.number, 4, r.number, 6);
        ws.mergeCells(r.number, 7, r.number, 10);
        r.getCell(1).alignment = { horizontal: 'center' };
        r.getCell(4).alignment = { horizontal: 'center' };
        r.getCell(7).alignment = { horizontal: 'center' };
        r.getCell(7).numFmt = '₹#,##0.00';
        r.font = { size: 10 };
      });
      ws.addRow([]);

      // ── Method summary ──
      const mTitle = ws.addRow(['PAYMENT METHOD SUMMARY']);
      ws.mergeCells(mTitle.number, 1, mTitle.number, colCount);
      mTitle.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      mTitle.alignment = { horizontal: 'center' };
      mTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F7A3A' } };

      const mh = ws.addRow(['Payment Method', '', '', 'Transactions', '', '', 'Amount (INR)', '', '', '']);
      ws.mergeCells(mh.number, 1, mh.number, 3);
      ws.mergeCells(mh.number, 4, mh.number, 6);
      ws.mergeCells(mh.number, 7, mh.number, 10);
      mh.font = { bold: true, size: 10 };
      mh.eachCell(c => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
        c.alignment = { horizontal: 'center' };
        c.border = { bottom: { style: 'thin' } };
      });
      Object.keys(methodTotals).sort((a, b) => methodTotals[b] - methodTotals[a]).forEach(m => {
        const r = ws.addRow([m, '', '', methodCounts[m] || 0, '', '', Number(roundToRupee(methodTotals[m] || 0)), '', '', '']);
        ws.mergeCells(r.number, 1, r.number, 3);
        ws.mergeCells(r.number, 4, r.number, 6);
        ws.mergeCells(r.number, 7, r.number, 10);
        r.getCell(1).alignment = { horizontal: 'center' };
        r.getCell(4).alignment = { horizontal: 'center' };
        r.getCell(7).alignment = { horizontal: 'center' };
        r.getCell(7).numFmt = '₹#,##0.00';
        r.font = { size: 10 };
      });

      const grandLine = ws.addRow(['GRAND TOTAL', '', '', grandCount, '', '', Number(roundToRupee(grandTotal)), '', '', '']);
      ws.mergeCells(grandLine.number, 1, grandLine.number, 3);
      ws.mergeCells(grandLine.number, 4, grandLine.number, 6);
      ws.mergeCells(grandLine.number, 7, grandLine.number, 10);
      grandLine.eachCell(c => {
        c.font = { bold: true, size: 11 };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF5EC' } };
        c.alignment = { horizontal: 'center' };
        c.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
      });
      grandLine.getCell(7).numFmt = '₹#,##0.00';

      ws.addRow([]); ws.addRow([]);
      const sigRow = ws.addRow(['Prepared by: ______________________', '', '', '', '', 'Verified by: ______________________', '', '', '', '']);
      ws.mergeCells(sigRow.number, 1, sigRow.number, 5);
      ws.mergeCells(sigRow.number, 6, sigRow.number, colCount);
      sigRow.font = { size: 10 };
      sigRow.getCell(1).alignment = { horizontal: 'left' };
      sigRow.getCell(6).alignment = { horizontal: 'right' };

      ws.pageSetup.printTitlesRow = `${headerRow.number}:${headerRow.number}`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=expenses_${today}.xlsx`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    // CSV fallback
    const headers = ['Date', 'Title', 'Category', 'Amount', 'Payment Method', 'Reference', 'Status', 'Added By', 'Approved By', 'Description'];
    const rows = expenses.map(e => [
      new Date(e.expenseDate).toLocaleDateString('en-IN'),
      `"${(e.title || '').replace(/"/g, '""')}"`,
      e.category?.name || '',
      e.amount,
      e.paymentMethod,
      e.paymentReference || '',
      e.status,
      e.addedBy?.name || '',
      e.approvedBy?.name || '',
      `"${(e.description || '').replace(/"/g, '""')}"`
    ]);

    const reportHeader = [];
    if (headerInfo.schoolName) reportHeader.push(`"${headerInfo.schoolName}"`);
    reportHeader.push('"Expense Report"');
    reportHeader.push(`"${headerInfo.dateTime}"`);
    reportHeader.push('');

    const csv = [...reportHeader, headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=expenses_${today}.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// ── GET /api/expenses ────────────────────────────────────────────────────────
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['Pending', 'Approved', 'Rejected']),
  query('paymentMethod').optional().isIn(['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card']),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category, paymentMethod, startDate, endDate, search, sortBy = 'expenseDate', sortOrder = 'desc', source, academicSessionId } = req.query;
    const filter = { tenantId: req.user.tenantId, isDeleted: false };

    if (academicSessionId) filter.academicSessionId = academicSessionId;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    // Source filter: 'manual' | 'payroll' | 'all' (default: all)
    if (source === 'manual') {
      filter.isSystemGenerated = { $ne: true };
    } else if (source === 'payroll') {
      filter.referenceType = 'payroll';
      filter.isSystemGenerated = true;
    }
    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [expenses, total] = await Promise.all([
      Expense.find(filter)
        .populate('category', 'name color icon')
        .populate('addedBy', 'name')
        .populate('approvedBy', 'name')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Expense.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: expenses,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/expenses/:id ────────────────────────────────────────────────────
router.get('/:id', [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, tenantId: req.user.tenantId, isDeleted: false })
      .populate('category', 'name color icon')
      .populate('addedBy', 'name email')
      .populate('approvedBy', 'name email');

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found', requestId: req.requestId });
    }

    res.json({ success: true, data: expense, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/expenses ───────────────────────────────────────────────────────
router.post('/', [
  body('category').isMongoId().withMessage('Valid category is required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('expenseDate').isISO8601().withMessage('Valid date is required'),
  body('paymentMethod').isIn(['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card']).withMessage('Valid payment method is required'),
  body('paymentReference').optional().trim(),
  body('description').optional().trim(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const { category, title, amount, expenseDate, paymentMethod, paymentReference, description, receiptUrl, academicYear, academicSessionId } = req.body;

    const expense = await Expense.create({
      tenantId: req.user.tenantId,
      category,
      title,
      amount,
      expenseDate,
      paymentMethod,
      paymentReference,
      description,
      receiptUrl,
      academicYear,
      academicSessionId: academicSessionId || undefined,
      addedBy: req.user._id
    });

    const populated = await Expense.findById(expense._id)
      .populate('category', 'name color icon')
      .populate('addedBy', 'name');

    res.status(201).json({ success: true, data: populated, message: 'Expense added successfully', requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── PUT /api/expenses/:id ────────────────────────────────────────────────────
router.put('/:id', [
  param('id').isMongoId(),
  body('category').optional().isMongoId(),
  body('title').optional().trim().notEmpty(),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('expenseDate').optional().isISO8601(),
  body('paymentMethod').optional().isIn(['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card']),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, tenantId: req.user.tenantId, isDeleted: false });
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found', requestId: req.requestId });
    }

    // Prevent editing system-generated records (auto-synced from payroll)
    if (expense.isSystemGenerated) {
      return res.status(403).json({ success: false, message: 'System-generated expense records cannot be edited. This record was auto-created from payroll.', requestId: req.requestId });
    }

    const { category, title, amount, expenseDate, paymentMethod, paymentReference, description, receiptUrl, academicYear, academicSessionId } = req.body;
    if (category !== undefined) expense.category = category;
    if (title !== undefined) expense.title = title;
    if (amount !== undefined) expense.amount = amount;
    if (expenseDate !== undefined) expense.expenseDate = expenseDate;
    if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod;
    if (paymentReference !== undefined) expense.paymentReference = paymentReference;
    if (description !== undefined) expense.description = description;
    if (receiptUrl !== undefined) expense.receiptUrl = receiptUrl;
    if (academicYear !== undefined) expense.academicYear = academicYear;
    if (academicSessionId !== undefined) expense.academicSessionId = academicSessionId;

    await expense.save();

    const populated = await Expense.findById(expense._id)
      .populate('category', 'name color icon')
      .populate('addedBy', 'name')
      .populate('approvedBy', 'name');

    res.json({ success: true, data: populated, message: 'Expense updated successfully', requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /api/expenses/:id (soft delete) ───────────────────────────────────
router.delete('/:id', [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    // Check if system-generated before deleting
    const expenseCheck = await Expense.findOne({ _id: req.params.id, tenantId: req.user.tenantId, isDeleted: false });
    if (expenseCheck && expenseCheck.isSystemGenerated) {
      return res.status(403).json({ success: false, message: 'System-generated expense records cannot be deleted. This record was auto-created from payroll.', requestId: req.requestId });
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found', requestId: req.requestId });
    }

    res.json({ success: true, message: 'Expense deleted successfully', requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /api/expenses/:id/approve ──────────────────────────────────────────
router.patch('/:id/approve', [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, isDeleted: false, status: 'Pending' },
      { status: 'Approved', approvedBy: req.user._id },
      { new: true }
    ).populate('category', 'name color icon')
      .populate('addedBy', 'name')
      .populate('approvedBy', 'name');

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found or already processed', requestId: req.requestId });
    }

    res.json({ success: true, data: expense, message: 'Expense approved', requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── PATCH /api/expenses/:id/reject ───────────────────────────────────────────
router.patch('/:id/reject', [
  param('id').isMongoId(),
  body('reason').optional().trim(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, isDeleted: false, status: 'Pending' },
      { status: 'Rejected', approvedBy: req.user._id, rejectionReason: req.body.reason || '' },
      { new: true }
    ).populate('category', 'name color icon')
      .populate('addedBy', 'name')
      .populate('approvedBy', 'name');

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found or already processed', requestId: req.requestId });
    }

    res.json({ success: true, data: expense, message: 'Expense rejected', requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── Bulk approve ─────────────────────────────────────────────────────────────
router.patch('/bulk/approve', [
  body('ids').isArray({ min: 1 }).withMessage('At least one expense ID required'),
  body('ids.*').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const result = await Expense.updateMany(
      { _id: { $in: req.body.ids }, tenantId: req.user.tenantId, isDeleted: false, status: 'Pending' },
      { status: 'Approved', approvedBy: req.user._id }
    );

    res.json({ success: true, message: `${result.modifiedCount} expenses approved`, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── Bulk delete ──────────────────────────────────────────────────────────────
router.delete('/bulk/delete', [
  body('ids').isArray({ min: 1 }),
  body('ids.*').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    // Only delete manual records — skip system-generated ones
    const result = await Expense.updateMany(
      { _id: { $in: req.body.ids }, tenantId: req.user.tenantId, isDeleted: false, isSystemGenerated: { $ne: true } },
      { isDeleted: true }
    );

    res.json({ success: true, message: `${result.modifiedCount} expenses deleted`, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── Categories CRUD ──────────────────────────────────────────────────────────

router.get('/categories/list', async(req, res, next) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    if (req.query.activeOnly === 'true') filter.isActive = true;

    const categories = await ExpenseCategory.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, data: categories, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

router.post('/categories', [
  body('name').trim().notEmpty().withMessage('Category name is required'),
  body('icon').optional().trim(),
  body('color').optional().trim(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const { name, icon, color } = req.body;

    const existing = await ExpenseCategory.findOne({ tenantId: req.user.tenantId, name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Category already exists', requestId: req.requestId });
    }

    const category = await ExpenseCategory.create({ tenantId: req.user.tenantId, name, icon, color });
    res.status(201).json({ success: true, data: category, message: 'Category created', requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

router.put('/categories/:id', [
  param('id').isMongoId(),
  body('name').optional().trim().notEmpty(),
  body('icon').optional().trim(),
  body('color').optional().trim(),
  body('isActive').optional().isBoolean(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const category = await ExpenseCategory.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found', requestId: req.requestId });
    }

    res.json({ success: true, data: category, message: 'Category updated', requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

router.delete('/categories/:id', [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const category = await ExpenseCategory.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found', requestId: req.requestId });
    }

    res.json({ success: true, message: 'Category deactivated', requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── Budget CRUD ──────────────────────────────────────────────────────────────

router.get('/budget', async(req, res, next) => {
  try {
    const { month, year, academicSessionId } = req.query;
    const filter = { tenantId: req.user.tenantId };
    if (academicSessionId) filter.academicSessionId = academicSessionId;
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);

    const budgets = await ExpenseBudget.find(filter)
      .populate('category', 'name color icon')
      .sort({ 'category.name': 1 })
      .lean();

    // Also get spent amounts for each category in the given month
    if (month && year) {
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

      const spent = await Expense.aggregate([
        {
          $match: {
            tenantId: req.user.tenantId,
            isDeleted: false,
            expenseDate: { $gte: monthStart, $lte: monthEnd }
          }
        },
        { $group: { _id: '$category', spent: { $sum: '$amount' } } }
      ]);

      const spentMap = {};
      spent.forEach(s => {
        spentMap[s._id.toString()] = s.spent;
      });

      budgets.forEach(b => {
        b.spent = spentMap[b.category?._id?.toString()] || 0;
        b.remaining = b.budgetAmount - b.spent;
        b.utilization = b.budgetAmount > 0 ? Math.round((b.spent / b.budgetAmount) * 100) : 0;
      });
    }

    res.json({ success: true, data: budgets, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

router.post('/budget', [
  body('category').isMongoId().withMessage('Valid category is required'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Valid month (1-12) is required'),
  body('year').isInt({ min: 2020 }).withMessage('Valid year is required'),
  body('budgetAmount').isFloat({ min: 0 }).withMessage('Budget amount must be >= 0'),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const { category, month, year, budgetAmount, academicSessionId } = req.body;

    const budget = await ExpenseBudget.findOneAndUpdate(
      { tenantId: req.user.tenantId, category, month, year },
      { budgetAmount, ...(academicSessionId ? { academicSessionId } : {}) },
      { new: true, upsert: true, runValidators: true }
    ).populate('category', 'name color icon');

    res.json({ success: true, data: budget, message: 'Budget saved', requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── Seed default categories ──────────────────────────────────────────────────
router.post('/categories/seed', async(req, res, next) => {
  try {
    const defaults = [
      { name: 'Salaries', icon: 'Users', color: '#3B82F6' },
      { name: 'Infrastructure', icon: 'Building2', color: '#8B5CF6' },
      { name: 'Stationery', icon: 'Pencil', color: '#F59E0B' },
      { name: 'Transport', icon: 'Bus', color: '#10B981' },
      { name: 'Events', icon: 'Calendar', color: '#EC4899' },
      { name: 'Utilities', icon: 'Zap', color: '#F97316' },
      { name: 'Maintenance', icon: 'Wrench', color: '#6366F1' },
      { name: 'Miscellaneous', icon: 'MoreHorizontal', color: '#6B7280' }
    ];

    let created = 0;
    for (const cat of defaults) {
      const exists = await ExpenseCategory.findOne({ tenantId: req.user.tenantId, name: cat.name });
      if (!exists) {
        await ExpenseCategory.create({ tenantId: req.user.tenantId, ...cat });
        created++;
      }
    }

    res.json({ success: true, message: `${created} default categories created`, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
