#!/usr/bin/env node
/**
 * Clean-slate correction for SPIS students #6375 (NEHA) and #6387
 * (MOHAMMED HUSSIAN KHAN). Both had a ₹5,500 Q1 receipt created today
 * without cash actually changing hands. The school wants both students'
 * fees left fully pending with the "Financially weak — ₹3,300/quarter"
 * concession + ₹1,000 admission discount on Q1 — and no record of the
 * mistaken collection visible on the receipts list.
 *
 * What this script does (idempotent):
 *   1. Hard-deletes every Payment row for the student (including any
 *      reversal entries from a previous cleanup attempt) so the receipts
 *      list shows nothing for the date.
 *   2. Hard-deletes the linked Income rows (matched by paymentReference =
 *      receipt number) so the Finance dashboard doesn't carry stale
 *      Income records or their soft-deleted shells.
 *   3. Resets paidAmount to 0 on every quarterly invoice for the student
 *      (only matters for 6387 since 6375's Q1 was already restored by
 *      the earlier reversal).
 *   4. Applies the target concessions on every quarterly invoice:
 *        Q1: discountAmount = 2200  (₹1200 tuition + ₹1000 admission)
 *        Q2/Q3/Q4: discountAmount = 1200  (₹1200 tuition each)
 *      No-op if already at target.
 *   5. Recalculates AnnualFeeAllocation from invoices and StudentBalance.
 *   6. Writes a single PAYMENT_DELETED FeeAuditLog entry per student
 *      capturing the receipt numbers + amount + reason — backend-only
 *      compliance trail, not visible on user-facing screens.
 *
 * Re-running the script after success is a no-op.
 *
 * Usage:
 *   node clean-6375-6387.js              # dry-run (default)
 *   node clean-6375-6387.js --execute    # apply
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') });

const Tenant = require('../../models/Tenant');
const User = require('../../models/User');
const FeeInvoice = require('../../models/FeeInvoice');
const Payment = require('../../models/Payment');
const Income = require('../../models/Income');
const AnnualFeeAllocation = require('../../models/AnnualFeeAllocation');
const StudentBalance = require('../../models/StudentBalance');
const FeeAuditLog = require('../../models/FeeAuditLog');
const { roundToRupee, toNumber } = require('../../utils/money');

const ADMISSIONS = ['6375', '6387'];
const TUITION_CONCESSION_PER_QUARTER = 1200;
const ADMISSION_FEE_DISCOUNT_Q1 = 1000;
const REASON =
  'Receipt was created in error — no cash collected. Student moved to ₹3,300/quarter (financially weak) category with ₹1,000 admission-fee discount on Q1. Receipts purged for clean slate.';

function parseArgs() {
  return { execute: process.argv.slice(2).includes('--execute') };
}

async function processStudent(tenant, admissionNumber, admin, execute) {
  const tenantId = tenant._id;
  const student = await User.findOne({
    tenantId, role: 'student', admissionNumber
  }).select('_id name fullName admissionNumber').lean();
  if (!student) {
    console.error(`✗ #${admissionNumber} not found`);
    return;
  }
  console.log(`\n=== #${admissionNumber} ${student.name || student.fullName} ===`);

  // ── Step 1+2: collect all Payment + linked Income docs to delete ────
  const payments = await Payment.find({ tenantId, studentId: student._id })
    .select('_id receiptNumber amount').lean();
  const receiptNumbers = payments.map(p => p.receiptNumber);
  const incomes = receiptNumbers.length
    ? await Income.find({ tenantId, paymentReference: { $in: receiptNumbers } })
      .select('_id amount paymentReference isDeleted').lean()
    : [];

  console.log(`  Payments to delete: ${payments.length}`);
  payments.forEach(p => console.log(`    ${p.receiptNumber} amt=${p.amount}`));
  console.log(`  Incomes to delete:  ${incomes.length}`);
  incomes.forEach(i => console.log(`    income _id=${String(i._id)} amt=${i.amount} ref=${i.paymentReference} deleted=${i.isDeleted || false}`));

  if (execute && payments.length) {
    await Payment.deleteMany({ tenantId, studentId: student._id });
  }
  if (execute && incomes.length) {
    await Income.deleteMany({ _id: { $in: incomes.map(i => i._id) } });
  }

  // ── Step 3: reset paidAmount to 0 + step 4: apply concessions ───────
  const invoices = await FeeInvoice.find({ tenantId, studentId: student._id })
    .sort({ periodStart: 1 });
  if (invoices.length !== 4) {
    console.error(`  ✗ Expected 4 invoices, found ${invoices.length} — aborting this student.`);
    return;
  }

  for (const inv of invoices) {
    const qtr = inv.billingPeriod && inv.billingPeriod.quarter;
    const targetDiscount = qtr === 1
      ? TUITION_CONCESSION_PER_QUARTER + ADMISSION_FEE_DISCOUNT_Q1
      : TUITION_CONCESSION_PER_QUARTER;
    const totalAmt = toNumber(inv.totalAmount) + toNumber(inv.lateFeeApplied || 0);
    const newPaid = 0;
    const newDiscount = roundToRupee(targetDiscount);
    const newBalance = Math.max(0, roundToRupee(totalAmt - newPaid - newDiscount));
    const status = newBalance <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Pending');

    const noChange = (
      toNumber(inv.paidAmount) === newPaid
      && toNumber(inv.discountAmount) === newDiscount
      && inv.status === status
    );

    console.log(`  Q${qtr} ${inv.invoiceNumber}: ` +
      `paid ${inv.paidAmount}→${newPaid}, ` +
      `discount ${inv.discountAmount}→${newDiscount}, ` +
      `balance ${inv.balanceAmount}→${newBalance}, ` +
      `${inv.status}→${status}` +
      (noChange ? ' (no change)' : ''));

    if (execute && !noChange) {
      await FeeInvoice.updateOne(
        { _id: inv._id, tenantId },
        { $set: { paidAmount: newPaid, discountAmount: newDiscount, balanceAmount: newBalance, status } }
      );
    }
  }

  // ── Step 5: recalc allocation + StudentBalance ──────────────────────
  const alloc = await AnnualFeeAllocation.findOne({ tenantId, studentId: student._id }).lean();
  if (alloc) {
    if (execute) {
      await AnnualFeeAllocation.recalculateFromInvoices(alloc._id);
      const after = await AnnualFeeAllocation.findById(alloc._id).lean();
      console.log(`  Allocation: paid=${after.totalPaid} disc=${after.totalDiscount} waived=${after.totalWaived||0} balance=${after.balance}`);
    } else {
      console.log(`  Allocation (current): paid=${alloc.totalPaid} disc=${alloc.totalDiscount} waived=${alloc.totalWaived||0} balance=${alloc.balance}`);
    }
  }

  if (execute) {
    try {
      await StudentBalance.updateBalance(tenantId, student._id, invoices[0].academicSessionId);
    } catch (e) {
      console.warn('  ⚠ StudentBalance recalc failed (non-fatal):', e.message);
    }

    if (payments.length || incomes.length) {
      try {
        await FeeAuditLog.logAction({
          tenantId,
          action: 'PAYMENT_DELETED',
          entityType: 'Payment',
          entityId: student._id,
          userId: admin._id,
          userName: admin.name || admin.fullName || 'Admin',
          userRole: admin.role,
          details: {
            admissionNumber,
            studentName: student.name || student.fullName,
            deletedReceiptNumbers: receiptNumbers,
            deletedIncomeIds: incomes.map(i => String(i._id)),
            totalAmountAffected: payments.reduce((s, p) => s + toNumber(p.amount), 0),
            reason: REASON
          },
          ipAddress: 'cli/clean-6375-6387.js'
        });
      } catch (_) { /* non-fatal */ }
    }
  }
}

(async() => {
  const { execute } = parseArgs();
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: /spis/i }).lean();
  if (!tenant) { console.error('SPIS tenant not found'); process.exit(1); }
  console.log(`✓ Tenant: ${tenant.schoolName} (${tenant.schoolCode})`);

  const admin = await User.findOne({
    tenantId: tenant._id, role: 'admin', isActive: true
  }).select('_id name fullName role').lean();
  if (!admin) { console.error('No active admin user'); process.exit(1); }

  if (!execute) {
    console.log('═══════════════════════════════════════');
    console.log('  DRY RUN — no DB writes');
    console.log('═══════════════════════════════════════');
  }

  for (const adm of ADMISSIONS) {
    await processStudent(tenant, adm, admin, execute);
  }

  console.log(execute ? '\n✅ Applied.' : '\n→ Re-run with --execute to apply.');
  await mongoose.disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
