const express = require('express');
const { body, query } = require('express-validator');
const Payroll = require('../models/Payroll');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const payrollService = require('../services/payrollService');
const payrollPdfService = require('../services/payrollPdfService');
const { syncPayrollToExpense, reversePayrollExpense } = require('../services/financeAutoSyncService');
const ImportExportService = require('../services/importExportService');

const router = express.Router();

// @desc    Export payroll records as CSV
// @route   GET /api/payroll/export
// @access  Private (Admin)
router.get('/export', protect, authorize('admin'), async(req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId, isDeleted: { $ne: true } };
    if (req.query.academicSessionId) filter.academicSessionId = req.query.academicSessionId;
    if (req.query.month) filter.month = parseInt(req.query.month);
    if (req.query.year) filter.year = parseInt(req.query.year);
    if (req.query.status) filter.paymentStatus = req.query.status;

    const records = await Payroll.find(filter)
      .populate('employeeId', 'name email phone department designation employeeId')
      .sort({ createdAt: -1 })
      .lean();

    const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const columns = [
      { key: 'employeeId', header: 'Employee ID', format: (val) => val?.employeeId || '' },
      { key: 'employeeId', header: 'Employee Name', format: (val) => val?.name || '' },
      { key: 'employeeId', header: 'Department', format: (val) => val?.department || '' },
      { key: 'employeeId', header: 'Designation', format: (val) => val?.designation || '' },
      { key: 'month', header: 'Month', format: (val) => MONTH_NAMES[val - 1] || val },
      { key: 'year', header: 'Year' },
      { key: 'baseSalary', header: 'Base Salary' },
      { key: 'bonuses', header: 'Bonuses' },
      { key: 'otherDeductions', header: 'Other Deductions' },
      { key: 'totalAdvanceDeduction', header: 'Advance Deduction' },
      { key: 'leaveDays', header: 'Leave Days' },
      { key: 'leaveDeduction', header: 'Leave Deduction' },
      { key: 'netSalary', header: 'Net Salary' },
      { key: 'paymentStatus', header: 'Payment Status' },
      { key: 'paymentDate', header: 'Payment Date', format: (val) => val ? new Date(val).toLocaleDateString() : '' },
      { key: 'paymentMethod', header: 'Payment Method' }
    ];

    const monthLabel = req.query.month ? MONTH_NAMES[parseInt(req.query.month) - 1] : 'all';
    const yearLabel = req.query.year || 'all';
    const headerInfo = await ImportExportService.getExportHeaderInfo(req.user.tenantId, `Payroll Report — ${monthLabel} ${yearLabel}`);
    const csvBuffer = await ImportExportService.exportToCSV(records, columns, headerInfo);
    const filename = `payroll_export_${monthLabel}_${yearLabel}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvBuffer);
  } catch (error) {
    console.error('Export payroll error:', error);
    res.status(500).json({ success: false, message: 'Server error while exporting payroll' });
  }
});

// @desc    Get all payroll records
// @route   GET /api/payroll
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('month').optional().isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year').optional().isInt({ min: 2000 }).withMessage('Invalid year'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { page, limit, month, year, employeeId, status, academicSessionId } = req.query;

    // Build filter (use $ne: true to include records where isDeleted doesn't exist or is false)
    const filter = { tenantId: req.user.tenantId, isDeleted: { $ne: true } };
    if (academicSessionId) filter.academicSessionId = academicSessionId;
    if (month) filter.month = parseInt(month);
    if (year) filter.year = parseInt(year);
    if (employeeId) filter.employeeId = employeeId;
    if (status) filter.paymentStatus = status;

    const result = await payrollService.getPayrollRecords(filter, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });

    res.json(result);

  } catch (error) {
    console.error('Get payroll records error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching payroll records'
    });
  }
});

// @desc    Get single payroll record
// @route   GET /api/payroll/:id
// @access  Private (Admin)
router.get('/:id', protect, authorize('admin'), async(req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('employeeId', 'name employeeId email phone designation department')
      .populate('generatedBy', 'name email')
      .populate('advanceDeductions.advanceId', 'amount reason requestDate');

    if (!payroll || payroll.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    res.json({
      success: true,
      data: payroll
    });

  } catch (error) {
    console.error('Get payroll record error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching payroll record'
    });
  }
});

// @desc    Generate monthly payroll for all employees
// @route   POST /api/payroll/generate
// @access  Private (Admin)
router.post('/generate', protect, authorize('admin'), [
  body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  body('year').isInt({ min: 2000 }).withMessage('Invalid year'),
  body('overwrite').optional().isBoolean().withMessage('Overwrite must be boolean'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { month, year, overwrite, bonuses, deductions } = req.body;

    // Look up active academic session for this tenant
    const AcademicSession = require('../models/AcademicSession');
    const activeSession = await AcademicSession.findOne({ tenantId: req.user.tenantId, isActive: true }).select('_id').lean();

    const result = await payrollService.generateMonthlyPayroll(
      req.user.tenantId,
      month,
      year,
      req.user._id,
      { overwrite, bonuses, deductions, academicSessionId: activeSession?._id }
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json({
      success: true,
      message: `Payroll generated successfully. Created: ${result.created}, Skipped: ${result.skipped}`,
      data: result
    });

  } catch (error) {
    console.error('Generate payroll error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating payroll'
    });
  }
});

// @desc    Update payroll record
// @route   PUT /api/payroll/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), [
  body('baseSalary').optional().isFloat({ min: 0 }).withMessage('Base salary must be >= 0'),
  body('bonuses').optional().isFloat({ min: 0 }).withMessage('Bonuses must be >= 0'),
  body('otherDeductions').optional().isFloat({ min: 0 }).withMessage('Deductions must be >= 0'),
  body('paymentStatus').optional().isIn(['pending', 'paid', 'cancelled']).withMessage('Invalid payment status'),
  handleValidationErrors
], async(req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);

    if (!payroll || payroll.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    // Check if payroll is soft deleted
    if (payroll.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit deleted payroll record'
      });
    }

    const { baseSalary, bonuses, otherDeductions, paymentStatus, paymentDate, paymentMethod, paymentReference, notes } = req.body;

    // Track previous status for finance sync
    const previousStatus = payroll.paymentStatus;

    if (baseSalary !== undefined) payroll.baseSalary = baseSalary;
    if (bonuses !== undefined) payroll.bonuses = bonuses;
    if (otherDeductions !== undefined) payroll.otherDeductions = otherDeductions;
    if (paymentStatus !== undefined) payroll.paymentStatus = paymentStatus;
    if (paymentDate !== undefined) payroll.paymentDate = paymentDate;
    if (paymentMethod !== undefined) payroll.paymentMethod = paymentMethod;
    if (paymentReference !== undefined) payroll.paymentReference = paymentReference;
    if (notes !== undefined) payroll.notes = notes;

    payroll.updatedBy = req.user._id;
    await payroll.save(); // Pre-save hook will recalculate netSalary

    // Auto-sync to Finance module on status transitions (non-blocking)
    if (paymentStatus === 'paid' && previousStatus !== 'paid') {
      try {
        const employee = await User.findById(payroll.employeeId).select('name fullName').lean();
        const AcademicSession = require('../models/AcademicSession');
        const activeSession = await AcademicSession.findOne({ tenantId: payroll.tenantId, isActive: true }).select('_id').lean();
        await syncPayrollToExpense({
          tenantId: payroll.tenantId,
          payrollId: payroll._id,
          netSalary: payroll.netSalary,
          paymentDate: payroll.paymentDate || new Date(),
          paymentMethod: payroll.paymentMethod,
          month: payroll.month,
          year: payroll.year,
          employeeName: employee?.fullName || employee?.name || 'Employee',
          addedBy: req.user._id,
          paymentReference: payroll.paymentReference,
          academicSessionId: activeSession?._id
        });
      } catch (syncErr) {
        console.error('[Finance-AutoSync] payroll paid sync failed (non-fatal):', syncErr.message);
      }
    } else if (paymentStatus === 'cancelled' && previousStatus === 'paid') {
      // Reverse the expense if payroll was cancelled after being paid
      try {
        await reversePayrollExpense(payroll.tenantId, payroll._id);
      } catch (syncErr) {
        console.error('[Finance-AutoSync] payroll cancel reverse failed (non-fatal):', syncErr.message);
      }
    }

    res.json({
      success: true,
      message: 'Payroll record updated successfully',
      data: payroll
    });

  } catch (error) {
    console.error('Update payroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating payroll record'
    });
  }
});

// @desc    Delete payroll record
// @route   DELETE /api/payroll/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async(req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);

    if (!payroll || payroll.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    // Check if already deleted
    if (payroll.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Payroll record is already deleted'
      });
    }

    // Soft delete
    payroll.isDeleted = true;
    payroll.deletedAt = new Date();
    payroll.deletedBy = req.user._id;
    await payroll.save();

    res.json({
      success: true,
      message: 'Payroll record deleted successfully'
    });

  } catch (error) {
    console.error('Delete payroll error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting payroll record'
    });
  }
});

// @desc    Get employee payroll history
// @route   GET /api/payroll/employee/:employeeId
// @access  Private (Admin)
router.get('/employee/:employeeId', protect, authorize('admin'), [
  query('year').optional().isInt({ min: 2000 }).withMessage('Invalid year'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { year } = req.query;
    const records = await payrollService.getEmployeePayrollHistory(
      req.params.employeeId,
      req.user.tenantId,
      year ? parseInt(year) : null
    );

    res.json({
      success: true,
      data: records
    });

  } catch (error) {
    console.error('Get employee payroll history error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while fetching payroll history'
    });
  }
});

// @desc    Get salary summary for a period
// @route   GET /api/payroll/summary/:year/:month
// @access  Private (Admin)
router.get('/summary/:year/:month', protect, authorize('admin'), async(req, res) => {
  try {
    const { year, month } = req.params;
    const summary = await payrollService.getSalarySummary(
      req.user.tenantId,
      parseInt(month),
      parseInt(year)
    );

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Get salary summary error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while calculating summary'
    });
  }
});

// ============================================================================
// PDF GENERATION ROUTES
// ============================================================================

// @desc    Download individual salary slip PDF
// @route   GET /api/payroll/pdf/slip/:id
// @access  Private (Admin)
router.get('/pdf/slip/:id', protect, authorize('admin'), async(req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id);

    if (!payroll || payroll.tenantId.toString() !== req.user.tenantId.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Payroll record not found'
      });
    }

    const pdfBuffer = await payrollPdfService.generateSalarySlip(req.params.id);
    const filename = `salary_slip_${payroll.month}_${payroll.year}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Generate salary slip PDF error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating PDF'
    });
  }
});

// @desc    Download monthly all-employees salary report PDF
// @route   GET /api/payroll/pdf/monthly/:year/:month
// @access  Private (Admin)
router.get('/pdf/monthly/:year/:month', protect, authorize('admin'), async(req, res) => {
  try {
    const { year, month } = req.params;

    const pdfBuffer = await payrollPdfService.generateMonthlyReport(
      req.user.tenantId,
      parseInt(month),
      parseInt(year)
    );

    const filename = `monthly_salary_report_${month}_${year}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Generate monthly report PDF error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating PDF'
    });
  }
});

// @desc    Download yearly employee salary report PDF
// @route   GET /api/payroll/pdf/yearly/:employeeId/:year
// @access  Private (Admin)
router.get('/pdf/yearly/:employeeId/:year', protect, authorize('admin'), async(req, res) => {
  try {
    const { employeeId, year } = req.params;

    const pdfBuffer = await payrollPdfService.generateYearlyReport(
      employeeId,
      req.user.tenantId,
      parseInt(year)
    );

    const filename = `yearly_salary_report_${year}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

  } catch (error) {
    console.error('Generate yearly report PDF error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while generating PDF'
    });
  }
});

module.exports = router;
