/**
 * Invoice Generation Service
 *
 * Core algorithm for generating invoices from fee structures.
 * Separates PRICE (annual fee structure) from PAYMENT SCHEDULE (payment plan).
 *
 * Key principles:
 * - Fee structures always store annual amounts
 * - Payment plan determines how the annual total is split into invoices
 * - One-time fees (admission) only go in the first invoice
 * - Admission fees are excluded for imported students and students already charged
 * - Rounding errors are adjusted on the last invoice to match exact annual total
 */

const FeeInvoice = require('../models/FeeInvoice');
const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
const StudentBalance = require('../models/StudentBalance');
const User = require('../models/User');
const { toNumber, roundToRupee, sumMoney } = require('../utils/money');

/**
 * Get the annual amount for a fee head, handling both new and legacy formats.
 * New format: annualAmount is stored directly.
 * Legacy format: amount + frequency needs multiplication.
 */
function getFeeHeadAnnualAmount(head) {
  // New format — annualAmount is set
  if (head.annualAmount && head.annualAmount > 0) {
    return toNumber(head.annualAmount);
  }

  // Legacy format — compute from amount × frequency multiplier
  const amount = toNumber(head.amount);
  if (amount <= 0) return 0;

  const freq = head.frequency || 'yearly';
  switch (freq) {
  case 'monthly': return amount * 12;
  case 'quarterly': return amount * 4;
  case 'half-yearly': return amount * 2;
  case 'yearly': return amount;
  case 'one-time': return amount;
  default: return amount;
  }
}

/**
 * Get the fee head type, handling both new and legacy formats.
 */
function getFeeHeadType(head) {
  if (head.type) return head.type;
  // Legacy: derive from frequency
  if (head.frequency === 'one-time') return 'one_time';
  return 'recurring';
}

/**
 * Check if a student has ever been charged a specific fee head.
 * Only considers non-cancelled invoices.
 */
async function hasBeenChargedBefore(tenantId, studentId, feeHeadName) {
  const existing = await FeeInvoice.findOne({
    tenantId,
    studentId,
    'items.feeHeadName': feeHeadName,
    status: { $ne: 'Cancelled' }
  });
  return !!existing;
}

/**
 * Determine which fee heads apply to a specific student.
 * Handles admission fee exclusions for imported students and already-charged students.
 */
async function buildApplicableFeeHeads(tenantId, student, feeStructure) {
  const recurringHeads = [];
  const oneTimeHeads = [];

  for (const head of feeStructure.feeHeads) {
    const headType = getFeeHeadType(head);
    const annualAmount = getFeeHeadAnnualAmount(head);

    if (annualAmount <= 0) continue;

    const headEntry = {
      feeHeadName: head.name,
      feeHeadId: head._id ? String(head._id) : undefined,
      annualAmount,
      type: headType,
      isCompulsory: !head.isOptional,
      isAdmissionFee: head.isAdmissionFee || false,
      isIncluded: true,
      exclusionReason: null
    };

    if (headType === 'one_time') {
      // Check admission fee exclusions
      if (head.isAdmissionFee) {
        if (student.isImported && student.studentType !== 'new') {
          headEntry.isIncluded = false;
          headEntry.exclusionReason = 'Old student — exempt from admission fee';
        } else if (student.admissionFeePaid) {
          headEntry.isIncluded = false;
          headEntry.exclusionReason = 'Admission fee already paid';
        } else {
          // Check if ever charged before (any year, any invoice)
          const alreadyCharged = await hasBeenChargedBefore(tenantId, student._id, head.name);
          if (alreadyCharged) {
            headEntry.isIncluded = false;
            headEntry.exclusionReason = 'Admission fee already invoiced in a prior period';
          }
        }
      }
      oneTimeHeads.push(headEntry);
    } else {
      recurringHeads.push(headEntry);
    }
  }

  return { recurringHeads, oneTimeHeads, allHeads: [...recurringHeads, ...oneTimeHeads] };
}

