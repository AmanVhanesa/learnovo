const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
const FeeStructure = require('../models/FeeStructure');
const FeeInvoice = require('../models/FeeInvoice');
const AcademicSession = require('../models/AcademicSession');
const { logger } = require('../middleware/errorHandler');
const { roundToRupee } = require('../utils/money');

function getFrequencyMultiplier(frequency) {
  switch (frequency) {
  case 'monthly': return 12;
  case 'quarterly': return 4;
  case 'half-yearly': return 2;
  case 'yearly': return 1;
  case 'one-time': return 1;
  default: return 1;
  }
}

async function buildAllocatedHeads(student, feeStructure) {
  const heads = [];

  for (const head of feeStructure.feeHeads) {
    const entry = {
      feeHeadName: head.name,
      annualAmount: head.annualAmount || (head.amount * getFrequencyMultiplier(head.frequency || 'yearly')),
      type: head.type || (head.frequency === 'one-time' ? 'one_time' : 'recurring'),
      amount: head.amount,
      frequency: head.frequency,
      feeHeadId: head._id ? String(head._id) : undefined,
      isCompulsory: !head.isOptional,
      isAdmissionFee: head.isAdmissionFee || false,
      isIncluded: true,
      exclusionReason: null
    };

    // Old/returning students skip admission fee
    if (head.isAdmissionFee && student.studentType === 'old') {
      entry.isIncluded = false;
      entry.exclusionReason = 'Old student — exempt from admission fee';
      heads.push(entry);
      continue;
    }

    if (head.isAdmissionFee && student.isImported && student.studentType !== 'new') {
      entry.isIncluded = false;
      entry.exclusionReason = 'Imported old student — exempt from admission fee';
      heads.push(entry);
      continue;
    }

    if (head.isAdmissionFee && student.admissionFeePaid) {
      entry.isIncluded = false;
      entry.exclusionReason = 'Admission fee already paid';
      heads.push(entry);
      continue;
    }

    // Promoted students are returning — exclude admission fee by default
    if (head.isAdmissionFee) {
      entry.isIncluded = false;
      entry.exclusionReason = 'Returning student (promoted) — exempt from admission fee';
      heads.push(entry);
      continue;
    }

    heads.push(entry);
  }

  return heads;
}

function sumAnnual(heads) {
  let total = 0;
  for (const h of heads) {
    if (!h.isIncluded) continue;
    total += Number(h.annualAmount || h.amount || 0);
  }
  return roundToRupee(total);
}

/**
 * Resolve an AcademicSession for the target academic year.
 * Accepts either an explicit sessionId or a year-name string ("2025-2026").
 * Returns the session doc or null.
 */
async function resolveTargetSession({ tenantId, targetAcademicSessionId, academicYearName }) {
  if (targetAcademicSessionId) {
    return AcademicSession.findOne({ _id: targetAcademicSessionId, tenantId });
  }
  if (academicYearName) {
    return AcademicSession.findOne({ tenantId, name: academicYearName });
  }
  return null;
}

/**
 * Reallocate a single student's fees to a new class's FeeStructure for the given session.
 *
 * Returns one of:
 *   { status: 'created', allocationId }
 *   { status: 'skipped', reason }
 *   { status: 'error', reason }
 *
 * Safety rules:
 * - Never mutates an existing allocation for the same session if invoices already exist.
 * - Only creates a fresh allocation when none exists for {student, session}.
 * - Never touches historical invoices from old classes.
 */
async function reallocateStudentForSession({
  tenantId,
  student,
  newClassId,
  newSectionId,
  session,
  performedBy,
  paymentPlan = 'quarterly'
}) {
  if (!session) {
    return { status: 'skipped', reason: 'Target academic session not found' };
  }
  if (!newClassId) {
    return { status: 'skipped', reason: 'New class not resolved' };
  }

  // If an allocation already exists for this student+session, check invoices
  const existing = await AnnualFeeAllocation.findOne({
    tenantId,
    studentId: student._id,
    academicSessionId: session._id
  });

  if (existing) {
    const invoiceCount = await FeeInvoice.countDocuments({
      tenantId,
      studentId: student._id,
      academicSessionId: session._id,
      annualAllocationId: existing._id,
      status: { $ne: 'Cancelled' }
    });

    if (invoiceCount > 0) {
      return {
        status: 'skipped',
        reason: `Allocation already has ${invoiceCount} invoice(s) — manual review required`
      };
    }

    // Allocation exists but has no invoices → safe to replace
    await AnnualFeeAllocation.deleteOne({ _id: existing._id });
  }

  // Find fee structure for the new class + session
  const feeStructure = await FeeStructure.findOne({
    tenantId,
    classId: newClassId,
    academicSessionId: session._id,
    isActive: true
  });

  if (!feeStructure) {
    return {
      status: 'skipped',
      reason: `No active fee structure for new class in session "${session.name}"`
    };
  }

  const allocatedHeads = await buildAllocatedHeads(student, feeStructure);
  const totalAnnualAmount = sumAnnual(allocatedHeads);

  if (totalAnnualAmount <= 0) {
    return { status: 'skipped', reason: 'No applicable fee heads for student' };
  }

  const allocation = await AnnualFeeAllocation.create({
    tenantId,
    studentId: student._id,
    feeStructureId: feeStructure._id,
    classId: newClassId,
    sectionId: newSectionId || feeStructure.sectionId || null,
    academicSessionId: session._id,
    allocatedFeeHeads: allocatedHeads,
    totalAnnualAmount,
    balance: totalAnnualAmount,
    paymentPlan,
    generatedBy: performedBy
  });

  logger.info('Fee allocation reallocated on class change', {
    tenantId: String(tenantId),
    studentId: String(student._id),
    allocationId: String(allocation._id),
    sessionName: session.name,
    totalAnnualAmount
  });

  return { status: 'created', allocationId: allocation._id };
}

module.exports = {
  resolveTargetSession,
  reallocateStudentForSession
};
