const Joi = require('joi');
const ImportExportService = require('./importExportService');
const User = require('../models/User');
const AcademicSession = require('../models/AcademicSession');
const FeeStructure = require('../models/FeeStructure');
const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const { roundToRupee, toNumber, sumMoney } = require('../utils/money');

/**
 * Fee Import Service
 * Handles importing student fee records (allocations + invoices + payments) from CSV/Excel.
 * Used when schools migrate to Learnovo and need historical fee data preserved.
 */
class FeeImportService {

  /**
   * Joi schema for fee record import rows
   */
  static getValidationSchema() {
    return Joi.object({
      admissionNumber: Joi.string()
        .required()
        .trim()
        .messages({ 'string.empty': 'Admission number is required' }),

      feeHead: Joi.string()
        .required()
        .trim()
        .messages({ 'string.empty': 'Fee head name is required' }),

      feeType: Joi.string()
        .valid('recurring', 'one_time')
        .default('recurring')
        .messages({ 'any.only': 'Fee type must be recurring or one_time' }),

      annualAmount: Joi.number()
        .required()
        .min(0)
        .messages({
          'number.base': 'Annual amount must be a number',
          'number.min': 'Annual amount cannot be negative',
          'any.required': 'Annual amount is required'
        }),

      paidAmount: Joi.number()
        .min(0)
        .default(0)
        .messages({
          'number.base': 'Paid amount must be a number',
          'number.min': 'Paid amount cannot be negative'
        }),

      paymentDate: Joi.date()
        .allow('', null)
        .messages({ 'date.base': 'Invalid payment date' }),

      paymentMethod: Joi.string()
        .valid('Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Online')
        .allow('', null)
        .messages({ 'any.only': 'Payment method must be Cash, Bank Transfer, UPI, Cheque, Card, or Online' }),

      receiptNumber: Joi.string()
        .allow('', null)
        .trim(),

      dueDate: Joi.date()
        .allow('', null)
        .messages({ 'date.base': 'Invalid due date' }),

      discountAmount: Joi.number()
        .min(0)
        .default(0)
        .messages({ 'number.base': 'Discount must be a number' }),

      discountReason: Joi.string()
        .allow('', null)
        .trim(),

      concessionAmount: Joi.number()
        .min(0)
        .default(0)
        .messages({ 'number.base': 'Concession must be a number' }),

      lateFeeAmount: Joi.number()
        .min(0)
        .default(0)
        .messages({ 'number.base': 'Late fee must be a number' }),

      transactionReference: Joi.string()
        .allow('', null)
        .trim()
        .max(100),

      chequeDate: Joi.date()
        .allow('', null)
        .messages({ 'date.base': 'Invalid cheque date' }),

      bankName: Joi.string()
        .allow('', null)
        .trim()
        .max(100),

      collectedBy: Joi.string()
        .allow('', null)
        .trim()
        .max(100),

      remarks: Joi.string()
        .allow('', null)
        .trim()
        .max(500),

      academicSession: Joi.string()
        .allow('', null)
        .trim(),

      // Ignore row number field
      _rowNumber: Joi.any()
    }).unknown(false);
  }

