const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { body, query, param } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const Income = require('../models/Income');
const IncomeCategory = require('../models/IncomeCategory');

// All routes require auth + admin role
router.use(protect, authorize('admin'));

// ── GET /api/income/summary/monthly ──────────────────────────────────────────
router.get('/summary/monthly', async(req, res, next) => {
  try {
    const { academicYear, academicSessionId } = req.query;
    const filter = { tenantId: req.user.tenantId, isDeleted: false };
    if (academicSessionId) filter.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);
    else if (academicYear) filter.academicYear = academicYear;

    const monthlyData = await Income.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { year: { $year: '$incomeDate' }, month: { $month: '$incomeDate' } },
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

// ── GET /api/income/summary/category ─────────────────────────────────────────
router.get('/summary/category', async(req, res, next) => {
  try {
    const { startDate, endDate, academicSessionId } = req.query;
    const filter = { tenantId: req.user.tenantId, isDeleted: false };
    if (academicSessionId) filter.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);
    if (startDate || endDate) {
      filter.incomeDate = {};
      if (startDate) filter.incomeDate.$gte = new Date(startDate);
      if (endDate) filter.incomeDate.$lte = new Date(endDate);
    }

    const categoryData = await Income.aggregate([
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

// ── GET /api/income/summary/dashboard ────────────────────────────────────────
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

    const [monthTotal, yearTotal, totalCount] = await Promise.all([
      Income.aggregate([
        { $match: { ...baseFilter, incomeDate: { $gte: monthStart, $lte: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Income.aggregate([
        { $match: { ...baseFilter, incomeDate: { $gte: academicYearStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Income.countDocuments(baseFilter)
    ]);

    res.json({
      success: true,
      data: {
        totalThisMonth: monthTotal[0]?.total || 0,
        totalThisYear: yearTotal[0]?.total || 0,
        totalRecords: totalCount
      },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/income/export ───────────────────────────────────────────────────
router.get('/export', async(req, res, next) => {
  try {
    const { startDate, endDate, category, paymentMethod, academicSessionId } = req.query;
    const filter = { tenantId: req.user.tenantId, isDeleted: false };
    if (academicSessionId) filter.academicSessionId = academicSessionId;

    if (startDate || endDate) {
      filter.incomeDate = {};
      if (startDate) filter.incomeDate.$gte = new Date(startDate);
      if (endDate) filter.incomeDate.$lte = new Date(endDate);
    }
    if (category) filter.category = category;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    const incomes = await Income.find(filter)
      .populate('category', 'name')
      .populate('addedBy', 'name')
      .sort({ incomeDate: -1 })
      .lean();

    // Get school name for header
    const ImportExportService = require('../services/importExportService');
    const headerInfo = await ImportExportService.getExportHeaderInfo(req.user.tenantId, 'Income Report');

    const headers = ['Date', 'Title', 'Category', 'Amount', 'Payment Method', 'Reference', 'Received By', 'Added By', 'Description'];
    const rows = incomes.map(i => [
      new Date(i.incomeDate).toLocaleDateString('en-IN'),
      `"${(i.title || '').replace(/"/g, '""')}"`,
      i.category?.name || '',
      i.amount,
      i.paymentMethod,
      i.paymentReference || '',
      `"${(i.receivedBy || '').replace(/"/g, '""')}"`,
      i.addedBy?.name || '',
      `"${(i.description || '').replace(/"/g, '""')}"`
    ]);

    const reportHeader = [];
    if (headerInfo.schoolName) reportHeader.push(`"${headerInfo.schoolName}"`);
    reportHeader.push('"Income Report"');
    reportHeader.push(`"${headerInfo.dateTime}"`);
    reportHeader.push('');

    const csv = [...reportHeader, headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=income.csv');
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

// ── GET /api/income ──────────────────────────────────────────────────────────
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('paymentMethod').optional().isIn(['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card']),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const { page = 1, limit = 20, category, paymentMethod, startDate, endDate, search, sortBy = 'incomeDate', sortOrder = 'desc', source, academicSessionId } = req.query;
    const filter = { tenantId: req.user.tenantId, isDeleted: false };

    if (academicSessionId) filter.academicSessionId = academicSessionId;
    if (category) filter.category = category;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    // Source filter: 'manual' | 'fee_collection' | 'all' (default: all)
    if (source === 'manual') {
      filter.isSystemGenerated = { $ne: true };
    } else if (source === 'fee_collection') {
      filter.referenceType = 'fee_payment';
      filter.isSystemGenerated = true;
    }
    if (startDate || endDate) {
      filter.incomeDate = {};
      if (startDate) filter.incomeDate.$gte = new Date(startDate);
      if (endDate) filter.incomeDate.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { receivedBy: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [incomes, total] = await Promise.all([
      Income.find(filter)
        .populate('category', 'name color icon')
        .populate('addedBy', 'name')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Income.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: incomes,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
      requestId: req.requestId
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/income/:id ──────────────────────────────────────────────────────
router.get('/:id', [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const income = await Income.findOne({ _id: req.params.id, tenantId: req.user.tenantId, isDeleted: false })
      .populate('category', 'name color icon')
      .populate('addedBy', 'name email');

    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found', requestId: req.requestId });
    }

    res.json({ success: true, data: income, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/income ─────────────────────────────────────────────────────────
router.post('/', [
  body('category').isMongoId().withMessage('Valid category is required'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('incomeDate').isISO8601().withMessage('Valid date is required'),
  body('paymentMethod').isIn(['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card']).withMessage('Valid payment method is required'),
  body('paymentReference').optional().trim(),
  body('receivedBy').optional().trim(),
  body('description').optional().trim(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const { category, title, amount, incomeDate, paymentMethod, paymentReference, receivedBy, description, receiptUrl, academicYear, academicSessionId } = req.body;

    const income = await Income.create({
      tenantId: req.user.tenantId,
      category,
      title,
      amount,
      incomeDate,
      paymentMethod,
      paymentReference,
      receivedBy,
      description,
      receiptUrl,
      academicYear,
      academicSessionId: academicSessionId || undefined,
      addedBy: req.user._id
    });

    const populated = await Income.findById(income._id)
      .populate('category', 'name color icon')
      .populate('addedBy', 'name');

    res.status(201).json({ success: true, data: populated, message: 'Income added successfully', requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── PUT /api/income/:id ──────────────────────────────────────────────────────
router.put('/:id', [
  param('id').isMongoId(),
  body('category').optional().isMongoId(),
  body('title').optional().trim().notEmpty(),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('incomeDate').optional().isISO8601(),
  body('paymentMethod').optional().isIn(['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card']),
  handleValidationErrors
], async(req, res, next) => {
  try {
    const income = await Income.findOne({ _id: req.params.id, tenantId: req.user.tenantId, isDeleted: false });
    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found', requestId: req.requestId });
    }

    // Prevent editing system-generated records (auto-synced from fee payments)
    if (income.isSystemGenerated) {
      return res.status(403).json({ success: false, message: 'System-generated income records cannot be edited. This record was auto-created from a fee payment.', requestId: req.requestId });
    }

    const { category, title, amount, incomeDate, paymentMethod, paymentReference, receivedBy, description, receiptUrl, academicYear, academicSessionId } = req.body;
    if (category !== undefined) income.category = category;
    if (title !== undefined) income.title = title;
    if (amount !== undefined) income.amount = amount;
    if (incomeDate !== undefined) income.incomeDate = incomeDate;
    if (paymentMethod !== undefined) income.paymentMethod = paymentMethod;
    if (paymentReference !== undefined) income.paymentReference = paymentReference;
    if (receivedBy !== undefined) income.receivedBy = receivedBy;
    if (description !== undefined) income.description = description;
    if (receiptUrl !== undefined) income.receiptUrl = receiptUrl;
    if (academicYear !== undefined) income.academicYear = academicYear;
    if (academicSessionId !== undefined) income.academicSessionId = academicSessionId;

    await income.save();

    const populated = await Income.findById(income._id)
      .populate('category', 'name color icon')
      .populate('addedBy', 'name');

    res.json({ success: true, data: populated, message: 'Income updated successfully', requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /api/income/:id (soft delete) ─────────────────────────────────────
router.delete('/:id', [
  param('id').isMongoId(),
  handleValidationErrors
], async(req, res, next) => {
  try {
    // Check if system-generated before deleting
    const incomeCheck = await Income.findOne({ _id: req.params.id, tenantId: req.user.tenantId, isDeleted: false });
    if (incomeCheck && incomeCheck.isSystemGenerated) {
      return res.status(403).json({ success: false, message: 'System-generated income records cannot be deleted. This record was auto-created from a fee payment.', requestId: req.requestId });
    }

    const income = await Income.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!income) {
      return res.status(404).json({ success: false, message: 'Income record not found', requestId: req.requestId });
    }

    res.json({ success: true, message: 'Income deleted successfully', requestId: req.requestId });
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
    const result = await Income.updateMany(
      { _id: { $in: req.body.ids }, tenantId: req.user.tenantId, isDeleted: false, isSystemGenerated: { $ne: true } },
      { isDeleted: true }
    );

    res.json({ success: true, message: `${result.modifiedCount} income records deleted`, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

// ── Categories CRUD ──────────────────────────────────────────────────────────

router.get('/categories/list', async(req, res, next) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    if (req.query.activeOnly === 'true') filter.isActive = true;

    const categories = await IncomeCategory.find(filter).sort({ name: 1 }).lean();
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

    const existing = await IncomeCategory.findOne({ tenantId: req.user.tenantId, name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Category already exists', requestId: req.requestId });
    }

    const category = await IncomeCategory.create({ tenantId: req.user.tenantId, name, icon, color });
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
    const category = await IncomeCategory.findOneAndUpdate(
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
    const category = await IncomeCategory.findOneAndUpdate(
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

// ── Seed default categories ──────────────────────────────────────────────────
router.post('/categories/seed', async(req, res, next) => {
  try {
    const defaults = [
      { name: 'Fee Collection', icon: 'GraduationCap', color: '#3B82F6' },
      { name: 'Donations', icon: 'Heart', color: '#EC4899' },
      { name: 'Grants', icon: 'Award', color: '#8B5CF6' },
      { name: 'Rental Income', icon: 'Building2', color: '#F59E0B' },
      { name: 'Events', icon: 'Calendar', color: '#10B981' },
      { name: 'Interest', icon: 'TrendingUp', color: '#06B6D4' },
      { name: 'Miscellaneous', icon: 'MoreHorizontal', color: '#6B7280' }
    ];

    let created = 0;
    for (const cat of defaults) {
      const exists = await IncomeCategory.findOne({ tenantId: req.user.tenantId, name: cat.name });
      if (!exists) {
        await IncomeCategory.create({ tenantId: req.user.tenantId, ...cat });
        created++;
      }
    }

    res.json({ success: true, message: `${created} default income categories created`, requestId: req.requestId });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
