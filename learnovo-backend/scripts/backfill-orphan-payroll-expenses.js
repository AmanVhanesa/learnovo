/**
 * Backfill: soft-delete payroll-synced Expense records whose source Payroll
 * is deleted or missing. One-time cleanup for expenses orphaned before the
 * payroll-delete → expense-reverse hook was added.
 *
 * Usage:
 *   node scripts/backfill-orphan-payroll-expenses.js              # dry run
 *   node scripts/backfill-orphan-payroll-expenses.js --apply      # apply
 *   node scripts/backfill-orphan-payroll-expenses.js --apply --tenant=<tenantId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Payroll = require('../models/Payroll');

async function run() {
  const apply = process.argv.includes('--apply');
  const tenantArg = process.argv.find(a => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : null;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);
  console.log('Connected. Mode:', apply ? 'APPLY' : 'DRY RUN', tenantId ? `(tenant=${tenantId})` : '(all tenants)');

  const filter = {
    isDeleted: false,
    isSystemGenerated: true,
    referenceType: 'payroll',
    referenceId: { $ne: null }
  };
  if (tenantId) filter.tenantId = new mongoose.Types.ObjectId(tenantId);

  const candidates = await Expense.find(filter).select('_id tenantId referenceId title amount').lean();
  console.log(`Found ${candidates.length} payroll-synced expense candidates.`);

  const orphanIds = [];
  for (const exp of candidates) {
    const active = await Payroll.findOne({
      _id: exp.referenceId,
      tenantId: exp.tenantId,
      isDeleted: { $ne: true }
    }).select('_id').lean();
    if (!active) {
      orphanIds.push(exp._id);
      console.log(`  ORPHAN: ${exp._id}  ${exp.title}  ₹${exp.amount}`);
    }
  }

  console.log(`\nOrphans: ${orphanIds.length}`);
  if (apply && orphanIds.length) {
    const result = await Expense.updateMany(
      { _id: { $in: orphanIds } },
      { isDeleted: true }
    );
    console.log(`Soft-deleted ${result.modifiedCount} expense(s).`);
  } else if (!apply) {
    console.log('Dry run — no changes. Re-run with --apply to soft-delete these.');
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
