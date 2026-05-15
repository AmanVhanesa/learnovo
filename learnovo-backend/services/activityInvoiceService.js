/**
 * Activity Invoice Service
 *
 * Generates monthly FeeInvoice rows from active ActivityEnrollments.
 *
 * Design:
 * - Each (student × activity × month) gets ONE FeeInvoice with invoiceType='activity'.
 * - Idempotent: re-running for the same month skips enrollments that already have an invoice.
 * - Reuses the existing FeeInvoice → Payment → Receipt → Income flow — no new payment infra.
 * - Fee is read from the ENROLLMENT (not the program) so historical billing is stable
 *   even if the program's monthly fee changes later.
 */

const FeeInvoice = require('../models/FeeInvoice');
const ActivityEnrollment = require('../models/ActivityEnrollment');
const StudentBalance = require('../models/StudentBalance');
const { roundToRupee, toNumber } = require('../utils/money');

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Compute the net amount for an enrollment given its fee + discount snapshot.
 */
function computeNetAmount(enrollment) {
  const fee = toNumber(enrollment.monthlyFee);
  if (enrollment.discountType === 'percent') {
    const pct = Math.min(Math.max(toNumber(enrollment.discountValue), 0), 100);
    return roundToRupee((fee * (100 - pct)) / 100);
  }
  if (enrollment.discountType === 'fixed') {
    return roundToRupee(Math.max(0, fee - toNumber(enrollment.discountValue)));
  }
  return roundToRupee(fee);
}

function computeDiscountAmount(enrollment) {
  const fee = toNumber(enrollment.monthlyFee);
  const net = computeNetAmount(enrollment);
  return Math.max(0, roundToRupee(fee - net));
}

/**
 * Returns true if the enrollment is billable during the given month.
 * Active or paused (paused == not billed but still alive) — we only invoice ACTIVE.
 */
function isEnrollmentBillableForMonth(enrollment, monthStart, monthEnd) {
  if (enrollment.status !== 'active') return false;
  const from = new Date(enrollment.enrolledFrom);
  if (from > monthEnd) return false;
  if (enrollment.enrolledTo) {
    const to = new Date(enrollment.enrolledTo);
    if (to < monthStart) return false;
  }
  return true;
}

/**
 * Find active enrollments that should be billed for a given month.
 * Returns enrollments populated with student + activityProgram refs.
 */
async function findBillableEnrollments({ tenantId, monthStart, monthEnd, academicSessionId, activityProgramId, enrollmentIds }) {
  const filter = {
    tenantId,
    status: 'active',
    enrolledFrom: { $lte: monthEnd },
    $or: [
      { enrolledTo: null },
      { enrolledTo: { $gte: monthStart } }
    ]
  };
  if (academicSessionId) filter.academicSession = academicSessionId;
  if (activityProgramId) filter.activityProgram = activityProgramId;
  if (enrollmentIds && enrollmentIds.length > 0) filter._id = { $in: enrollmentIds };

  return ActivityEnrollment.find(filter)
    .populate('student', 'name admissionNumber classId sectionId')
    .populate('activityProgram', 'name isActive')
    .lean();
}

/**
 * Preview what would be generated — no writes.
 */
async function previewMonthlyActivityInvoices({ tenantId, month, year, academicSessionId, activityProgramId, enrollmentIds }) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  const enrollments = await findBillableEnrollments({
    tenantId, monthStart, monthEnd, academicSessionId, activityProgramId, enrollmentIds
  });

  const items = [];
  let alreadyExists = 0;
  let toGenerate = 0;
  let totalAmount = 0;

  for (const enr of enrollments) {
    if (!enr.activityProgram || !enr.student) continue;
    if (!enr.activityProgram.isActive) continue;
    if (!isEnrollmentBillableForMonth(enr, monthStart, monthEnd)) continue;

    const periodLabel = `${enr.activityProgram.name} — ${monthLabel}`;
    const existing = await FeeInvoice.findOne({
      tenantId,
      studentId: enr.student._id,
      academicSessionId: enr.academicSession,
      invoiceType: 'activity',
      sourceId: enr._id,
      'billingPeriod.displayText': periodLabel,
      status: { $ne: 'Cancelled' }
    }).select('_id invoiceNumber').lean();

    const netAmount = computeNetAmount(enr);

    if (existing) {
      alreadyExists += 1;
      items.push({
        enrollmentId: enr._id,
        studentId: enr.student._id,
        studentName: enr.student.name,
        admissionNumber: enr.student.admissionNumber,
        activityName: enr.activityProgram.name,
        amount: netAmount,
        action: 'skip',
        existingInvoiceNumber: existing.invoiceNumber
      });
    } else {
      toGenerate += 1;
      totalAmount += netAmount;
      items.push({
        enrollmentId: enr._id,
        studentId: enr.student._id,
        studentName: enr.student.name,
        admissionNumber: enr.student.admissionNumber,
        activityName: enr.activityProgram.name,
        amount: netAmount,
        action: 'create'
      });
    }
  }

  return {
    month, year, monthLabel,
    toGenerate, alreadyExists,
    totalAmount: roundToRupee(totalAmount),
    items
  };
}

