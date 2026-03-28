#!/usr/bin/env node

/**
 * One-time Migration: Finance Auto-Sync Backfill
 *
 * Finds all historically confirmed fee payments and paid payrolls that
 * do not yet have corresponding Income/Expense records, and creates them.
 *
 * Usage:
 *   node scripts/migrate-finance-sync.js
 *
 * Options:
 *   --dry-run    Print what would be created without actually creating records
 *   --tenant=ID  Only migrate a specific tenant
 *
 * Requires MONGODB_URI in config.env or environment.
 */

const path = require('path');
const mongoose = require('mongoose');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const Payment = require('../models/Payment');
const Payroll = require('../models/Payroll');
const Income = require('../models/Income');
const Expense = require('../models/Expense');
const User = require('../models/User');
const FeeInvoice = require('../models/FeeInvoice');
const {
  syncFeePaymentToIncome,
  syncPayrollToExpense
} = require('../services/financeAutoSyncService');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const tenantArg = args.find(a => a.startsWith('--tenant='));
const TENANT_FILTER = tenantArg ? tenantArg.split('=')[1] : null;

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI not set. Add it to config.env or environment.');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  Finance Auto-Sync Migration');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no records will be created)' : 'LIVE'}`);
  if (TENANT_FILTER) console.log(`  Tenant filter: ${TENANT_FILTER}`);
  console.log('═══════════════════════════════════════════════════\n');

  await mongoose.connect(uri);
  console.log('Connected to MongoDB.\n');

  let incomeCreated = 0;
  let incomeSkipped = 0;
  let incomeErrors = 0;
  let expenseCreated = 0;
  let expenseSkipped = 0;
  let expenseErrors = 0;

  // ── PART 1: Backfill Income from confirmed fee Payments ──────────
  console.log('── Part 1: Fee Payments → Income ──────────────────\n');

  const paymentFilter = { isConfirmed: true, isReversed: { $ne: true } };
  if (TENANT_FILTER) paymentFilter.tenantId = new mongoose.Types.ObjectId(TENANT_FILTER);

  const paymentCount = await Payment.countDocuments(paymentFilter);
  console.log(`Found ${paymentCount} confirmed payments to check.\n`);

  // Process in batches of 100
  const BATCH_SIZE = 100;
  let skip = 0;

  while (skip < paymentCount) {
    const payments = await Payment.find(paymentFilter)
      .sort({ _id: 1 })
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    for (const payment of payments) {
      // Check if income already exists
      const existing = await Income.findOne({
        tenantId: payment.tenantId,
        referenceType: 'fee_payment',
        referenceId: payment._id,
        isDeleted: false
      }).lean();

      if (existing) {
        incomeSkipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] Would create income for Payment ${payment._id} (₹${payment.amount})`);
        incomeCreated++;
        continue;
      }

      try {
        const student = await User.findById(payment.studentId).select('name fullName').lean();
        const invoice = await FeeInvoice.findById(payment.invoiceId).select('invoiceNumber').lean();

        await syncFeePaymentToIncome({
          tenantId: payment.tenantId,
          paymentId: payment._id,
          amount: payment.amount,
          paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod,
          studentName: student?.fullName || student?.name || 'Student',
          invoiceNumber: invoice?.invoiceNumber || 'N/A',
          addedBy: payment.collectedBy || payment.confirmedBy,
          paymentReference: payment.transactionDetails?.referenceNumber || payment.receiptNumber
        });
        incomeCreated++;
      } catch (err) {
        console.error(`  ERROR creating income for Payment ${payment._id}:`, err.message);
        incomeErrors++;
      }
    }

    skip += BATCH_SIZE;
    if (skip < paymentCount) {
      process.stdout.write(`  Processed ${Math.min(skip, paymentCount)}/${paymentCount} payments...\r`);
    }
  }

  console.log(`\n  Results: ${incomeCreated} created, ${incomeSkipped} skipped (already exist), ${incomeErrors} errors\n`);

  // ── PART 2: Backfill Expense from paid Payrolls ──────────────────
  console.log('── Part 2: Payroll → Expense ──────────────────────\n');

  const payrollFilter = { paymentStatus: 'paid', isDeleted: { $ne: true } };
  if (TENANT_FILTER) payrollFilter.tenantId = new mongoose.Types.ObjectId(TENANT_FILTER);

  const payrollCount = await Payroll.countDocuments(payrollFilter);
  console.log(`Found ${payrollCount} paid payroll records to check.\n`);

  skip = 0;

  while (skip < payrollCount) {
    const payrolls = await Payroll.find(payrollFilter)
      .sort({ _id: 1 })
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    for (const payroll of payrolls) {
      // Check if expense already exists
      const existing = await Expense.findOne({
        tenantId: payroll.tenantId,
        referenceType: 'payroll',
        referenceId: payroll._id,
        isDeleted: false
      }).lean();

      if (existing) {
        expenseSkipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] Would create expense for Payroll ${payroll._id} (₹${payroll.netSalary})`);
        expenseCreated++;
        continue;
      }

      try {
        const employee = await User.findById(payroll.employeeId).select('name fullName').lean();

        await syncPayrollToExpense({
          tenantId: payroll.tenantId,
          payrollId: payroll._id,
          netSalary: payroll.netSalary,
          paymentDate: payroll.paymentDate || payroll.updatedAt,
          paymentMethod: payroll.paymentMethod,
          month: payroll.month,
          year: payroll.year,
          employeeName: employee?.fullName || employee?.name || 'Employee',
          addedBy: payroll.generatedBy,
          paymentReference: payroll.paymentReference
        });
        expenseCreated++;
      } catch (err) {
        console.error(`  ERROR creating expense for Payroll ${payroll._id}:`, err.message);
        expenseErrors++;
      }
    }

    skip += BATCH_SIZE;
    if (skip < payrollCount) {
      process.stdout.write(`  Processed ${Math.min(skip, payrollCount)}/${payrollCount} payrolls...\r`);
    }
  }

  console.log(`\n  Results: ${expenseCreated} created, ${expenseSkipped} skipped (already exist), ${expenseErrors} errors\n`);

  // ── PART 3: Backfill isSystemGenerated on existing auto-synced records ──
  console.log('── Part 3: Set isSystemGenerated on existing records ─\n');

  let incomeUpdated = 0;
  let expenseUpdated = 0;
  let manualIncomeUpdated = 0;
  let manualExpenseUpdated = 0;

  if (!DRY_RUN) {
    // Mark all fee_payment income records as system-generated
    const incResult = await Income.updateMany(
      { referenceType: 'fee_payment', isSystemGenerated: { $ne: true } },
      { $set: { isSystemGenerated: true } }
    );
    incomeUpdated = incResult.modifiedCount;

    // Mark all payroll expense records as system-generated
    const expResult = await Expense.updateMany(
      { referenceType: 'payroll', isSystemGenerated: { $ne: true } },
      { $set: { isSystemGenerated: true } }
    );
    expenseUpdated = expResult.modifiedCount;

    // Ensure manual records have isSystemGenerated: false explicitly
    const manIncResult = await Income.updateMany(
      { referenceType: 'manual', isSystemGenerated: { $exists: false } },
      { $set: { isSystemGenerated: false } }
    );
    manualIncomeUpdated = manIncResult.modifiedCount;

    const manExpResult = await Expense.updateMany(
      { referenceType: 'manual', isSystemGenerated: { $exists: false } },
      { $set: { isSystemGenerated: false } }
    );
    manualExpenseUpdated = manExpResult.modifiedCount;
  }

  console.log(`  Updated ${incomeUpdated} income records with isSystemGenerated=true`);
  console.log(`  Updated ${expenseUpdated} expense records with isSystemGenerated=true`);
  console.log(`  Updated ${manualIncomeUpdated} manual income records with isSystemGenerated=false`);
  console.log(`  Updated ${manualExpenseUpdated} manual expense records with isSystemGenerated=false\n`);

  // ── Summary ──────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════════');
  console.log('  MIGRATION SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  Income records:  ${incomeCreated} created, ${incomeSkipped} skipped, ${incomeErrors} errors`);
  console.log(`  Expense records: ${expenseCreated} created, ${expenseSkipped} skipped, ${expenseErrors} errors`);
  console.log(`  isSystemGenerated: ${incomeUpdated} income + ${expenseUpdated} expense marked as system-generated`);
  console.log(`  Manual backfill:   ${manualIncomeUpdated} income + ${manualExpenseUpdated} expense marked as manual`);
  if (DRY_RUN) console.log('\n  DRY RUN — no records were actually created/updated.');
  console.log('═══════════════════════════════════════════════════\n');

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB. Done.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