/**
 * Generate billing periods for an academic year based on payment plan.
 * Academic year in India: April to March (e.g., "2025-26" = Apr 2025 → Mar 2026).
 *
 * @param {string} academicYearName - e.g., "2025-2026" or "2025-26"
 * @param {string} paymentPlan - 'monthly' | 'quarterly' | 'half-yearly' | 'annual'
 * @param {number} dueDay - Day of month for due dates (default 10)
 * @returns {Array} Array of period objects
 */
function generatePeriods(academicYearName, paymentPlan, dueDay = 10) {
  // Parse academic year — extract start year
  // Handles formats: "2025-2026", "2025-26", "2025-2026"
  const yearMatch = String(academicYearName).match(/(\d{4})/);
  const startYear = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();

  // Clamp due day to 1-28
  const safeDay = Math.min(Math.max(dueDay || 10, 1), 28);

  switch (paymentPlan) {
  case 'monthly':
    return generateMonthlyPeriods(startYear, safeDay);
  case 'quarterly':
    return generateQuarterlyPeriods(startYear, safeDay);
  case 'half-yearly':
    return generateHalfYearlyPeriods(startYear, safeDay);
  case 'annual':
    return generateAnnualPeriod(startYear, safeDay);
  default:
    return generateQuarterlyPeriods(startYear, safeDay);
  }
}

function generateMonthlyPeriods(startYear, dueDay) {
  const months = [
    { name: 'April', m: 3, y: startYear },
    { name: 'May', m: 4, y: startYear },
    { name: 'June', m: 5, y: startYear },
    { name: 'July', m: 6, y: startYear },
    { name: 'August', m: 7, y: startYear },
    { name: 'September', m: 8, y: startYear },
    { name: 'October', m: 9, y: startYear },
    { name: 'November', m: 10, y: startYear },
    { name: 'December', m: 11, y: startYear },
    { name: 'January', m: 0, y: startYear + 1 },
    { name: 'February', m: 1, y: startYear + 1 },
    { name: 'March', m: 2, y: startYear + 1 }
  ];

  return months.map((month, index) => {
    const start = new Date(month.y, month.m, 1);
    const end = new Date(month.y, month.m + 1, 0); // last day of month
    const due = new Date(month.y, month.m, dueDay);

    return {
      label: `${month.name} ${month.y}`,
      start,
      end,
      dueDate: due,
      index,
      // billingPeriod for backward compat
      billingPeriod: {
        month: month.m + 1,
        year: month.y,
        displayText: `${month.name} ${month.y}`
      }
    };
  });
}

function generateQuarterlyPeriods(startYear, dueDay) {
  return [
    {
      label: `Q1 ${startYear} (Apr-Jun)`,
      start: new Date(startYear, 3, 1),
      end: new Date(startYear, 5, 30),
      dueDate: new Date(startYear, 3, dueDay),
      index: 0,
      billingPeriod: { quarter: 1, year: startYear, displayText: `Q1 ${startYear} (Apr-Jun)` }
    },
    {
      label: `Q2 ${startYear} (Jul-Sep)`,
      start: new Date(startYear, 6, 1),
      end: new Date(startYear, 8, 30),
      dueDate: new Date(startYear, 6, dueDay),
      index: 1,
      billingPeriod: { quarter: 2, year: startYear, displayText: `Q2 ${startYear} (Jul-Sep)` }
    },
    {
      label: `Q3 ${startYear} (Oct-Dec)`,
      start: new Date(startYear, 9, 1),
      end: new Date(startYear, 11, 31),
      dueDate: new Date(startYear, 9, dueDay),
      index: 2,
      billingPeriod: { quarter: 3, year: startYear, displayText: `Q3 ${startYear} (Oct-Dec)` }
    },
    {
      label: `Q4 ${startYear + 1} (Jan-Mar)`,
      start: new Date(startYear + 1, 0, 1),
      end: new Date(startYear + 1, 2, 31),
      dueDate: new Date(startYear + 1, 0, dueDay),
      index: 3,
      billingPeriod: { quarter: 4, year: startYear + 1, displayText: `Q4 ${startYear + 1} (Jan-Mar)` }
    }
  ];
}