/**
 * Generate monthly invoices. Returns summary + per-enrollment outcomes.
 */
async function generateMonthlyActivityInvoices({
  tenantId, month, year, academicSessionId, activityProgramId, enrollmentIds,
  generatedBy, dueDay = 10
}) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
  const safeDay = Math.min(Math.max(toNumber(dueDay) || 10, 1), 28);
  const dueDate = new Date(year, month - 1, safeDay);

  const enrollments = await findBillableEnrollments({
    tenantId, monthStart, monthEnd, academicSessionId, activityProgramId, enrollmentIds
  });

  const created = [];
  const skipped = [];
  const failed = [];
  const studentsToRecalc = new Set();

  for (const enr of enrollments) {
    if (!enr.activityProgram || !enr.student) {
      skipped.push({ enrollmentId: enr._id, reason: 'Missing student or program' });
      continue;
    }
    if (!enr.activityProgram.isActive) {
      skipped.push({ enrollmentId: enr._id, reason: 'Activity is inactive' });
      continue;
    }
    if (!isEnrollmentBillableForMonth(enr, monthStart, monthEnd)) {
      skipped.push({ enrollmentId: enr._id, reason: 'Not active for this month' });
      continue;
    }

    const periodLabel = `${enr.activityProgram.name} — ${monthLabel}`;
    const netAmount = computeNetAmount(enr);
    const discountAmount = computeDiscountAmount(enr);
    const periodAmount = toNumber(enr.monthlyFee);

    if (netAmount <= 0) {
      skipped.push({ enrollmentId: enr._id, reason: 'Net amount is zero or negative' });
      continue;
    }

    // Idempotency check — re-check inside the loop so concurrent runs don't double-create
    // before the unique index catches them.
    const existing = await FeeInvoice.findOne({
      tenantId,
      studentId: enr.student._id,
      academicSessionId: enr.academicSession,
      invoiceType: 'activity',
      sourceId: enr._id,
      'billingPeriod.displayText': periodLabel,
      status: { $ne: 'Cancelled' }
    }).select('_id invoiceNumber').lean();

    if (existing) {
      skipped.push({
        enrollmentId: enr._id,
        studentName: enr.student.name,
        reason: 'Invoice already exists',
        invoiceNumber: existing.invoiceNumber
      });
      continue;
    }

    try {
      const invoiceNumber = await FeeInvoice.generateInvoiceNumber(tenantId);
      const invoice = await FeeInvoice.create({
        tenantId,
        invoiceNumber,
        studentId: enr.student._id,
        classId: enr.student.classId,
        sectionId: enr.student.sectionId || null,
        academicSessionId: enr.academicSession,
        invoiceType: 'activity',
        sourceId: enr._id,
        sourceLabel: enr.activityProgram.name,
        items: [{
          feeHeadName: enr.activityProgram.name,
          fullAnnualAmount: periodAmount,
          periodAmount,
          discount: discountAmount,
          netAmount,
          type: 'recurring',
          amount: netAmount,
          frequency: 'Monthly'
        }],
        totalAmount: netAmount,
        balanceAmount: netAmount,
        discountAmount: 0, // line-level discount only; keep header clean
        periodLabel,
        periodStart: monthStart,
        periodEnd: monthEnd,
        billingPeriod: {
          month,
          year,
          displayText: periodLabel
        },
        dueDate,
        generatedBy
      });
      created.push({
        enrollmentId: enr._id,
        studentName: enr.student.name,
        admissionNumber: enr.student.admissionNumber,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amount: netAmount
      });
      studentsToRecalc.add(`${enr.student._id}|${enr.academicSession}`);
    } catch (err) {
      if (err && err.code === 11000) {
        skipped.push({
          enrollmentId: enr._id,
          studentName: enr.student.name,
          reason: 'Duplicate (already invoiced)'
        });
      } else {
        failed.push({
          enrollmentId: enr._id,
          studentName: enr.student.name,
          error: err.message
        });
      }
    }
  }

  // Recalculate student balances once per affected student.
  for (const key of studentsToRecalc) {
    const [studentId, sessionId] = key.split('|');
    try {
      await StudentBalance.updateBalance(tenantId, studentId, sessionId);
    } catch (e) {
      // Non-fatal — balance can be recomputed later via the normal balance job.
    }
  }

  return {
    month, year, monthLabel,
    createdCount: created.length,
    skippedCount: skipped.length,
    failedCount: failed.length,
    totalAmount: roundToRupee(created.reduce((s, c) => s + c.amount, 0)),
    created, skipped, failed
  };
}

module.exports = {
  previewMonthlyActivityInvoices,
  generateMonthlyActivityInvoices,
  computeNetAmount,
  computeDiscountAmount,
  findBillableEnrollments
};
