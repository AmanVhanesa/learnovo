const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const planGate = require('../middleware/planGate');
const { uploadSingleFile } = require('../middleware/fileUpload');
const FeeImportService = require('../services/feeImportService');
const { logger } = require('../middleware/errorHandler');

const router = express.Router();

// All fee import routes require auth + admin + active subscription + fees feature + CSV feature
router.use(protect);
router.use(authorize('admin'));
router.use(planGate.requireActiveSubscription);
router.use(planGate.checkFeesAndFinance);

/**
 * GET /api/fees/import/template
 * Download CSV template for fee record import
 */
router.get('/template', planGate.checkCsvImport, async(req, res, next) => {
  try {
    const buffer = await FeeImportService.generateTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=fee_import_template.csv');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/fees/import/preview
 * Upload CSV/Excel and validate without importing.
 * Returns summary + errors + first 10 valid rows.
 */
router.post('/preview', planGate.checkCsvImport, uploadSingleFile, async(req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload a CSV or Excel file.',
        requestId: req.requestId
      });
    }

    const tenantId = req.user.tenantId;
    const result = await FeeImportService.previewImport(req.file, tenantId);

    return res.status(200).json({
      success: true,
      message: result.summary.validRows > 0
        ? `${result.summary.validRows} of ${result.summary.totalRows} rows are valid`
        : 'No valid rows found. Check the errors below.',
      data: result,
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/fees/import/execute
 * Execute the import with previously validated data.
 * Body: { validData: [...] } — the validData array from preview response.
 */
router.post('/execute', planGate.checkCsvImport, async(req, res, next) => {
  try {
    const { validData } = req.body;

    if (!validData || !Array.isArray(validData) || validData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid data provided. Run preview first.',
        requestId: req.requestId
      });
    }

    const tenantId = req.user.tenantId;
    const userId = req.user._id;

    logger.info('Fee import started', {
      requestId: req.requestId,
      tenantId,
      userId,
      rowCount: validData.length
    });

    const result = await FeeImportService.executeImport(validData, tenantId, userId);

    logger.info('Fee import completed', {
      requestId: req.requestId,
      tenantId,
      ...result
    });

    return res.status(201).json({
      success: true,
      message: `Import complete: ${result.allocationsCreated} allocations, ${result.invoicesCreated} invoices, ${result.paymentsCreated} payments created.`,
      data: result,
      requestId: req.requestId
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
