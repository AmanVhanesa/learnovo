const express = require('express');
const { body, param, query } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const planGate = require('../middleware/planGate');
const { uploadSingleFile } = require('../middleware/fileUpload');
const { handleValidationErrors } = require('../middleware/validation');
const BankReconciliationBatch = require('../models/BankReconciliationBatch');
const bankReconciliationService = require('../services/bankReconciliationService');
const { logger } = require('../middleware/errorHandler');

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'accountant'));
router.use(planGate.requireActiveSubscription);
router.use(planGate.checkFeesAndFinance);

router.post(
  '/upload',
  (req, res, next) => uploadSingleFile(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message, requestId: req.requestId });
    next();
  }),
  [
    body('source').optional().isIn(['RAZORPAY', 'ICICI', 'GENERIC']),
    handleValidationErrors
  ],
  async(req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'File is required (field: file)' });
      }

      const batch = await bankReconciliationService.processUploadedFile({
        tenantId: req.user.tenantId,
        userId: req.user._id,
        fileBuffer: req.file.buffer,
        filename: req.file.originalname,
        source: req.body.source || 'GENERIC'
      });

      res.status(201).json({
        success: true,
        message: 'Reconciliation batch processed',
        data: {
          batchId: batch._id,
          summary: batch.summary,
          status: batch.status
        },
        requestId: req.requestId
      });
    } catch (error) {
      logger.error('Bank reconciliation upload failed', error, { userId: req.user?._id });
      if (error.message && /rows|file/i.test(error.message)) {
        return res.status(400).json({ success: false, message: error.message, requestId: req.requestId });
      }
      next(error);
    }
  }
);

router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    handleValidationErrors
  ],
  async(req, res, next) => {
    try {
      const page = req.query.page || 1;
      const limit = req.query.limit || 20;

      const [items, total] = await Promise.all([
        BankReconciliationBatch.find({ tenantId: req.user.tenantId })
          .select('source originalFilename summary status periodStart periodEnd createdAt uploadedBy')
          .populate('uploadedBy', 'name email')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        BankReconciliationBatch.countDocuments({ tenantId: req.user.tenantId })
      ]);

      res.json({
        success: true,
        data: items,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:batchId',
  [param('batchId').isMongoId(), handleValidationErrors],
  async(req, res, next) => {
    try {
      const batch = await BankReconciliationBatch.findOne({
        _id: req.params.batchId,
        tenantId: req.user.tenantId
      })
        .populate('uploadedBy', 'name email')
        .populate('rows.matchedStudentId', 'name fullName admissionNumber')
        .populate('rows.candidateInvoiceIds', 'invoiceNumber totalAmount balanceAmount studentId periodLabel status')
        .lean();

      if (!batch) {
        return res.status(404).json({ success: false, message: 'Batch not found', requestId: req.requestId });
      }

      res.json({ success: true, data: batch, requestId: req.requestId });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:batchId/rows/:rowId/confirm',
  [
    param('batchId').isMongoId(),
    param('rowId').isMongoId(),
    body('invoiceId').optional().isMongoId(),
    body('note').optional().isString().isLength({ max: 500 }),
    handleValidationErrors
  ],
  async(req, res, next) => {
    try {
      const { batch, result } = await bankReconciliationService.confirmRow({
        tenantId: req.user.tenantId,
        batchId: req.params.batchId,
        rowId: req.params.rowId,
        invoiceId: req.body.invoiceId,
        userId: req.user._id,
        note: req.body.note
      });

      res.json({
        success: true,
        message: result.alreadyConfirmed ? 'Payment was already confirmed' : 'Payment confirmed',
        data: {
          summary: batch.summary,
          paymentId: result.paymentId,
          receiptNumber: result.receiptNumber,
          invoiceId: result.invoiceId
        },
        requestId: req.requestId
      });
    } catch (error) {
      logger.error('Bank reconciliation confirm row failed', error, {
        userId: req.user?._id,
        batchId: req.params.batchId,
        rowId: req.params.rowId
      });
      if (error.message && /not found|required|already/i.test(error.message)) {
        return res.status(400).json({ success: false, message: error.message, requestId: req.requestId });
      }
      next(error);
    }
  }
);

router.post(
  '/:batchId/rows/:rowId/ignore',
  [
    param('batchId').isMongoId(),
    param('rowId').isMongoId(),
    body('note').optional().isString().isLength({ max: 500 }),
    handleValidationErrors
  ],
  async(req, res, next) => {
    try {
      const batch = await bankReconciliationService.ignoreRow({
        tenantId: req.user.tenantId,
        batchId: req.params.batchId,
        rowId: req.params.rowId,
        userId: req.user._id,
        note: req.body.note
      });
      res.json({
        success: true,
        message: 'Row ignored',
        data: { summary: batch.summary },
        requestId: req.requestId
      });
    } catch (error) {
      if (error.message && /not found/i.test(error.message)) {
        return res.status(404).json({ success: false, message: error.message, requestId: req.requestId });
      }
      next(error);
    }
  }
);

router.post(
  '/:batchId/close',
  [param('batchId').isMongoId(), handleValidationErrors],
  async(req, res, next) => {
    try {
      const batch = await BankReconciliationBatch.findOneAndUpdate(
        { _id: req.params.batchId, tenantId: req.user.tenantId },
        { $set: { status: 'CLOSED', closedAt: new Date(), closedBy: req.user._id } },
        { new: true }
      ).select('status closedAt summary');

      if (!batch) {
        return res.status(404).json({ success: false, message: 'Batch not found', requestId: req.requestId });
      }
      res.json({ success: true, message: 'Batch closed', data: batch, requestId: req.requestId });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
