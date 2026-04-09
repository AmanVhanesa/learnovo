/**
 * Fix SPIS admission fee invoices for "new" admission students.
 *
 * Run this AFTER re-importing students with the studentType field.
 *
 * Problem:
 *   All imported students had invoices generated WITHOUT admission fees.
 *   But "new" admission students should have had ₹1,000 admission fee.
 *   Their imported payments got applied against tuition-only invoices,
 *   incorrectly reducing the tuition balance.
 *
 * What this script does:
 *   1. Finds SPIS students with studentType = 'new' and isImported = true
 *   2. Finds their Q1 invoice (first quarter)
 *   3. If invoice is missing admission fee line item → adds it
 *   4. Updates invoice totalAmount & balanceAmount
 *   5. Updates allocation to include admission fee
 *   6. Recalculates student balance
 *
 * SPIS PRODUCTION ONLY — hardcoded to schoolCode: 'spis'.
 * IDEMPOTENT — skips invoices that already have admission fee.
 *
 * Usage:
 *   node scripts/fix-spis-admission-fee-invoices.js --dry-run
 *   node scripts/fix-spis-admission-fee-invoices.js
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const User = require('../models/User');
const AcademicSession = require('../models/AcademicSession');
const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
const FeeInvoice = require('../models/FeeInvoice');
const FeeStructure = require('../models/FeeStructure');
const StudentBalance = require('../models/StudentBalance');
const { roundToRupee, toNumber } = require('../utils/money');

const SCHOOL_CODE = 'spis';
const Q1_QUARTER = 1;

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // ── Verify SPIS tenant ──────────────────────────────────────────────
  const tenant = await Tenant.findOne({ schoolCode: SCHOOL_CODE });
  if (!tenant) {
    console.error(`FATAL: Tenant "${SCHOOL_CODE}" not found.`);
    process.exit(1);
  }
  const tenantId = tenant._id;
  console.log(`Tenant: ${tenant.schoolName} (${tenant.schoolCode})`);

  // ── Active session ──────────────────────────────────────────────────
  const session = await AcademicSession.findOne({ tenantId, isActive: true });
  if (!session) {
    console.error('FATAL: No active academic session.');
    process.exit(1);
  }
  console.log(`Academic Session: ${session.name}`);

  // ── Find admission fee from fee structures ──────────────────────────
  const feeStructures = await FeeStructure.find({ tenantId }).lean();
  let admissionFeeHead = null;

  for (const fs of feeStructures) {
    for (const head of fs.feeHeads) {
      if (head.isAdmissionFee) {
        admissionFeeHead = head;
        break;
      }
    }
    if (admissionFeeHead) break;
  }

  if (!admissionFeeHead) {
    console.error('FATAL: No fee head with isAdmissionFee=true found in any SPIS fee structure.');
    process.exit(1);
  }

  const admissionFeeAmount = toNumber(admissionFeeHead.annualAmount || admissionFeeHead.amount);
  console.log(`Admission fee head: "${admissionFeeHead.name}" — ₹${admissionFeeAmount}`);

  // ── Find new-admission imported students ────────────────────────────
  const newStudents = await User.find({
    tenantId,
    role: 'student',
    isImported: true,
    studentType: 'new'
  }).select('_id admissionNumber name classId sectionId admissionFeePaid').lean();

  console.log(`\nNew-admission imported students: ${newStudents.length}`);

  if (newStudents.length === 0) {
    console.log('Nothing to fix. Re-import students with studentType column first.');
    await mongoose.disconnect();
    process.exit(0);
  }

  if (dryRun) {
    console.log('\n═══════════════════════════════════════');
    console.log('  DRY RUN — no data will be written');
    console.log('═══════════════════════════════════════\n');
  }

  // ── Pre-fetch Q1 invoices ───────────────────────────────────────────
  const studentIds = newStudents.map(s => s._id);
  const q1Invoices = await FeeInvoice.find({
    tenantId,
    academicSessionId: session._id,
    studentId: { $in: studentIds },
    'billingPeriod.quarter': Q1_QUARTER,
    status: { $ne: 'Cancelled' }
  });
  const invoiceMap = new Map();
  q1Invoices.forEach(inv => invoiceMap.set(String(inv.studentId), inv));

  // ── Process each student ────────────────────────────────────────────
  const results = {
    fixed: 0,
    skippedAlreadyHas: 0,
    skippedNoInvoice: 0,
    errors: []
  };

  for (const student of newStudents) {
    const invoice = invoiceMap.get(String(student._id));

    if (!invoice) {
      results.skippedNoInvoice++;
      console.log(`  [SKIP] ${student.admissionNumber} (${student.name}) — no Q1 invoice`);
      continue;
    }

    // Check if invoice already has admission fee line item
    const hasAdmissionItem = invoice.items.some(
      item => item.feeHeadName === admissionFeeHead.name && item.type === 'one_time'
    );

    if (hasAdmissionItem) {
      results.skippedAlreadyHas++;
      continue;
    }

    // ── Calculate new amounts ─────────────────────────────────────────
    const oldTotal = toNumber(invoice.totalAmount);
    const oldPaid = toNumber(invoice.paidAmount);
    const oldDiscount = toNumber(invoice.discountAmount);
    const newTotal = roundToRupee(oldTotal + admissionFeeAmount);
    const newBalance = roundToRupee(newTotal - oldPaid - oldDiscount);

    let newStatus;
    if (newBalance <= 0) {
      newStatus = 'Paid';
    } else if (oldPaid > 0) {
      newStatus = 'Partial';
    } else {
      newStatus = 'Pending';
    }

    console.log(
      `  [FIX] ${student.admissionNumber} (${student.name}): ` +
      `${invoice.invoiceNumber} — ₹${oldTotal} → ₹${newTotal}, ` +
      `paid ₹${oldPaid}, balance ₹${roundToRupee(oldTotal - oldPaid)} → ₹${newBalance} [${newStatus}]`
    );

    if (dryRun) {
      results.fixed++;
      continue;
    }

    try {
      // ── Add admission fee line item ─────────────────────────────────
      invoice.items.push({
        feeHeadName: admissionFeeHead.name,
        feeHeadId: admissionFeeHead._id ? String(admissionFeeHead._id) : undefined,
        fullAnnualAmount: admissionFeeAmount,
        periodAmount: admissionFeeAmount,
        discount: 0,
        netAmount: admissionFeeAmount,
        type: 'one_time',
        amount: admissionFeeAmount,
        frequency: 'One-time'
      });

      invoice.totalAmount = newTotal;
      invoice.balanceAmount = newBalance;
      invoice.status = newStatus;
      await invoice.save();

      // ── Update Allocation ───────────────────────────────────────────
      if (invoice.annualAllocationId) {
        const allocation = await AnnualFeeAllocation.findById(invoice.annualAllocationId);
        if (allocation) {
          const admHead = allocation.allocatedFeeHeads.find(
            h => h.isAdmissionFee && !h.isIncluded
          );
          if (admHead) {
            admHead.isIncluded = true;
            admHead.exclusionReason = null;
          } else {
            allocation.allocatedFeeHeads.push({
              feeHeadName: admissionFeeHead.name,
              annualAmount: admissionFeeAmount,
              type: 'one_time',
              isCompulsory: true,
              isAdmissionFee: true,
              isIncluded: true,
              exclusionReason: null
            });
          }
          await allocation.save();
        }
      }

      // ── Recalculate Student Balance ─────────────────────────────────
      await StudentBalance.updateBalance(tenantId, student._id, session._id);

      results.fixed++;
    } catch (err) {
      results.errors.push({
        admissionNumber: student.admissionNumber,
        name: student.name,
        error: err.message
      });
      console.error(`  [ERR] ${student.admissionNumber}: ${err.message}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('  SPIS ADMISSION FEE FIX SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`  New-admission students:        ${newStudents.length}`);
  console.log(`  Invoices fixed (adm fee added): ${results.fixed}`);
  console.log(`  Skipped (already has adm fee):  ${results.skippedAlreadyHas}`);
  console.log(`  Skipped (no Q1 invoice):        ${results.skippedNoInvoice}`);
  console.log(`  Errors:                         ${results.errors.length}`);

  if (dryRun) {
    console.log('\n  ⚠ DRY RUN — nothing was written to the database');
    console.log('  Remove --dry-run to execute for real.');
  }

  if (results.errors.length > 0) {
    console.log('\n  Errors:');
    results.errors.forEach(e => {
      console.log(`    ${e.admissionNumber} (${e.name}) — ${e.error}`);
    });
  }

  console.log('');
  await mongoose.disconnect();
  process.exit(results.errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
