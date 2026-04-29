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
const XLSX = require('xlsx');

const router = express.Router();

// ICICI NPAB (Net Payment Advice Batch) column order — must match NPAB_FMT.xls exactly
const NPAB_HEADERS = [
  'PYMT_PROD_TYPE_CODE', 'PYMT_MODE', 'DEBIT_ACC_NO', 'BNF_NAME', 'BENE_ACC_NO',
  'BENE_IFSC', 'AMOUNT', 'DEBIT_NARR', 'CREDIT_NARR', 'MOBILE_NUM',
  'EMAIL_ID', 'REMARK', 'PYMT_DATE', 'REF_NO', 'ADDL_INFO1',
  'ADDL_INFO2', 'ADDL_INFO3', 'ADDL_INFO4', 'ADDL_INFO5'
];
const NPAB_VALID_MODES = ['FT', 'NEFT', 'RTGS', 'IMPS'];
const NPAB_MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const npabSanitizeAlpha = (str, max) => (str || '').toString().replace(/[^A-Za-z ]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const npabSanitizeAlnum = (str, max) => (str || '').toString().replace(/[^A-Za-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const npabMobile10 = (str) => {
  const digits = (str || '').toString().replace(/\D/g, '');
  return digits.length >= 10 ? Number(digits.slice(-10)) : '';
};

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

// @desc    Download ICICI NPAB bank upload sheet for a month's payroll
// @route   GET /api/payroll/bank-sheet/icici/:year/:month
// @access  Private (Admin)
router.get('/bank-sheet/icici/:year/:month', protect, authorize('admin'), async(req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: 'Invalid year or month' });
    }

    const {
      debitAccountNo,
      paymentMode = 'NEFT',
      paymentDate,
      status
    } = req.query;

    if (!debitAccountNo || !/^\d{8,20}$/.test(debitAccountNo.toString().trim())) {
      return res.status(400).json({ success: false, message: 'Valid ICICI debit account number required (digits only)' });
    }
    if (!NPAB_VALID_MODES.includes(paymentMode)) {
      return res.status(400).json({ success: false, message: `Payment mode must be one of: ${NPAB_VALID_MODES.join(', ')}` });
    }

    const pad2 = (n) => String(n).padStart(2, '0');
    let pymtDate;
    if (paymentDate && /^\d{2}-\d{2}-\d{4}$/.test(paymentDate)) {
      pymtDate = paymentDate;
    } else {
      const d = new Date();
      pymtDate = `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
    }

    const filter = {
      tenantId: req.user.tenantId,
      month,
      year,
      isDeleted: { $ne: true }
    };
    if (status && ['pending', 'paid', 'cancelled'].includes(status)) {
      filter.paymentStatus = status;
    }

    const records = await Payroll.find(filter)
      .populate('employeeId', 'name fullName firstName lastName email phone accountNumber ifscCode bankName employeeId')
      .lean();

    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'No payroll records found for the selected period' });
    }

    const periodLabel = `SALARY ${NPAB_MONTH_ABBR[month - 1]}${year}`;
    const debitNarr = npabSanitizeAlnum(periodLabel, 30);
    const creditNarr = npabSanitizeAlnum(periodLabel, 30);

    const rows = [NPAB_HEADERS];
    const skipped = [];
    let included = 0;

    for (const rec of records) {
      const emp = rec.employeeId;
      if (!emp) {
        skipped.push({ employee: 'Unknown', reason: 'Employee record missing' });
        continue;
      }

      const empName = (emp.fullName || emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || '').trim();
      const acctNo = (emp.accountNumber || '').toString().trim();
      const ifsc = (emp.ifscCode || '').toString().trim().toUpperCase();
      const netSalary = Number(rec.netSalary || 0);

      if (!empName) {
        skipped.push({ employee: emp.employeeId || String(emp._id), reason: 'Missing employee name' });
        continue;
      }
      if (!acctNo) {
        skipped.push({ employee: empName, reason: 'Missing bank account number' });
        continue;
      }
      // ICICI accounts (IFSC starts with ICIC) → FT; everyone else uses the selected mode
      const isIciciAccount = ifsc.startsWith('ICIC');
      const rowMode = isIciciAccount ? 'FT' : paymentMode;
      if (rowMode !== 'FT' && !ifsc) {
        skipped.push({ employee: empName, reason: 'Missing IFSC code' });
        continue;
      }
      if (netSalary <= 0) {
        skipped.push({ employee: empName, reason: 'Net salary is zero or negative' });
        continue;
      }

      rows.push([
        'PAB_VENDOR',
        rowMode,
        debitAccountNo.toString().trim(),
        npabSanitizeAlpha(empName, 100),
        acctNo,
        rowMode === 'FT' ? '' : ifsc,
        Number(netSalary.toFixed(2)),
        debitNarr,
        creditNarr,
        npabMobile10(emp.phone),
        (emp.email || '').toString().trim().slice(0, 100),
        '',
        pymtDate,
        '',
        '',
        '',
        '',
        '',
        ''
      ]);
      included++;
    }

    if (included === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible payroll records — all rows missing required bank details',
        skipped
      });
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = NPAB_HEADERS.map(() => ({ wch: 20 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'biff8' });

    const filename = `ICICINPAB${NPAB_MONTH_ABBR[month - 1]}.xls`;
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('X-NPAB-Included', String(included));
    res.setHeader('X-NPAB-Skipped', String(skipped.length));
    if (skipped.length) {
      res.setHeader('X-NPAB-Skipped-Reasons', encodeURIComponent(JSON.stringify(skipped).slice(0, 2000)));
    }
    res.send(buffer);
  } catch (error) {
    console.error('ICICI NPAB bank sheet export error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error while generating bank sheet' });
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