function generateHalfYearlyPeriods(startYear, dueDay) {
  return [
    {
      label: `H1 ${startYear} (Apr-Sep)`,
      start: new Date(startYear, 3, 1),
      end: new Date(startYear, 8, 30),
      dueDate: new Date(startYear, 3, dueDay),
      index: 0,
      billingPeriod: { quarter: 1, year: startYear, displayText: `H1 ${startYear} (Apr-Sep)` }
    },
    {
      label: `H2 ${startYear}-${startYear + 1} (Oct-Mar)`,
      start: new Date(startYear, 9, 1),
      end: new Date(startYear + 1, 2, 31),
      dueDate: new Date(startYear, 9, dueDay),
      index: 1,
      billingPeriod: { quarter: 3, year: startYear, displayText: `H2 ${startYear}-${startYear + 1} (Oct-Mar)` }
    }
  ];
}

function generateAnnualPeriod(startYear, dueDay) {
  return [
    {
      label: `Full Year (Apr ${startYear} - Mar ${startYear + 1})`,
      start: new Date(startYear, 3, 1),
      end: new Date(startYear + 1, 2, 31),
      dueDate: new Date(startYear, 3, dueDay),
      index: 0,
      billingPeriod: { year: startYear, displayText: `Academic Year ${startYear}-${startYear + 1}` }
    }
  ];
}

/**
 * Filter periods for mid-year admissions.
 * Only returns periods that start on or after the student's admission date.
 *
 * @param {Array} periods - All periods for the year
 * @param {Date} admissionDate - Student's admission date (null = start of year)
 * @returns {Array} Filtered periods
 */
function filterPeriodsForMidYearAdmission(periods, admissionDate) {
  if (!admissionDate) return periods;

  const admission = new Date(admissionDate);
  return periods.filter(period => period.end >= admission);
}

/**
 * Core algorithm: Generate all invoices for a student for an academic year.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {Object} params.student - Student document (must have _id, classId, isImported, admissionFeePaid, admissionDate)
 * @param {Object} params.feeStructure - FeeStructure document
 * @param {string} params.paymentPlan - 'monthly' | 'quarterly' | 'half-yearly' | 'annual'
 * @param {string} params.academicSessionId
 * @param {string} params.academicYearName - e.g., "2025-2026"
 * @param {string} params.generatedBy - User ID who triggered generation
 * @param {Date} [params.admissionDate] - For mid-year admission filtering
 * @param {number} [params.dueDay] - Day of month for due dates (default 10)
 * @returns {Object} { allocation, invoices, summary }
 */
