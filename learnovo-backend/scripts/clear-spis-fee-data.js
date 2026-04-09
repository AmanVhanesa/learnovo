/**
 * Clear all fee-related data AND students for SPIS tenant.
 *
 * Deletes: Students, FeeInvoices, Payments, Receipts, AnnualFeeAllocations,
 *          StudentBalances, PaymentAttempts, FeeAuditLogs,
 *          and auto-synced Income records (from fee payments).
 *
 * Does NOT delete: FeeStructures, AcademicSessions, Classes, Sections,
 *                  Employees, Expenses, Settings.
 *
 * SPIS PRODUCTION ONLY — hardcoded to schoolCode: 'spis'.
 *
 * Usage:
 *   node scripts/clear-spis-fee-data.js --dry-run
 *   node scripts/clear-spis-fee-data.js
 *   node scripts/clear-spis-fee-data.js --keep-students   # Only clear fee data
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const User = require('../models/User');
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
  const keepStudents = process.argv.includes('--keep-students');

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
  const studentFilter = { tenantId, role: 'student' };

  // Count what will be deleted
  const counts = {
    students: keepStudents ? 0 : await User.countDocuments(studentFilter),
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
  if (!keepStudents) {
    console.log(`  Students:              ${counts.students}`);
  } else {
    console.log('  Students:              KEPT (--keep-students)');
  }
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

  const deleteOps = [
    FeeInvoice.deleteMany(filter),
    Payment.deleteMany(filter),
    Receipt.deleteMany(filter),
    AnnualFeeAllocation.deleteMany(filter),
    StudentBalance.deleteMany(filter),
    PaymentAttempt.deleteMany(filter),
    FeeAuditLog.deleteMany(filter),
    Income.deleteMany({ ...filter, source: 'fee_payment' })
  ];
  const labels = ['Invoices', 'Payments', 'Receipts', 'Allocations', 'Balances', 'Attempts', 'AuditLogs', 'Income'];

  if (!keepStudents) {
    deleteOps.unshift(User.deleteMany(studentFilter));
    labels.unshift('Students');
  }

  const results = await Promise.all(deleteOps);

  results.forEach((r, i) => {
    console.log(`  ${labels[i]} deleted: ${r.deletedCount}`);
  });

  console.log('\nDone. Data cleared for SPIS.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
