/**
 * SPIS Finance Records Cleanup
 *
 * Wipes ONLY Income and Expense transaction records for the SPIS tenant.
 * These are auto-synced from fee payments / payroll by financeAutoSyncService,
 * and the broader clear-spis-data.js script doesn't touch them — so the
 * Finance Dashboard still shows residue after a fee/payment wipe.
 *
 * Does NOT touch:
 *   - IncomeCategory / ExpenseCategory (config, not transactions)
 *   - ExpenseBudget (planning data, not transactions)
 *   - Fee/payment data (handled by clear-spis-data.js)
 *   - Any other tenant's data
 *
 * Usage on VPS:
 *   cd /var/www/learnovo-backend && node scripts/clear-spis-finance.js
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const Income = require('../models/Income');
const Expense = require('../models/Expense');

async function clearSpisFinance() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const tenant = await Tenant.findOne({ schoolCode: 'spis' });
    if (!tenant) {
      console.error('SPIS tenant not found (schoolCode: "spis"). Aborting.');
      process.exit(1);
    }

    const tenantId = tenant._id;
    console.log(`Found SPIS tenant: ${tenant.schoolName}`);
    console.log(`Tenant ID: ${tenantId}\n`);

    // Pre-deletion counts
    const incomeCount = await Income.countDocuments({ tenantId });
    const expenseCount = await Expense.countDocuments({ tenantId });

    console.log('=== PRE-DELETION COUNTS ===');
    console.log(`  Income records: ${incomeCount}`);
    console.log(`  Expense records: ${expenseCount}\n`);

    if (incomeCount === 0 && expenseCount === 0) {
      console.log('Nothing to delete. Exiting.');
      process.exit(0);
    }

    console.log('Waiting 5 seconds before proceeding... Press Ctrl+C to abort.\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    const incomeResult = await Income.deleteMany({ tenantId });
    console.log(`  Income deleted: ${incomeResult.deletedCount}`);

    const expenseResult = await Expense.deleteMany({ tenantId });
    console.log(`  Expense deleted: ${expenseResult.deletedCount}`);

    // Verify
    const remainingIncome = await Income.countDocuments({ tenantId });
    const remainingExpense = await Expense.countDocuments({ tenantId });
    console.log('\n=== VERIFICATION ===');
    console.log(`  Remaining income: ${remainingIncome} (should be 0)`);
    console.log(`  Remaining expense: ${remainingExpense} (should be 0)`);

    if (remainingIncome === 0 && remainingExpense === 0) {
      console.log('\n  Finance dashboard should now show zero for SPIS.');
    } else {
      console.error('\n  WARNING: Some records survived deletion.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

clearSpisFinance();
