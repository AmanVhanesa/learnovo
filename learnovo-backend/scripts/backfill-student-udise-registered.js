/**
 * Backfill: set `udiseRegistered: false` on existing student (User) documents
 * that predate the field. New schema default is false, but the list endpoint
 * reads with `.lean()` (defaults not applied), so legacy docs return `undefined`.
 *
 * The list filter for "not added" already uses `$ne: true`, so this backfill is
 * NOT required for correctness — it just normalizes the data so every student
 * has an explicit boolean. Safe to run multiple times (idempotent).
 *
 * Usage:
 *   node scripts/backfill-student-udise-registered.js                 # dry run, all tenants
 *   node scripts/backfill-student-udise-registered.js --apply
 *   node scripts/backfill-student-udise-registered.js --apply --tenant=<tenantId>
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
  const apply = process.argv.includes('--apply');
  const tenantArg = process.argv.find(a => a.startsWith('--tenant='));
  const tenantId = tenantArg ? tenantArg.split('=')[1] : null;

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI / MONGODB_URI not set in config.env');

  await mongoose.connect(uri);
  console.log(`Connected. Mode: ${apply ? 'APPLY' : 'DRY RUN'}${tenantId ? ` (tenant ${tenantId})` : ' (all tenants)'}`);

  const filter = {
    role: 'student',
    udiseRegistered: { $exists: false }
  };
  if (tenantId) filter.tenantId = tenantId;

  const count = await User.countDocuments(filter);
  console.log(`Students missing udiseRegistered: ${count}`);

  if (count > 0 && apply) {
    const res = await User.updateMany(filter, { $set: { udiseRegistered: false } });
    console.log(`Updated ${res.modifiedCount} student(s).`);
  } else if (count > 0) {
    console.log('Dry run — re-run with --apply to write changes.');
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(async(err) => {
  console.error('Backfill failed:', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
