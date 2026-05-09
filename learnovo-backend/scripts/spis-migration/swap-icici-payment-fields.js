#!/usr/bin/env node
/**
 * One-time field-semantic migration for ICICI Orange Payment records.
 *
 * Before this change:
 *   transactionDetails.transactionId  = String(PaymentAttempt._id)  ← internal ID, used for dedup
 *   transactionDetails.referenceNumber = ICICI bankRef (UTR/txnID)   ← bank's actual ID
 *   (no top-level paymentAttemptId)
 *
 * After this change (matches the Razorpay convention):
 *   transactionDetails.transactionId  = ICICI bankRef (UTR/txnID)    ← bank's actual ID
 *   transactionDetails.referenceNumber = attempt.gatewayRefId         ← merchant txn ref we sent to bank
 *   paymentAttemptId (top-level)       = attempt._id ObjectId         ← used for dedup going forward
 *
 * Idempotent — safe to re-run. Only touches Payment rows that look like
 * the legacy ICICI shape (transactionId is a 24-char hex matching a real
 * PaymentAttempt._id, and paymentAttemptId is not yet set).
 *
 * Usage:
 *   # Dry-run (default) — prints what would change, writes nothing:
 *   node swap-icici-payment-fields.js
 *
 *   # Apply:
 *   node swap-icici-payment-fields.js --execute
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') });

const Tenant = require('../../models/Tenant');
const Payment = require('../../models/Payment');
const PaymentAttempt = require('../../models/PaymentAttempt');

function parseArgs() {
  const args = process.argv.slice(2);
  return { execute: args.includes('--execute') };
}

const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

(async() => {
  const { execute } = parseArgs();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: /spis/i }).lean();
  if (!tenant) {
    console.error('SPIS tenant not found'); process.exit(1);
  }
  console.log(`✓ Tenant: ${tenant.schoolName} (${tenant.schoolCode})`);

  if (!execute) {
    console.log('═══════════════════════════════════════');
    console.log('  DRY RUN — no DB writes');
    console.log('═══════════════════════════════════════');
  }

  // Candidates: SPIS Payments where transactionDetails.transactionId looks
  // like an ObjectId AND paymentAttemptId is not yet set.
  const candidates = await Payment.find({
    tenantId: tenant._id,
    paymentMethod: 'Online',
    paymentAttemptId: { $exists: false },
    'transactionDetails.transactionId': { $regex: OBJECT_ID_RE }
  }).select('_id receiptNumber transactionDetails remarks paymentAttemptId').lean();

  console.log(`\n✓ Found ${candidates.length} legacy ICICI Payment row(s) to migrate\n`);

  const summary = { total: candidates.length, migrated: 0, skippedNoAttempt: 0, skippedShape: 0 };
  const samples = [];
  const SAMPLE_LIMIT = 15;

  for (const p of candidates) {
    const oldTxnId = p.transactionDetails?.transactionId;
    const oldRefNum = p.transactionDetails?.referenceNumber || null;

    if (!oldTxnId || !OBJECT_ID_RE.test(oldTxnId)) {
      summary.skippedShape++; continue;
    }

    // Verify the attempt actually exists in this tenant.
    const attempt = await PaymentAttempt.findOne({
      _id: oldTxnId,
      tenantId: tenant._id
    }).select('_id gatewayRefId').lean();

    if (!attempt) {
      summary.skippedNoAttempt++; continue;
    }

    const newTxnId = oldRefNum;                       // bank's UTR/txnID
    const newRefNum = attempt.gatewayRefId || null;   // merchant txn ref

    if (samples.length < SAMPLE_LIMIT) {
      samples.push({
        receiptNumber: p.receiptNumber,
        from: { transactionId: oldTxnId, referenceNumber: oldRefNum, paymentAttemptId: null },
        to: { transactionId: newTxnId, referenceNumber: newRefNum, paymentAttemptId: String(attempt._id) }
      });
    }

    if (execute) {
      await Payment.updateOne(
        { _id: p._id },
        {
          $set: {
            paymentAttemptId: attempt._id,
            'transactionDetails.transactionId': newTxnId,
            'transactionDetails.referenceNumber': newRefNum
          }
        }
      );
    }
    summary.migrated++;
  }

  console.log('=== Sample migrations (first 15) ===');
  for (const s of samples) {
    console.log(`  ${s.receiptNumber}:`);
    console.log(`    transactionId   ${s.from.transactionId} → ${s.to.transactionId}`);
    console.log(`    referenceNumber ${s.from.referenceNumber} → ${s.to.referenceNumber}`);
    console.log(`    paymentAttemptId (new) ${s.to.paymentAttemptId}`);
  }

  console.log('\n=== Summary ===');
  console.log(`  Total candidates scanned:                ${summary.total}`);
  console.log(`  Migrated:                                ${summary.migrated}`);
  console.log(`  Skipped (PaymentAttempt not found):      ${summary.skippedNoAttempt}`);
  console.log(`  Skipped (transactionId not ObjectId):    ${summary.skippedShape}`);

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
