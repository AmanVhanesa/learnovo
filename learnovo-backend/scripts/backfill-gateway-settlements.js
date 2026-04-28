#!/usr/bin/env node

/**
 * Backfill: Repair gateway-settled PaymentAttempts that were settled
 * before the full-settlement fix shipped.
 *
 * Symptoms this fixes:
 *   - PaymentAttempt.status = SUCCESS but the linked Receipt has
 *     amount = 0 (or missing paymentMode / paymentDate / transactionRefId).
 *   - FeeInvoice.status = Paid but no Income row exists, so admin
 *     "Total Collection" undercounts.
 *   - PaymentAttempt.status = SUCCESS but no Receipt at all.
 *
 * What it does (per attempt, idempotent):
 *   1. Ensures a Receipt exists for the attempt, with full detail copied
 *      from the attempt (amount, paymentMode=ONLINE, paymentDate,
 *      transactionRefId=gatewayRefId).
 *   2. Calls syncFeePaymentToIncome — that helper is itself idempotent
 *      via referenceId, so re-running is safe.
 *   3. Recomputes StudentBalance for the student/session.
 *
 * Usage:
 *   node scripts/backfill-gateway-settlements.js
 *
 * Options:
 *   --dry-run        Print what would change without writing
 *   --tenant=<id>    Restrict to a single tenant
 *   --attempt=<id>   Restrict to a single PaymentAttempt
 */

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const PaymentAttempt = require('../models/PaymentAttempt');
const Receipt = require('../models/Receipt');
const FeeInvoice = require('../models/FeeInvoice');
const StudentBalance = require('../models/StudentBalance');
const User = require('../models/User');
const { syncFeePaymentToIncome } = require('../services/financeAutoSyncService');
const { toNumber } = require('../utils/money');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const tenantArg = args.find(a => a.startsWith('--tenant='));
const attemptArg = args.find(a => a.startsWith('--attempt='));
const TENANT_ID = tenantArg ? tenantArg.split('=')[1] : null;
const ATTEMPT_ID = attemptArg ? attemptArg.split('=')[1] : null;

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI / MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`[backfill] connected ${DRY_RUN ? '(DRY RUN)' : ''}`);

  const filter = { status: { $in: ['SUCCESS', 'VERIFIED'] } };
  if (TENANT_ID) filter.tenantId = new mongoose.Types.ObjectId(TENANT_ID);
  if (ATTEMPT_ID) filter._id = new mongoose.Types.ObjectId(ATTEMPT_ID);

  const attempts = await PaymentAttempt.find(filter).lean();
  console.log(`[backfill] ${attempts.length} candidate attempts`);

  let created = 0;
  let repaired = 0;
  let synced = 0;
  let skipped = 0;
  const failures = [];

  for (const attempt of attempts) {
    try {
      const invoiceIds = (attempt.invoiceIds && attempt.invoiceIds.length)
        ? attempt.invoiceIds
        : (attempt.invoiceId ? [attempt.invoiceId] : []);

      if (invoiceIds.length === 0) {
        skipped++;
        continue;
      }

      const invoices = await FeeInvoice.find({
        _id: { $in: invoiceIds },
        tenantId: attempt.tenantId
      });

      if (invoices.length === 0) {
        skipped++;
        continue;
      }

      const totalAmount = toNumber(attempt.amount);
      const studentDoc = await User.findById(attempt.studentId).select('name fullName').lean();
      const studentName = studentDoc?.fullName || studentDoc?.name || 'Student';

      // Distribute amount across invoices using paid-vs-total deltas as the share.
      let remaining = totalAmount;
      for (const invoice of invoices) {
        if (remaining <= 0) break;

        let receipt = await Receipt.findOne({
          paymentAttemptId: attempt._id,
          invoiceId: invoice._id,
          tenantId: attempt.tenantId
        });

        const expectedShare = invoices.length === 1
          ? remaining
          : Math.min(remaining, toNumber(invoice.totalAmount));

        if (!receipt) {
          if (DRY_RUN) {
            console.log(`[backfill] would CREATE receipt for attempt ${attempt._id} invoice ${invoice._id} amount ${expectedShare}`);
          } else {
            const receiptNum = await Receipt.generateReceiptNumber(attempt.tenantId);
            receipt = await Receipt.create({
              tenantId: attempt.tenantId,
              paymentAttemptId: attempt._id,
              studentId: attempt.studentId,
              invoiceId: invoice._id,
              receiptNumber: receiptNum,
              amount: expectedShare,
              paymentMode: 'ONLINE',
              paymentDate: attempt.updatedAt || attempt.createdAt || new Date(),
              transactionRefId: attempt.gatewayRefId || null,
              initiatedBy: 'student'
            });
          }
          created++;
        } else if (!receipt.amount || receipt.amount <= 0 || !receipt.paymentMode) {
          if (DRY_RUN) {
            console.log(`[backfill] would REPAIR receipt ${receipt._id} (amount ${receipt.amount} -> ${expectedShare})`);
          } else {
            receipt.amount = receipt.amount && receipt.amount > 0 ? receipt.amount : expectedShare;
            receipt.paymentMode = receipt.paymentMode || 'ONLINE';
            receipt.paymentDate = receipt.paymentDate || attempt.updatedAt || attempt.createdAt || new Date();
            receipt.transactionRefId = receipt.transactionRefId || attempt.gatewayRefId || null;
            receipt.initiatedBy = receipt.initiatedBy || 'student';
            await receipt.save();
          }
          repaired++;
        }

        const incomeAmount = receipt && receipt.amount > 0 ? toNumber(receipt.amount) : expectedShare;

        if (!DRY_RUN) {
          try {
            await syncFeePaymentToIncome({
              tenantId: attempt.tenantId,
              paymentId: receipt?._id || attempt._id,
              amount: incomeAmount,
              paymentDate: receipt?.paymentDate || attempt.updatedAt || attempt.createdAt || new Date(),
              paymentMethod: 'Online',
              studentName,
              invoiceNumber: invoice.invoiceNumber,
              addedBy: null,
              paymentReference: attempt.gatewayRefId || null,
              referenceModel: 'PaymentAttempt',
              academicSessionId: invoice.academicSessionId
            });
            synced++;
          } catch (syncErr) {
            console.error(`[backfill] income sync failed for attempt ${attempt._id} invoice ${invoice._id}:`, syncErr.message);
          }
        } else {
          console.log(`[backfill] would SYNC income for attempt ${attempt._id} invoice ${invoice._id} amount ${incomeAmount}`);
        }

        remaining -= expectedShare;
      }

      if (!DRY_RUN) {
        const sessionIds = new Set();
        for (const invoice of invoices) {
          const key = String(invoice.academicSessionId || '');
          if (sessionIds.has(key)) continue;
          sessionIds.add(key);
          try {
            await StudentBalance.updateBalance(attempt.tenantId, attempt.studentId, invoice.academicSessionId);
          } catch (balErr) {
            console.error(`[backfill] balance recalc failed for student ${attempt.studentId}:`, balErr.message);
          }
        }
      }
    } catch (err) {
      failures.push({ attemptId: String(attempt._id), error: err.message });
      console.error(`[backfill] attempt ${attempt._id} failed:`, err.message);
    }
  }

  console.log('\n[backfill] summary');
  console.log(`  candidates    : ${attempts.length}`);
  console.log(`  receipts created  : ${created}`);
  console.log(`  receipts repaired : ${repaired}`);
  console.log(`  income syncs run  : ${synced}`);
  console.log(`  skipped           : ${skipped}`);
  console.log(`  failures          : ${failures.length}`);
  if (failures.length) console.log(JSON.stringify(failures, null, 2));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[backfill] fatal', err);
  process.exit(1);
});