  /**
   * Parse file (CSV or Excel) from multer buffer or file path
   */
  static async parseFile(fileOrPath) {
    let rows;
    if (typeof fileOrPath === 'string') {
      const ext = fileOrPath.toLowerCase();
      if (ext.endsWith('.csv')) {
        rows = await ImportExportService.parseCSV(fileOrPath);
      } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        rows = await ImportExportService.parseExcel(fileOrPath);
      } else {
        throw new Error('Unsupported file format. Use CSV or Excel (.xlsx/.xls)');
      }
    } else {
      const ext = (fileOrPath.originalname || '').toLowerCase();
      if (ext.endsWith('.csv')) {
        rows = await ImportExportService.parseCSVBuffer(fileOrPath.buffer);
      } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
        rows = await ImportExportService.parseExcelBuffer(fileOrPath.buffer);
      } else {
        throw new Error('Unsupported file format. Use CSV or Excel (.xlsx/.xls)');
      }
    }
    return rows;
  }

  /**
   * Preview import — validate without writing to DB
   */
  static async previewImport(fileOrPath, tenantId) {
    const rows = await this.parseFile(fileOrPath);

    if (rows.length === 0) {
      return {
        success: false,
        message: 'File is empty',
        summary: { totalRows: 0, validRows: 0, invalidRows: 0 },
        errors: [],
        preview: []
      };
    }

    // Normalise column names (handle different CSV conventions)
    const normalised = rows.map(row => this.normaliseRow(row));

    // Joi validation
    const schema = this.getValidationSchema();
    const { validRows, errors } = ImportExportService.validateRows(normalised, schema);

    // Business-rule validation
    const businessValidation = await this.validateBusinessRules(validRows, tenantId);
    const finalValidRows = validRows.filter((_row, index) =>
      !businessValidation.errors.some(err => err.rowIndex === index)
    );
    const allErrors = [...errors, ...businessValidation.errors];

    return {
      success: true,
      summary: {
        totalRows: rows.length,
        validRows: finalValidRows.length,
        invalidRows: rows.length - finalValidRows.length
      },
      errors: allErrors,
      preview: finalValidRows.slice(0, 10),
      validData: finalValidRows
    };
  }

  /**
   * Normalise a raw CSV row to match our Joi schema keys.
   * Handles common column-name variations.
   */
  static normaliseRow(row) {
    const norm = {};
    const map = {
      admissionnumber: 'admissionNumber',
      admission_number: 'admissionNumber',
      'admission number': 'admissionNumber',
      'admission no': 'admissionNumber',
      feehead: 'feeHead',
      fee_head: 'feeHead',
      'fee head': 'feeHead',
      'fee head name': 'feeHead',
      feetype: 'feeType',
      fee_type: 'feeType',
      'fee type': 'feeType',
      annualamount: 'annualAmount',
      annual_amount: 'annualAmount',
      'annual amount': 'annualAmount',
      amount: 'annualAmount',
      paidamount: 'paidAmount',
      paid_amount: 'paidAmount',
      'paid amount': 'paidAmount',
      paid: 'paidAmount',
      paymentdate: 'paymentDate',
      payment_date: 'paymentDate',
      'payment date': 'paymentDate',
      paymentmethod: 'paymentMethod',
      payment_method: 'paymentMethod',
      'payment method': 'paymentMethod',
      receiptnumber: 'receiptNumber',
      receipt_number: 'receiptNumber',
      'receipt number': 'receiptNumber',
      'receipt no': 'receiptNumber',
      duedate: 'dueDate',
      due_date: 'dueDate',
      'due date': 'dueDate',
      discountamount: 'discountAmount',
      discount_amount: 'discountAmount',
      'discount amount': 'discountAmount',
      discount: 'discountAmount',
      discountreason: 'discountReason',
      discount_reason: 'discountReason',
      'discount reason': 'discountReason',
      concessionamount: 'concessionAmount',
      concession_amount: 'concessionAmount',
      'concession amount': 'concessionAmount',
      concession: 'concessionAmount',
      latefeeamount: 'lateFeeAmount',
      late_fee_amount: 'lateFeeAmount',
      'late fee amount': 'lateFeeAmount',
      'late fee': 'lateFeeAmount',
      'late/extra fees': 'lateFeeAmount',
      latefee: 'lateFeeAmount',
      transactionreference: 'transactionReference',
      transaction_reference: 'transactionReference',
      'transaction reference': 'transactionReference',
      'transaction id': 'transactionReference',
      transactionid: 'transactionReference',
      'reference number': 'transactionReference',
      'utr': 'transactionReference',
      chequedate: 'chequeDate',
      cheque_date: 'chequeDate',
      'cheque date': 'chequeDate',
      bankname: 'bankName',
      bank_name: 'bankName',
      'bank name': 'bankName',
      bank: 'bankName',
      collectedby: 'collectedBy',
      collected_by: 'collectedBy',
      'collected by': 'collectedBy',
      'user name': 'collectedBy',
      username: 'collectedBy',
      academicsession: 'academicSession',
      academic_session: 'academicSession',
      'academic session': 'academicSession',
      'academic year': 'academicSession',
      remarks: 'remarks',
      _rownumber: '_rowNumber'
    };

    for (const [rawKey, value] of Object.entries(row)) {
      const lk = rawKey.toLowerCase().trim();
      const mappedKey = map[lk] || rawKey;
      norm[mappedKey] = value;
    }

    // Coerce numeric strings
    if (norm.annualAmount !== undefined) norm.annualAmount = parseFloat(norm.annualAmount) || 0;
    if (norm.paidAmount !== undefined) norm.paidAmount = parseFloat(norm.paidAmount) || 0;
    if (norm.discountAmount !== undefined) norm.discountAmount = parseFloat(norm.discountAmount) || 0;
    if (norm.concessionAmount !== undefined) norm.concessionAmount = parseFloat(norm.concessionAmount) || 0;
    if (norm.lateFeeAmount !== undefined) norm.lateFeeAmount = parseFloat(norm.lateFeeAmount) || 0;

    return norm;
  }

  /**
   * Validate business rules (student exists, session exists, etc.)
   */
  static async validateBusinessRules(rows, tenantId) {
    const errors = [];

    // Fetch all students for this tenant
    const admissionNumbers = [...new Set(rows.map(r => r.admissionNumber).filter(Boolean))];
    const students = await User.find({
      tenantId,
      role: 'student',
      admissionNumber: { $in: admissionNumbers }
    }).select('admissionNumber _id classId sectionId').lean();

    const studentMap = new Map();
    students.forEach(s => studentMap.set(s.admissionNumber, s));

    // Fetch academic sessions
    const sessionNames = [...new Set(rows.map(r => r.academicSession).filter(Boolean))];
    const sessions = await AcademicSession.find({
      tenantId,
      ...(sessionNames.length > 0 ? { name: { $in: sessionNames } } : {})
    }).lean();

    const sessionMap = new Map();
    sessions.forEach(s => sessionMap.set(s.name, s));

    // If no session name specified in rows, try to use active session
    const activeSession = sessions.find(s => s.isActive);

    rows.forEach((row, index) => {
      const rowNumber = row._rowNumber || index + 1;

      // Student must exist
      if (!studentMap.has(row.admissionNumber)) {
        errors.push({
          row: rowNumber,
          rowIndex: index,
          field: 'admissionNumber',
          message: `Student not found: ${row.admissionNumber}`,
          value: row.admissionNumber
        });
      }

      // Academic session must exist (or active session is used)
      if (row.academicSession && !sessionMap.has(row.academicSession)) {
        errors.push({
          row: rowNumber,
          rowIndex: index,
          field: 'academicSession',
          message: `Academic session not found: ${row.academicSession}`,
          value: row.academicSession
        });
      } else if (!row.academicSession && !activeSession) {
        errors.push({
          row: rowNumber,
          rowIndex: index,
          field: 'academicSession',
          message: 'No academic session specified and no active session found',
          value: ''
        });
      }

      // If paid, payment method is required
      if (toNumber(row.paidAmount) > 0 && !row.paymentMethod) {
        errors.push({
          row: rowNumber,
          rowIndex: index,
          field: 'paymentMethod',
          message: 'Payment method is required when paid amount > 0',
          value: ''
        });
      }

      // Paid amount cannot exceed annual amount + late fee
      const payable = toNumber(row.annualAmount) + toNumber(row.lateFeeAmount);
      if (toNumber(row.paidAmount) > payable) {
        errors.push({
          row: rowNumber,
          rowIndex: index,
          field: 'paidAmount',
          message: `Paid amount (${row.paidAmount}) exceeds payable amount (${payable})`,
          value: row.paidAmount
        });
      }

      // Discount + concession cannot exceed annual amount
      const totalDeduction = toNumber(row.discountAmount) + toNumber(row.concessionAmount);
      if (totalDeduction > toNumber(row.annualAmount)) {
        errors.push({
          row: rowNumber,
          rowIndex: index,
          field: 'discountAmount',
          message: `Discount + concession (${totalDeduction}) exceeds annual amount (${row.annualAmount})`,
          value: totalDeduction
        });
      }

      // Cheque payments require cheque date and bank name
      if (row.paymentMethod === 'Cheque' && toNumber(row.paidAmount) > 0) {
        if (!row.chequeDate) {
          errors.push({
            row: rowNumber,
            rowIndex: index,
            field: 'chequeDate',
            message: 'Cheque date is required for cheque payments',
            value: ''
          });
        }
        if (!row.transactionReference) {
          errors.push({
            row: rowNumber,
            rowIndex: index,
            field: 'transactionReference',
            message: 'Cheque number (transactionReference) is required for cheque payments',
            value: ''
          });
        }
      }
    });

    return { errors };
  }

  /**
   * Execute import — creates AnnualFeeAllocation + FeeInvoice + Payment records
   *
   * Groups rows by student+session, creates one allocation per group with
   * all fee heads, one consolidated invoice, and one payment (if paid).
   */
  static async executeImport(validData, tenantId, userId) {
    const results = {
      allocationsCreated: 0,
      invoicesCreated: 0,
      paymentsCreated: 0,
      failed: 0,
      errors: []
    };

    // Pre-fetch lookup data
    const admissionNumbers = [...new Set(validData.map(r => r.admissionNumber))];
    const [students, sessions, feeStructures] = await Promise.all([
      User.find({ tenantId, role: 'student', admissionNumber: { $in: admissionNumbers } })
        .select('admissionNumber _id classId sectionId').lean(),
      AcademicSession.find({ tenantId }).lean(),
      FeeStructure.find({ tenantId, isActive: true }).lean()
    ]);

    const studentMap = new Map();
    students.forEach(s => studentMap.set(s.admissionNumber, s));

    const sessionMap = new Map();
    sessions.forEach(s => sessionMap.set(s.name, s));
    const activeSession = sessions.find(s => s.isActive);

    // Build a map: classId -> feeStructure (for linking allocations)
    const feeStructureByClass = new Map();
    feeStructures.forEach(fs => {
      const key = `${fs.classId}_${fs.academicSessionId}`;
      feeStructureByClass.set(key, fs);
    });

    // Group rows by student + session
    const grouped = new Map();
    for (const row of validData) {
      const student = studentMap.get(row.admissionNumber);
      if (!student) {
        results.failed++;
        results.errors.push({ admissionNumber: row.admissionNumber, error: 'Student not found' });
        continue;
      }

      const session = row.academicSession
        ? sessionMap.get(row.academicSession)
        : activeSession;
      if (!session) {
        results.failed++;
        results.errors.push({ admissionNumber: row.admissionNumber, error: 'Academic session not found' });
        continue;
      }

      const groupKey = `${student._id}_${session._id}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, { student, session, rows: [] });
      }
      grouped.get(groupKey).rows.push(row);
    }

    // Process each student-session group
    for (const [, group] of grouped) {
      try {
        await this.processStudentGroup(group, tenantId, userId, feeStructureByClass, results);
      } catch (err) {
        results.failed++;
        results.errors.push({
          admissionNumber: group.rows[0]?.admissionNumber || 'unknown',
          error: err.message
        });
      }
    }

    return results;
  }

  /**
   * Process a single student-session group:
   * 1. Create/update AnnualFeeAllocation
   * 2. Create a FeeInvoice
   * 3. Create Payment records (if any paid amounts)
   */
  static async processStudentGroup(group, tenantId, userId, feeStructureByClass, results) {
    const { student, session, rows } = group;

    // Build fee heads from the CSV rows
    const allocatedFeeHeads = rows.map(row => ({
      feeHeadName: row.feeHead,
      annualAmount: roundToRupee(row.annualAmount),
      type: row.feeType || 'recurring',
      isCompulsory: true,
      isIncluded: true
    }));

    const totalAnnualAmount = roundToRupee(sumMoney(allocatedFeeHeads.map(h => h.annualAmount)));
    const totalDiscount = roundToRupee(sumMoney(rows.map(r => toNumber(r.discountAmount))));
    const totalConcession = roundToRupee(sumMoney(rows.map(r => toNumber(r.concessionAmount))));
    const totalLateFee = roundToRupee(sumMoney(rows.map(r => toNumber(r.lateFeeAmount))));
    const totalPaid = roundToRupee(sumMoney(rows.map(r => toNumber(r.paidAmount))));
    // Concession reduces the payable amount alongside discount; late fee adds to it.
    const balance = roundToRupee(totalAnnualAmount + totalLateFee - totalPaid - totalDiscount - totalConcession);

    // Try to find matching fee structure
    const fsKey = `${student.classId}_${session._id}`;
    const feeStructure = feeStructureByClass.get(fsKey);

    // Check if allocation already exists
    const existingAllocation = await AnnualFeeAllocation.findOne({
      tenantId,
      studentId: student._id,
      academicSessionId: session._id
    });

    if (existingAllocation) {
      results.failed += rows.length;
      results.errors.push({
        admissionNumber: rows[0].admissionNumber,
        error: `Fee allocation already exists for session ${session.name}. Delete existing allocation first.`
      });
      return;
    }

    // 1. Create AnnualFeeAllocation
    const allocation = new AnnualFeeAllocation({
      tenantId,
      studentId: student._id,
      feeStructureId: feeStructure?._id || session._id, // fallback if no structure
      classId: student.classId,
      sectionId: student.sectionId,
      academicSessionId: session._id,
      allocatedFeeHeads,
      totalAnnualAmount,
      totalPaid,
      totalDiscount,
      balance: Math.max(0, balance),
      paymentPlan: 'annual',
      status: balance <= 0 ? 'completed' : 'active',
      discountFixed: totalDiscount,
      discountReason: rows.find(r => r.discountReason)?.discountReason || '',
      concessionReason: totalConcession > 0
        ? (rows.find(r => r.concessionAmount > 0 && r.discountReason)?.discountReason || 'Imported concession')
        : '',
      generatedBy: userId
    });

    await allocation.save();
    results.allocationsCreated++;

    // 2. Create FeeInvoice
    const invoiceNumber = await FeeInvoice.generateInvoiceNumber(tenantId);
    const dueDate = rows.find(r => r.dueDate)?.dueDate || session.endDate || new Date();

    const invoiceItems = rows.map(row => ({
      feeHeadName: row.feeHead,
      fullAnnualAmount: roundToRupee(row.annualAmount),
      periodAmount: roundToRupee(row.annualAmount),
      discount: roundToRupee(toNumber(row.discountAmount) + toNumber(row.concessionAmount)),
      netAmount: roundToRupee(
        toNumber(row.annualAmount) - toNumber(row.discountAmount) - toNumber(row.concessionAmount)
      ),
      type: row.feeType || 'recurring'
    }));

    const invoiceTotalAmount = roundToRupee(sumMoney(invoiceItems.map(i => i.netAmount)));

    const invoice = new FeeInvoice({
      tenantId,
      invoiceNumber,
      studentId: student._id,
      classId: student.classId,
      sectionId: student.sectionId,
      academicSessionId: session._id,
      feeStructureId: feeStructure?._id,
      annualAllocationId: allocation._id,
      items: invoiceItems,
      periodLabel: `Imported — ${session.name}`,
      periodStart: session.startDate,
      periodEnd: session.endDate,
      totalAmount: invoiceTotalAmount,
      paidAmount: totalPaid,
      lateFeeApplied: totalLateFee,
      lateFeeAppliedDate: totalLateFee > 0 ? new Date() : undefined,
      balanceAmount: Math.max(0, roundToRupee(invoiceTotalAmount + totalLateFee - totalPaid)),
      status: totalPaid >= (invoiceTotalAmount + totalLateFee) ? 'Paid' : totalPaid > 0 ? 'Partial' : 'Pending',
      dueDate: new Date(dueDate),
      issuedDate: new Date(),
      discountAmount: roundToRupee(totalDiscount + totalConcession),
      discountReason: rows.find(r => r.discountReason)?.discountReason || 'Imported discount',
      billingPeriod: {
        year: new Date(session.startDate).getFullYear(),
        displayText: `Academic Year ${session.name}`
      },
      remarks: 'Imported via fee import',
      generatedBy: userId
    });

    await invoice.save();
    results.invoicesCreated++;

    // 3. Create Payment records for rows with paid amounts
    const paidRows = rows.filter(r => toNumber(r.paidAmount) > 0);
    if (paidRows.length > 0) {
      // Create one consolidated payment per student-session
      const paymentAmount = roundToRupee(sumMoney(paidRows.map(r => toNumber(r.paidAmount))));
      const paymentMethod = paidRows[0].paymentMethod || 'Cash';
      const paymentDate = paidRows.find(r => r.paymentDate)?.paymentDate || new Date();

      // Use imported receipt number or generate one
      const receiptNumber = paidRows[0].receiptNumber || await Payment.generateReceiptNumber(tenantId);

      // Pull payment-detail fields from the first row that has them
      const refRow = paidRows.find(r => r.transactionReference || r.chequeDate || r.bankName) || paidRows[0];
      const transactionDetails = {};
      if (refRow.bankName) transactionDetails.bankName = refRow.bankName;
      if (refRow.chequeDate) transactionDetails.chequeDate = new Date(refRow.chequeDate);
      if (refRow.transactionReference) {
        if (paymentMethod === 'Cheque') {
          transactionDetails.chequeNumber = refRow.transactionReference;
        } else {
          transactionDetails.referenceNumber = refRow.transactionReference;
        }
      }

      const collectedByName = paidRows.find(r => r.collectedBy)?.collectedBy;
      const baseRemarks = paidRows[0].remarks || 'Imported payment record';
      const remarks = collectedByName ? `${baseRemarks} (Collected by: ${collectedByName})` : baseRemarks;

      const payment = new Payment({
        tenantId,
        receiptNumber,
        studentId: student._id,
        invoiceId: invoice._id,
        amount: paymentAmount,
        paymentMethod,
        paymentDate: new Date(paymentDate),
        transactionDetails: Object.keys(transactionDetails).length > 0 ? transactionDetails : undefined,
        allocation: paidRows.map(r => ({
          feeHeadName: r.feeHead,
          amount: roundToRupee(toNumber(r.paidAmount))
        })),
        remarks,
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedBy: userId,
        collectedBy: userId
      });

      await payment.save();
      results.paymentsCreated++;
    }
  }

  /**
   * Generate downloadable CSV template with sample data
   */
  static async generateTemplate() {
    const columns = [
      { key: 'admissionNumber', header: 'admissionNumber' },
      { key: 'feeHead', header: 'feeHead' },
      { key: 'feeType', header: 'feeType' },
      { key: 'annualAmount', header: 'annualAmount' },
      { key: 'paidAmount', header: 'paidAmount' },
      { key: 'paymentDate', header: 'paymentDate' },
      { key: 'paymentMethod', header: 'paymentMethod' },
      { key: 'receiptNumber', header: 'receiptNumber' },
      { key: 'transactionReference', header: 'transactionReference' },
      { key: 'chequeDate', header: 'chequeDate' },
      { key: 'bankName', header: 'bankName' },
      { key: 'collectedBy', header: 'collectedBy' },
      { key: 'dueDate', header: 'dueDate' },
      { key: 'discountAmount', header: 'discountAmount' },
      { key: 'discountReason', header: 'discountReason' },
      { key: 'concessionAmount', header: 'concessionAmount' },
      { key: 'lateFeeAmount', header: 'lateFeeAmount' },
      { key: 'academicSession', header: 'academicSession' },
      { key: 'remarks', header: 'remarks' }
    ];

    const sampleData = [
      {
        admissionNumber: 'ANE2024001',
        feeHead: 'Tuition Fee',
        feeType: 'recurring',
        annualAmount: '50000',
        paidAmount: '50000',
        paymentDate: '2025-06-15',
        paymentMethod: 'Cash',
        receiptNumber: 'RCP-2025-00001',
        transactionReference: '',
        chequeDate: '',
        bankName: '',
        collectedBy: 'Admin',
        dueDate: '2025-06-10',
        discountAmount: '0',
        discountReason: '',
        concessionAmount: '0',
        lateFeeAmount: '0',
        academicSession: '2025-2026',
        remarks: 'Paid in full'
      },
      {
        admissionNumber: 'ANE2024001',
        feeHead: 'Transport Fee',
        feeType: 'recurring',
        annualAmount: '12000',
        paidAmount: '6000',
        paymentDate: '2025-06-15',
        paymentMethod: 'Online',
        receiptNumber: '',
        transactionReference: 'UPI-114407091364',
        chequeDate: '',
        bankName: 'Union Bank',
        collectedBy: 'Admin',
        dueDate: '2025-06-10',
        discountAmount: '0',
        discountReason: '',
        concessionAmount: '0',
        lateFeeAmount: '500',
        academicSession: '2025-2026',
        remarks: 'Partial payment with late fee'
      },
      {
        admissionNumber: 'ANE2024002',
        feeHead: 'Tuition Fee',
        feeType: 'recurring',
        annualAmount: '50000',
        paidAmount: '0',
        paymentDate: '',
        paymentMethod: '',
        receiptNumber: '',
        transactionReference: '',
        chequeDate: '',
        bankName: '',
        collectedBy: '',
        dueDate: '2025-07-10',
        discountAmount: '0',
        discountReason: '',
        concessionAmount: '5000',
        lateFeeAmount: '0',
        academicSession: '2025-2026',
        remarks: 'Sibling concession'
      }
    ];

    return ImportExportService.generateTemplate(columns, sampleData);
  }
}

module.exports = FeeImportService;