async function generateInvoicesForStudent({
  tenantId,
  student,
  feeStructure,
  paymentPlan,
  academicSessionId,
  academicYearName,
  generatedBy,
  admissionDate,
  dueDay = 10,
  concessionPercentage = 0,
  concessionReason = null
}) {
  // 1. Build applicable fee heads for this student
  const { recurringHeads, oneTimeHeads, allHeads } = await buildApplicableFeeHeads(
    tenantId, student, feeStructure
  );

  const includedRecurring = recurringHeads.filter(h => h.isIncluded);
  const includedOneTime = oneTimeHeads.filter(h => h.isIncluded);

  // Apply concession (e.g., 50% for 3rd student) to annual amounts
  const concessionMultiplier = concessionPercentage > 0 ? (100 - concessionPercentage) / 100 : 1;
  if (concessionMultiplier < 1) {
    for (const head of includedRecurring) {
      head.originalAnnualAmount = head.annualAmount;
      head.annualAmount = roundToRupee(head.annualAmount * concessionMultiplier);
    }
    for (const head of includedOneTime) {
      head.originalAnnualAmount = head.annualAmount;
      head.annualAmount = roundToRupee(head.annualAmount * concessionMultiplier);
    }
    // Also update allHeads for allocation snapshot
    for (const head of allHeads) {
      if (head.isIncluded) {
        head.originalAnnualAmount = head.originalAnnualAmount || head.annualAmount;
        head.annualAmount = roundToRupee((head.originalAnnualAmount || head.annualAmount) * concessionMultiplier);
      }
    }
  }

  // 2. Calculate totals
  const totalRecurringAnnual = roundToRupee(sumMoney(includedRecurring.map(h => h.annualAmount)));
  const totalOneTime = roundToRupee(sumMoney(includedOneTime.map(h => h.annualAmount)));
  const totalAnnual = totalRecurringAnnual + totalOneTime;

  if (totalAnnual <= 0) {
    return { allocation: null, invoices: [], summary: { total: 0, skipped: true, reason: 'No applicable fee heads' } };
  }

  // 3. Check if allocation already exists.
  // If an allocation exists but every linked invoice is Cancelled, the prior generation
  // was effectively undone — clean it up and continue so regeneration works.
  const existingAllocation = await AnnualFeeAllocation.findOne({
    tenantId,
    studentId: student._id,
    academicSessionId
  });

  if (existingAllocation) {
    const activeInvoice = await FeeInvoice.findOne({
      tenantId,
      studentId: student._id,
      academicSessionId,
      status: { $ne: 'Cancelled' }
    });

    if (activeInvoice) {
      return {
        allocation: existingAllocation,
        invoices: [],
        summary: { total: 0, skipped: true, reason: 'Allocation already exists for this student and academic year' }
      };
    }

    // All prior invoices cancelled — safe to remove the stale allocation and regenerate.
    await AnnualFeeAllocation.deleteOne({ _id: existingAllocation._id });
  }

  // 4. Get billing periods and filter for mid-year admission
  let periods = generatePeriods(academicYearName, paymentPlan, dueDay);
  if (admissionDate || student.admissionDate) {
    periods = filterPeriodsForMidYearAdmission(periods, admissionDate || student.admissionDate);
  }

  const numberOfPeriods = periods.length;
  if (numberOfPeriods === 0) {
    return { allocation: null, invoices: [], summary: { total: 0, skipped: true, reason: 'No billing periods available' } };
  }

  // 5. Create allocation
  const allocationData = {
    tenantId,
    studentId: student._id,
    feeStructureId: feeStructure._id,
    classId: student.classId || feeStructure.classId,
    sectionId: student.sectionId || feeStructure.sectionId || null,
    academicSessionId,
    allocatedFeeHeads: allHeads,
    totalAnnualAmount: totalAnnual,
    balance: totalAnnual,
    paymentPlan,
    generatedBy
  };
  if (concessionPercentage > 0) {
    allocationData.concessionPercentage = concessionPercentage;
    allocationData.concessionReason = concessionReason || `${concessionPercentage}% concession`;
  }
  const allocation = await AnnualFeeAllocation.create(allocationData);

  // 6. Generate invoices
  const invoices = [];

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const isFirstPeriod = (i === 0);
    const isLastPeriod = (i === periods.length - 1);
    const lineItems = [];

    // 6a. Add recurring heads — split evenly across periods
    for (const head of includedRecurring) {
      const splitAmount = roundToRupee(head.annualAmount / numberOfPeriods);

      lineItems.push({
        feeHeadName: head.feeHeadName,
        feeHeadId: head.feeHeadId,
        fullAnnualAmount: head.annualAmount,
        periodAmount: splitAmount,
        discount: 0,
        netAmount: splitAmount,
        type: 'recurring',
        // Backward compat
        amount: splitAmount,
        frequency: paymentPlan === 'monthly' ? 'Monthly' : paymentPlan === 'quarterly' ? 'Quarterly' : paymentPlan === 'annual' ? 'Annual' : 'Annual'
      });
    }

    // 6b. Add one-time heads ONLY to the first invoice
    if (isFirstPeriod) {
      for (const head of includedOneTime) {
        lineItems.push({
          feeHeadName: head.feeHeadName,
          feeHeadId: head.feeHeadId,
          fullAnnualAmount: head.annualAmount,
          periodAmount: head.annualAmount,
          discount: 0,
          netAmount: head.annualAmount,
          type: 'one_time',
          // Backward compat
          amount: head.annualAmount,
          frequency: 'One-time'
        });
      }
    }

    if (lineItems.length === 0) continue;

    const invoiceTotal = roundToRupee(sumMoney(lineItems.map(li => li.netAmount)));

    // Check for duplicates before creating
    const existingInvoice = await FeeInvoice.findOne({
      tenantId,
      studentId: student._id,
      academicSessionId,
      'billingPeriod.displayText': period.billingPeriod.displayText,
      status: { $ne: 'Cancelled' }
    });

    if (existingInvoice) continue;

    const invoiceNumber = await FeeInvoice.generateInvoiceNumber(tenantId);

    invoices.push({
      tenantId,
      invoiceNumber,
      studentId: student._id,
      classId: student.classId || feeStructure.classId,
      sectionId: student.sectionId || feeStructure.sectionId || null,
      academicSessionId,
      feeStructureId: feeStructure._id,
      annualAllocationId: allocation._id,
      items: lineItems,
      totalAmount: invoiceTotal,
      balanceAmount: invoiceTotal,
      dueDate: period.dueDate,
      periodLabel: period.label,
      periodStart: period.start,
      periodEnd: period.end,
      billingPeriod: period.billingPeriod,
      generatedBy,
      ...(concessionPercentage > 0 && { remarks: concessionReason || `${concessionPercentage}% concession applied` }),
      _isLast: isLastPeriod // temp flag for rounding adjustment
    });
  }

  // 7. Handle rounding errors
  // Sum of all invoice totals must equal totalAnnual exactly
  if (invoices.length > 0) {
    const actualTotal = sumMoney(invoices.map(inv => inv.totalAmount));
    if (actualTotal !== totalAnnual) {
      const diff = totalAnnual - actualTotal;
      const lastInvoice = invoices[invoices.length - 1];
      lastInvoice.totalAmount = roundToRupee(lastInvoice.totalAmount + diff);
      lastInvoice.balanceAmount = lastInvoice.totalAmount;

      // Adjust the last recurring line item
      const lastRecurringItem = lastInvoice.items.findLast(li => li.type === 'recurring');
      if (lastRecurringItem) {
        lastRecurringItem.periodAmount = roundToRupee(lastRecurringItem.periodAmount + diff);
        lastRecurringItem.netAmount = lastRecurringItem.periodAmount;
        lastRecurringItem.amount = lastRecurringItem.periodAmount;
      }
    }
  }

  // 8. Save all invoices
  const savedInvoices = [];
  for (const invoiceData of invoices) {
    delete invoiceData._isLast;
    try {
      const invoice = await FeeInvoice.create(invoiceData);
      savedInvoices.push(invoice);
    } catch (err) {
      // Skip duplicate key errors (race condition safety)
      if (err.code === 11000) continue;
      throw err;
    }
  }

  // 9. Mark admissionFeePaid if applicable
  if (includedOneTime.some(h => h.isAdmissionFee) && !student.admissionFeePaid) {
    await User.updateOne(
      { _id: student._id },
      { $set: { admissionFeePaid: true } }
    );
  }

  // 10. Update student balance
  await StudentBalance.updateBalance(tenantId, student._id, academicSessionId);

  return {
    allocation,
    invoices: savedInvoices,
    summary: {
      total: totalAnnual,
      recurringTotal: totalRecurringAnnual,
      oneTimeTotal: totalOneTime,
      invoiceCount: savedInvoices.length,
      paymentPlan,
      periods: periods.map(p => p.label)
    }
  };
}

