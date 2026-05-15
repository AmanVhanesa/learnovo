const express = require('express');
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const planGate = require('../middleware/planGate');
const { handleValidationErrors } = require('../middleware/validation');
const activityInvoiceService = require('../services/activityInvoiceService');

const router = express.Router();

const writeGates = [
  protect,
  planGate.requireActiveSubscription,
  planGate.checkFeesAndFinance,
  authorize('admin', 'accountant')
];

const monthYearRules = [
  body('month').isInt({ min: 1, max: 12 }).withMessage('month must be 1-12'),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('year is required'),
  body('academicSessionId').optional().isMongoId(),
  body('activityProgramId').optional().isMongoId(),
  body('enrollmentIds').optional().isArray(),
  body('enrollmentIds.*').optional().isMongoId(),
  body('dueDay').optional().isInt({ min: 1, max: 28 }),
  handleValidationErrors
];

// ─── POST /api/activity-invoices/preview ───────────────────────────────
router.post('/preview', writeGates, monthYearRules, async(req, res, next) => {
  try {
    const preview = await activityInvoiceService.previewMonthlyActivityInvoices({
      tenantId: req.user.tenantId,
      month: parseInt(req.body.month, 10),
      year: parseInt(req.body.year, 10),
      academicSessionId: req.body.academicSessionId,
      activityProgramId: req.body.activityProgramId,
      enrollmentIds: req.body.enrollmentIds
    });
    res.json({ success: true, data: preview, requestId: req.requestId });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/activity-invoices/generate ──────────────────────────────
router.post('/generate', writeGates, monthYearRules, async(req, res, next) => {
  try {
    const result = await activityInvoiceService.generateMonthlyActivityInvoices({
      tenantId: req.user.tenantId,
      month: parseInt(req.body.month, 10),
      year: parseInt(req.body.year, 10),
      academicSessionId: req.body.academicSessionId,
      activityProgramId: req.body.activityProgramId,
      enrollmentIds: req.body.enrollmentIds,
      dueDay: req.body.dueDay,
      generatedBy: req.user._id
    });
    res.status(201).json({
      success: true,
      message: `Generated ${result.createdCount} activity invoice(s)`,
      data: result,
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
