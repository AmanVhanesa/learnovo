/**
 * Clear all fee-related data for SPIS tenant.
 *
 * Deletes: FeeInvoices, Payments, Receipts, AnnualFeeAllocations,
 *          StudentBalances, PaymentAttempts, FeeAuditLogs,
 *          and auto-synced Income records (from fee payments).
 *
 * Does NOT delete: Students, FeeStructures, AcademicSessions, Expenses.
 *
 * SPIS PRODUCTION ONLY — hardcoded to schoolCode: 'spis'.
 *
 * Usage:
 *   node scripts/clear-spis-fee-data.js --dry-run
 *   node scripts/clear-spis-fee-data.js
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const Receipt = require('../models/Receipt');
const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
const StudentBalance = require('../models/StudentBalance');
const PaymentAttempt = require('../models/PaymentAttempt');
const FeeAuditLog = require('../models/FeeAuditLog');
const Income = require('../models/Income');

const SCHOOL_CODE = 'spis';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: SCHOOL_CODE });
  if (!tenant) {
    console.error(`FATAL: Tenant "${SCHOOL_CODE}" not found.`);
    process.exit(1);
  }
  const tenantId = tenant._id;
  console.log(`Tenant: ${tenant.schoolName} (${tenant.schoolCode})\n`);

  const filter = { tenantId };

  // Count what will be deleted
  const counts = {
    invoices: await FeeInvoice.countDocuments(filter),
    payments: await Payment.countDocuments(filter),
    receipts: await Receipt.countDocuments(filter),
    allocations: await AnnualFeeAllocation.countDocuments(filter),
    balances: await StudentBalance.countDocuments(filter),
    attempts: await PaymentAttempt.countDocuments(filter),
    auditLogs: await FeeAuditLog.countDocuments(filter),
    income: await Income.countDocuments({ ...filter, source: 'fee_payment' })
  };

  console.log('Records to delete:');
  console.log(`  Fee Invoices:          ${counts.invoices}`);
  console.log(`  Payments:              ${counts.payments}`);
  console.log(`  Receipts:              ${counts.receipts}`);
  console.log(`  Annual Allocations:    ${counts.allocations}`);
  console.log(`  Student Balances:      ${counts.balances}`);
  console.log(`  Payment Attempts:      ${counts.attempts}`);
  console.log(`  Fee Audit Logs:        ${counts.auditLogs}`);
  console.log(`  Income (fee_payment):  ${counts.income}`);

  if (dryRun) {
    console.log('\n⚠ DRY RUN — nothing deleted.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('\nDeleting...');

  const results = await Promise.all([
    FeeInvoice.deleteMany(filter),
    Payment.deleteMany(filter),
    Receipt.deleteMany(filter),
    AnnualFeeAllocation.deleteMany(filter),
    StudentBalance.deleteMany(filter),
    PaymentAttempt.deleteMany(filter),
    FeeAuditLog.deleteMany(filter),
    Income.deleteMany({ ...filter, source: 'fee_payment' })
  ]);

  const labels = ['Invoices', 'Payments', 'Receipts', 'Allocations', 'Balances', 'Attempts', 'AuditLogs', 'Income'];
  results.forEach((r, i) => {
    console.log(`  ${labels[i]} deleted: ${r.deletedCount}`);
  });

  console.log('\nDone. Fee data cleared for SPIS.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