/**
 * Generate invoices for multiple students (bulk operation).
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {Array} params.students - Array of student documents
 * @param {Object} params.feeStructure - FeeStructure document
 * @param {string} params.paymentPlan
 * @param {string} params.academicSessionId
 * @param {string} params.academicYearName
 * @param {string} params.generatedBy
 * @param {number} [params.dueDay]
 * @returns {Object} { results, errors, skipped }
 */
async function generateInvoicesForBulk({
  tenantId,
  students,
  feeStructure,
  paymentPlan,
  academicSessionId,
  academicYearName,
  generatedBy,
  dueDay = 10
}) {
  const results = [];
  const errors = [];
  const skipped = [];

  for (const student of students) {
    try {
      const result = await generateInvoicesForStudent({
        tenantId,
        student,
        feeStructure,
        paymentPlan,
        academicSessionId,
        academicYearName,
        generatedBy,
        dueDay
      });

      if (result.summary.skipped) {
        skipped.push({
          studentId: student._id,
          studentName: student.name,
          reason: result.summary.reason
        });
      } else {
        results.push({
          studentId: student._id,
          studentName: student.name,
          allocation: result.allocation,
          invoiceCount: result.invoices.length,
          total: result.summary.total
        });
      }
    } catch (err) {
      if (err.code === 11000) {
        skipped.push({
          studentId: student._id,
          studentName: student.name,
          reason: 'Allocation or invoices already exist'
        });
      } else {
        errors.push({
          studentId: student._id,
          studentName: student.name,
          error: err.message
        });
      }
    }
  }

  return { results, errors, skipped };
}

