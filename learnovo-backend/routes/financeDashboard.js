const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');

// All routes require auth + admin role
router.use(protect, authorize('admin'));

// ── GET /api/finance/dashboard ───────────────────────────────────────────────
// Combined finance dashboard: income vs expense overview
router.get('/dashboard', async(req, res, next) => {
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

    const incomeFilter = { tenantId, isDeleted: false };
    const expenseFilter = { tenantId, isDeleted: false };
    if (academicSessionId) {
      const sessionOid = new mongoose.Types.ObjectId(academicSessionId);
      incomeFilter.academicSessionId = sessionOid;
      expenseFilter.academicSessionId = sessionOid;
    }

    const [
      incomeThisMonth,
      incomeThisYear,
      expenseThisMonth,
      expenseThisYear,
      pendingApprovals,
      recentIncome,
      recentExpenses
    ] = await Promise.all([
      Income.aggregate([
        { $match: { ...incomeFilter, incomeDate: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Income.aggregate([
        { $match: { ...incomeFilter, incomeDate: { $gte: academicYearStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Expense.aggregate([
        { $match: { ...expenseFilter, expenseDate: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Expense.aggregate([
        { $match: { ...expenseFilter, expenseDate: { $gte: academicYearStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Expense.countDocuments({ ...expenseFilter, status: 'Pending' }),
      Income.find(incomeFilter)
        .populate('category', 'name color icon')
        .sort({ incomeDate: -1 })
        .limit(5)
        .lean(),
      Expense.find(expenseFilter)
        .populate('category', 'name color icon')
        .sort({ expenseDate: -1 })
        .limit(5)
        .lean()
    ]);

    const incMonth = incomeThisMonth[0]?.total || 0;
    const incYear = incomeThisYear[0]?.total || 0;
    const expMonth = expenseThisMonth[0]?.total || 0;
    const expYear = expenseThisYear[0]?.total || 0;

    // Build combined recent transactions (latest 10)
    const recentTransactions = [
      ...recentIncome.map(i => ({
        _id: i._id,
        type: 'income',
        title: i.title,
        amount: i.amount,
        date: i.incomeDate,
        category: i.category,
        paymentMethod: i.paymentMethod
      })),
      ...recentExpenses.map(e => ({
        _id: e._id,
        type: 'expense',
        title: e.title,
        amount: e.amount,
        date: e.expenseDate,
        category: e.category,
        paymentMethod: e.paymentMethod,
        status: e.status
      }))
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        incomeThisMonth: incMonth,
        incomeThisYear: incYear,
        expenseThisMonth: expMonth,
        expenseThisYear: expYear,
        netBalanceMonth: incMonth - expMonth,
        netBalanceYear: incYear - expYear,
        pendingApprovals,
        recentTransactions
      },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/finance/monthly-comparison ──────────────────────────────────────
// Income vs Expense comparison by month (last 6 months)
router.get('/monthly-comparison', async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { academicSessionId } = req.query;
    const months = parseInt(req.query.months) || 6;
    const now = new Date();

    // Calculate start date (N months ago)
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const incFilter = { tenantId, isDeleted: false, incomeDate: { $gte: startDate } };
    const expFilter = { tenantId, isDeleted: false, expenseDate: { $gte: startDate } };
    if (academicSessionId) {
      const sessionOid = new mongoose.Types.ObjectId(academicSessionId);
      incFilter.academicSessionId = sessionOid;
      expFilter.academicSessionId = sessionOid;
    }

    const [incomeMonthly, expenseMonthly] = await Promise.all([
      Income.aggregate([
        { $match: incFilter },
        {
          $group: {
            _id: { year: { $year: '$incomeDate' }, month: { $month: '$incomeDate' } },
            total: { $sum: '$amount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Expense.aggregate([
        { $match: expFilter },
        {
          $group: {
            _id: { year: { $year: '$expenseDate' }, month: { $month: '$expenseDate' } },
            total: { $sum: '$amount' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
    ]);

    // Build comparison data for each month
    const comparison = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;

      const inc = incomeMonthly.find(m => m._id.year === year && m._id.month === month);
      const exp = expenseMonthly.find(m => m._id.year === year && m._id.month === month);

      comparison.push({
        year,
        month,
        income: inc?.total || 0,
        expense: exp?.total || 0,
        net: (inc?.total || 0) - (exp?.total || 0)
      });
    }

    res.json({ success: true, data: comparison, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/finance/expense-breakdown ────────────────────────────────────────
// Expense breakdown by category for pie/donut chart
router.get('/expense-breakdown', async(req, res, next) => {
  try {
    const { startDate, endDate, academicSessionId } = req.query;
    const filter = { tenantId: req.user.tenantId, isDeleted: false };
    if (academicSessionId) filter.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);

    if (startDate || endDate) {
      filter.expenseDate = {};
      if (startDate) filter.expenseDate.$gte = new Date(startDate);
      if (endDate) filter.expenseDate.$lte = new Date(endDate);
    }

    const breakdown = await Expense.aggregate([
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
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          total: 1,
          count: 1,
          name: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] },
          color: { $ifNull: ['$categoryInfo.color', '#6B7280'] }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json({ success: true, data: breakdown, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/finance/report ──────────────────────────────────────────────────
// Combined finance report for export (PDF/CSV)
router.get('/report', async(req, res, next) => {
  try {
    const { startDate, endDate, format = 'json', academicSessionId } = req.query;
    const tenantId = req.user.tenantId;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const incomeFilter = { tenantId, isDeleted: false };
    const expenseFilter = { tenantId, isDeleted: false };
    if (academicSessionId) {
      incomeFilter.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);
      expenseFilter.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);
    }
    if (startDate || endDate) {
      incomeFilter.incomeDate = dateFilter;
      expenseFilter.expenseDate = dateFilter;
    }

    const [incomes, expenses, incomeByCat, expenseByCat] = await Promise.all([
      Income.find(incomeFilter)
        .populate('category', 'name')
        .populate('addedBy', 'name')
        .sort({ incomeDate: -1 })
        .lean(),
      Expense.find(expenseFilter)
        .populate('category', 'name')
        .populate('addedBy', 'name')
        .populate('approvedBy', 'name')
        .sort({ expenseDate: -1 })
        .lean(),
      Income.aggregate([
        { $match: incomeFilter },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $lookup: { from: 'incomecategories', localField: '_id', foreignField: '_id', as: 'cat' } },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
        { $project: { total: 1, count: 1, name: '$cat.name' } },
        { $sort: { total: -1 } }
      ]),
      Expense.aggregate([
        { $match: expenseFilter },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $lookup: { from: 'expensecategories', localField: '_id', foreignField: '_id', as: 'cat' } },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
        { $project: { total: 1, count: 1, name: '$cat.name' } },
        { $sort: { total: -1 } }
      ])
    ]);

    const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
    const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

    if (format === 'csv') {
      // Build CSV with both income and expense sections
      const lines = [];
      lines.push('INCOME & EXPENSE REPORT');
      lines.push(`Period: ${startDate || 'All Time'} to ${endDate || 'Present'}`);
      lines.push('');

      lines.push('--- INCOME ---');
      lines.push('Date,Title,Category,Amount,Payment Method,Received By');
      incomes.forEach(i => {
        lines.push([
          new Date(i.incomeDate).toLocaleDateString('en-IN'),
          `"${(i.title || '').replace(/"/g, '""')}"`,
          i.category?.name || '',
          i.amount,
          i.paymentMethod,
          `"${(i.receivedBy || '').replace(/"/g, '""')}"`
        ].join(','));
      });
      lines.push(`Total Income,,,"${totalIncome}",,`);
      lines.push('');

      lines.push('--- EXPENSES ---');
      lines.push('Date,Title,Category,Amount,Payment Method,Status');
      expenses.forEach(e => {
        lines.push([
          new Date(e.expenseDate).toLocaleDateString('en-IN'),
          `"${(e.title || '').replace(/"/g, '""')}"`,
          e.category?.name || '',
          e.amount,
          e.paymentMethod,
          e.status
        ].join(','));
      });
      lines.push(`Total Expenses,,,"${totalExpense}",,`);
      lines.push('');
      lines.push(`Net Balance,,,"${totalIncome - totalExpense}",,`);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=finance-report.csv');
      return res.send(lines.join('\n'));
    }

    res.json({
      success: true,
      data: {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
        incomeSummary: incomeByCat,
        expenseSummary: expenseByCat,
        incomes,
        expenses,
        period: { startDate: startDate || null, endDate: endDate || null }
      },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/finance/income-breakdown ────────────────────────────────────────
// Income breakdown by category for pie/donut chart
router.get('/income-breakdown', async(req, res, next) => {
  try {
    const { startDate, endDate, academicSessionId } = req.query;
    const filter = { tenantId: req.user.tenantId, isDeleted: false };
    if (academicSessionId) filter.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);

    if (startDate || endDate) {
      filter.incomeDate = {};
      if (startDate) filter.incomeDate.$gte = new Date(startDate);
      if (endDate) filter.incomeDate.$lte = new Date(endDate);
    }

    const breakdown = await Income.aggregate([
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
          from: 'incomecategories',
          localField: '_id',
          foreignField: '_id',
          as: 'categoryInfo'
        }
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          total: 1,
          count: 1,
          name: { $ifNull: ['$categoryInfo.name', 'Uncategorized'] },
          color: { $ifNull: ['$categoryInfo.color', '#6B7280'] }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json({ success: true, data: breakdown, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/finance/fee-collection-rate ─────────────────────────────────────
// Fee collection rate from the Fees module
router.get('/fee-collection-rate', async(req, res, next) => {
  try {
    const tenantId = new mongoose.Types.ObjectId(req.user.tenantId);
    const { academicSessionId } = req.query;

    const invoiceFilter = { tenantId, status: { $ne: 'Cancelled' } };
    const paymentFilter = { tenantId, isConfirmed: true, isReversed: { $ne: true } };
    if (academicSessionId) {
      const sessionOid = new mongoose.Types.ObjectId(academicSessionId);
      invoiceFilter.academicSessionId = sessionOid;
      paymentFilter.academicSessionId = sessionOid;
    }

    // Total invoiced (all non-cancelled invoices)
    const invoicedAgg = await FeeInvoice.aggregate([
      { $match: invoiceFilter },
      { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
    ]);

    // Total collected (confirmed, non-reversed payments)
    const collectedAgg = await Payment.aggregate([
      { $match: paymentFilter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalInvoiced = invoicedAgg[0]?.total || 0;
    const totalCollected = collectedAgg[0]?.total || 0;
    const totalInvoices = invoicedAgg[0]?.count || 0;
    const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;

    res.json({
      success: true,
      data: {
        totalInvoiced,
        totalCollected,
        totalInvoices,
        collectionRate
      },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
