/**
 * Migration: Add activity-program support to FeeInvoice.
 *
 * 1. Backfills invoiceType='fee' on all existing FeeInvoice rows that lack the field.
 * 2. Drops the two pre-existing unique indexes that did NOT include invoiceType/sourceId,
 *    so an activity invoice can coexist with the regular fee invoice for the same period.
 *
 * The replacement indexes are declared in models/FeeInvoice.js and will be auto-created
 * by mongoose on the next process start (Mongoose `ensureIndexes`).
 *
 * Usage:
 *   node scripts/migrate-feeinvoice-activity-support.js              # dry run
 *   node scripts/migrate-feeinvoice-activity-support.js --apply      # apply changes
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const mongoose = require('mongoose');

const OLD_INDEX_NAMES = [
  'unique_active_invoice_per_student_period',
  'unique_active_invoice_per_student_period_dates'
];

async function run() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI / MONGO_URI is not set in config.env');

  console.log(`\n${apply ? '🚀 APPLYING' : '🔍 DRY RUN'} — FeeInvoice activity-support migration`);
  await mongoose.connect(uri);

  const coll = mongoose.connection.collection('feeinvoices');

  // 1) Backfill invoiceType='fee' on rows lacking it.
  const missingCount = await coll.countDocuments({ invoiceType: { $exists: false } });
  console.log(`\n[1/2] Rows without invoiceType: ${missingCount}`);
  if (apply && missingCount > 0) {
    const r = await coll.updateMany(
      { invoiceType: { $exists: false } },
      { $set: { invoiceType: 'fee' } }
    );
    console.log(`      Backfilled ${r.modifiedCount} rows with invoiceType='fee'`);
  }

  // 2) Drop legacy unique indexes (the new equivalents include invoiceType+sourceId).
  console.log('\n[2/2] Inspecting indexes…');
  const existingIndexes = await coll.indexes();
  for (const idxName of OLD_INDEX_NAMES) {
    const exists = existingIndexes.find(i => i.name === idxName);
    if (!exists) {
      console.log(`      ✓ ${idxName} — already gone`);
      continue;
    }
    if (apply) {
      await coll.dropIndex(idxName);
      console.log(`      ✓ Dropped ${idxName}`);
    } else {
      console.log(`      • Would drop ${idxName}`);
    }
  }

  if (!apply) {
    console.log('\nDry run complete. Re-run with --apply to make changes.');
  } else {
    console.log('\nMigration complete. Restart the API so Mongoose re-creates the new indexes.');
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
