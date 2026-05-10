#!/usr/bin/env node
/**
 * One-off correction for SPIS student admission #6375 (NEHA).
 *
 * What happened:
 *   A receipt was created on 2026-05-10 for the full Q1 amount of ₹5,500
 *   (Tuition ₹4,500 + Admission ₹1,000) without cash actually changing
 *   hands. The student should have been classified under the
 *   "Financially weak — ₹3,300 tuition/quarter" category and granted a
 *   ₹1,000 admission-fee discount on Q1.
 *
 * What this script does (idempotent):
 *   1. Reverses payment RCP-2026-01056 with a clear reason. This
 *      restores Q1 paidAmount to zero, removes the auto-synced Income
 *      record, and creates a negative reversal Payment row + audit log.
 *   2. Applies a ₹1,200 tuition-concession discount on each of the four
 *      quarterly invoices (Q1, Q2, Q3, Q4) via invoice.discountAmount —
 *      same convention the SPIS migration importer uses.
 *   3. Applies an additional ₹1,000 admission-fee discount on the Q1
 *      invoice (so Q1 net = ₹3,300 instead of ₹4,300).
 *   4. Updates AnnualFeeAllocation.totalDiscount and balance.
 *   5. Recalculates StudentBalance.
 *
 * Re-running is a no-op:
 *   - Reverse step skipped if payment.isReversed already true.
 *   - Discount step skipped if invoice.discountAmount already matches
 *     the target.
 *
 * Usage:
 *   # Dry-run (default):
 *   node fix-6375-neha.js
 *
 *   # Apply:
 *   node fix-6375-neha.js --execute
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') });

const Tenant = require('../../models/Tenant');
const User = require('../../models/User');
const FeeInvoice = require('../../models/FeeInvoice');
const Payment = require('../../models/Payment');
const AnnualFeeAllocation = require('../../models/AnnualFeeAllocation');
const StudentBalance = require('../../models/StudentBalance');
const FeeAuditLog = require('../../models/FeeAuditLog');
const { roundToRupee, toNumber } = require('../../utils/money');

const ADMISSION_NUMBER = '6375';
const RECEIPT_NUMBER = 'RCP-2026-01056';
const TUITION_CONCESSION_PER_QUARTER = 1200;     // "Financially weak" pattern
const ADMISSION_FEE_DISCOUNT_Q1 = 1000;
const REVERSE_REASON =
  'Receipt created in error — no cash collected. Student moved to ₹3,300/quarter (financially weak) category with ₹1,000 admission-fee discount on Q1.';

function parseArgs() {
  return { execute: process.argv.slice(2).includes('--execute') };
}

(async() => {
  const { execute } = parseArgs();
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: /spis/i }).lean();
  if (!tenant) { console.error('SPIS tenant not found'); process.exit(1); }
  const tenantId = tenant._id;

  const student = await User.findOne({
    tenantId,
    role: 'student',
    admissionNumber: ADMISSION_NUMBER
  }).select('_id name fullName admissionNumber').lean();
  if (!student) { console.error(`Student ${ADMISSION_NUMBER} not found`); process.exit(1); }
  console.log(`✓ Student: ${student.name || student.fullName} (#${student.admissionNumber})`);

  // Use any active SPIS admin for confirmedBy / userId fields.
  const admin = await User.findOne({
    tenantId, role: 'admin', isActive: true
  }).select('_id name fullName role').lean();
  if (!admin) { console.error('No active admin user found in SPIS'); process.exit(1); }

  if (!execute) {
    console.log('═══════════════════════════════════════');
    console.log('  DRY RUN — no DB writes');
    console.log('═══════════════════════════════════════\n');
  }

  // ── 1. Reverse the receipt ─────────────────────────────────────────
  const payment = await Payment.findOne({
    tenantId, receiptNumber: RECEIPT_NUMBER, studentId: student._id
  });
  if (!payment) {
    console.error(`✗ Payment ${RECEIPT_NUMBER} not found for this student`);
    process.exit(1);
  }

  const originalAmount = toNumber(payment.amount);
  const reversedAlready = payment.isReversed === true;

  console.log(`STEP 1 — Reverse payment ${RECEIPT_NUMBER} (₹${originalAmount}, ${payment.paymentMethod})`);
  if (reversedAlready) {
    console.log('  ⏭️  Already reversed — skipping.');
  } else if (execute) {
    await payment.reverse(admin._id, REVERSE_REASON);
    // Decrement the invoice paidAmount (the reverse() method itself does
    // not touch the invoice; the route handler does this part).
    const inv = await FeeInvoice.findOne({ _id: payment.invoiceId, tenantId });
    if (inv) {
      inv.paidAmount = roundToRupee(Math.max(0, toNumber(inv.paidAmount) - originalAmount));
      await inv.save();
    }
    try {
      await FeeAuditLog.logAction({
        tenantId, action: 'PAYMENT_REVERSED', entityType: 'Payment', entityId: payment._id,
        userId: admin._id, userName: admin.name || admin.fullName || 'Admin', userRole: admin.role,
        details: { receiptNumber: payment.receiptNumber, amount: originalAmount, reason: REVERSE_REASON },
        ipAddress: 'cli/fix-6375-neha.js'
      });
    } catch (_) { /* non-fatal */ }
    console.log(`  ✓ Reversed. Invoice paidAmount decremented by ₹${originalAmount}.`);
  } else {
    console.log(`  → Would reverse ₹${originalAmount} and decrement invoice paid by the same.`);
  }

  // ── 2 & 3. Apply concessions and discount on each quarter ──────────
  const invoices = await FeeInvoice.find({
    tenantId, studentId: student._id
  }).sort({ periodStart: 1 });

  if (invoices.length !== 4) {
    console.error(`✗ Expected 4 quarterly invoices, found ${invoices.length}. Aborting.`);
    process.exit(1);
  }

  console.log('\nSTEP 2 — Apply concessions per quarter');
  let totalDiscountDelta = 0;

  for (const inv of invoices) {
    const qtr = inv.billingPeriod && inv.billingPeriod.quarter;
    const targetDiscount = qtr === 1
      ? TUITION_CONCESSION_PER_QUARTER + ADMISSION_FEE_DISCOUNT_Q1
      : TUITION_CONCESSION_PER_QUARTER;
    const currentDiscount = toNumber(inv.discountAmount);
    const delta = roundToRupee(targetDiscount - currentDiscount);

    const totalAmt = toNumber(inv.totalAmount) + toNumber(inv.lateFeeApplied || 0);
    const newPaid = toNumber(inv.paidAmount); // Step 1 already adjusted this
    const newDiscount = roundToRupee(currentDiscount + delta);
    const newBalance = Math.max(0, roundToRupee(totalAmt - newPaid - newDiscount));
    const status = newBalance <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Pending');

    console.log(`  Q${qtr} ${inv.invoiceNumber}: ` +
      `total=${totalAmt} paid=${newPaid} ` +
      `discount=${currentDiscount} → ${newDiscount} (Δ${delta >= 0 ? '+' : ''}${delta}) ` +
      `balance=${newBalance} status=${status}`);

    if (delta === 0) continue;
    totalDiscountDelta = roundToRupee(totalDiscountDelta + delta);

    if (execute) {
      await FeeInvoice.updateOne(
        { _id: inv._id, tenantId },
        { $set: { discountAmount: newDiscount, balanceAmount: newBalance, status } }
      );
      try {
        await FeeAuditLog.logAction({
          tenantId, action: 'DISCOUNT_APPLIED', entityType: 'FeeInvoice', entityId: inv._id,
          userId: admin._id, userName: admin.name || admin.fullName || 'Admin', userRole: admin.role,
          details: {
            invoiceNumber: inv.invoiceNumber, quarter: qtr,
            previousDiscount: currentDiscount,
            newDiscount,
            reason: qtr === 1
              ? `₹${TUITION_CONCESSION_PER_QUARTER} financially-weak tuition concession + ₹${ADMISSION_FEE_DISCOUNT_Q1} admission-fee discount`
              : `₹${TUITION_CONCESSION_PER_QUARTER} financially-weak tuition concession`
          },
          ipAddress: 'cli/fix-6375-neha.js'
        });
      } catch (_) { /* non-fatal */ }
    }
  }

  // ── 4. Update AnnualFeeAllocation totals ────────────────────────────
  console.log('\nSTEP 3 — Update AnnualFeeAllocation totals');
  const alloc = await AnnualFeeAllocation.findOne({
    tenantId, studentId: student._id
  });
  if (!alloc) {
    console.error('✗ Allocation not found.');
    process.exit(1);
  }

  // The reversal lowered totalPaid by originalAmount (only on first run).
  const paidDelta = reversedAlready ? 0 : -originalAmount;

  const newTotalDiscount = roundToRupee(toNumber(alloc.totalDiscount) + totalDiscountDelta);
  const newTotalPaid = roundToRupee(toNumber(alloc.totalPaid) + paidDelta);
  const newBalance = roundToRupee(
    toNumber(alloc.totalAnnualAmount) - newTotalPaid - newTotalDiscount - toNumber(alloc.totalWaived || 0)
  );
  console.log(`  totalPaid     ${alloc.totalPaid} → ${newTotalPaid} (Δ${paidDelta >= 0 ? '+' : ''}${paidDelta})`);
  console.log(`  totalDiscount ${alloc.totalDiscount} → ${newTotalDiscount} (Δ+${totalDiscountDelta})`);
  console.log(`  balance       ${alloc.balance} → ${newBalance}`);

  if (execute && (paidDelta !== 0 || totalDiscountDelta !== 0)) {
    await AnnualFeeAllocation.updateOne(
      { _id: alloc._id },
      { $set: { totalPaid: newTotalPaid, totalDiscount: newTotalDiscount, balance: newBalance } }
    );
  }

  // ── 5. Recalculate StudentBalance ───────────────────────────────────
  if (execute) {
    try {
      const sessionId = invoices[0].academicSessionId;
      await StudentBalance.updateBalance(tenantId, student._id, sessionId);
      console.log('\n✓ StudentBalance recalculated.');
    } catch (e) {
      console.warn('⚠ StudentBalance recalc failed (non-fatal):', e.message);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`  Receipt reversed:    ${reversedAlready ? 'already' : (execute ? 'YES' : 'would')}`);
  console.log(`  Tuition concession:  ₹${TUITION_CONCESSION_PER_QUARTER} × 4 = ₹${TUITION_CONCESSION_PER_QUARTER * 4}`);
  console.log(`  Admission discount:  ₹${ADMISSION_FEE_DISCOUNT_Q1} (Q1 only)`);
  console.log(`  New annual balance:  ₹${newBalance}`);

  if (!execute) {
    console.log('\n  → Re-run with --execute to apply.');
  } else {
    console.log('\n  ✅ Applied.');
  }

  await mongoose.disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