/**
 * Preview invoice generation without saving (dry run).
 * Shows what would be generated for each student.
 */
async function previewInvoiceGeneration({
  tenantId,
  students,
  feeStructure,
  paymentPlan,
  academicYearName,
  academicSessionId,
  dueDay = 10
}) {
  const previews = [];

  for (const student of students) {
    const { recurringHeads, oneTimeHeads } = await buildApplicableFeeHeads(
      tenantId, student, feeStructure
    );

    const includedRecurring = recurringHeads.filter(h => h.isIncluded);
    const includedOneTime = oneTimeHeads.filter(h => h.isIncluded);
    const totalRecurring = roundToRupee(sumMoney(includedRecurring.map(h => h.annualAmount)));
    const totalOneTime = roundToRupee(sumMoney(includedOneTime.map(h => h.annualAmount)));
    const totalAnnual = totalRecurring + totalOneTime;

    let periods = generatePeriods(academicYearName, paymentPlan, dueDay);
    if (student.admissionDate) {
      periods = filterPeriodsForMidYearAdmission(periods, student.admissionDate);
    }

    const numberOfPeriods = periods.length;
    const perPeriodRecurring = numberOfPeriods > 0 ? roundToRupee(totalRecurring / numberOfPeriods) : 0;

    // Check if allocation already exists
    const existingAllocation = await AnnualFeeAllocation.findOne({
      tenantId,
      studentId: student._id,
      academicSessionId
    });

    const invoiceBreakdown = periods.map((period, i) => {
      let amount = perPeriodRecurring;
      if (i === 0) amount += totalOneTime;
      return { period: period.label, amount: roundToRupee(amount) };
    });

    previews.push({
      studentId: student._id,
      studentName: student.name,
      admissionNumber: student.admissionNumber || student.studentId,
      class: student.class || '',
      isImported: student.isImported || false,
      studentType: student.studentType || 'new',
      isNew: !student.isImported && !student.admissionFeePaid,
      recurringTotal: totalRecurring,
      oneTimeTotal: totalOneTime,
      totalAnnual,
      invoiceBreakdown,
      hasExistingAllocation: !!existingAllocation,
      applicableFeeHeads: [...includedRecurring, ...includedOneTime],
      excludedFeeHeads: [
        ...recurringHeads.filter(h => !h.isIncluded),
        ...oneTimeHeads.filter(h => !h.isIncluded)
      ]
    });
  }

  return previews;
}

module.exports = {
  generateInvoicesForStudent,
  generateInvoicesForBulk,
  previewInvoiceGeneration,
  generatePeriods,
  filterPeriodsForMidYearAdmission,
  buildApplicableFeeHeads,
  getFeeHeadAnnualAmount,
  getFeeHeadType,
  hasBeenChargedBefore
};
