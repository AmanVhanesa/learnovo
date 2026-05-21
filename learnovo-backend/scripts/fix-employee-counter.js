/**
 * Repair the per-tenant employee counter so it sits past the highest existing
 * employeeId. Safe to re-run — only advances; never moves backwards.
 *
 *   node scripts/repair-employee-counter.js --schoolCode=spis [--year=2026]
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Counter = require('../models/Counter');

function parseArgs(argv) {
  const out = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

(async () => {
  const args = parseArgs(process.argv);
  const schoolCode = (args.schoolCode || 'spis').toLowerCase();
  const year = args.year || String(new Date().getFullYear());

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const tenant = await Tenant.findOne({ schoolCode });
  if (!tenant) throw new Error(`Tenant ${schoolCode} not found`);

  const empRe = new RegExp(`^EMP${year}(\\d+)$`);
  const maxDoc = await User.find(
    { tenantId: tenant._id, employeeId: empRe },
    { employeeId: 1 }
  ).sort({ employeeId: -1 }).limit(1).lean();

  if (!maxDoc.length) {
    console.log(`No EMP${year}* employees in tenant ${schoolCode}. Nothing to do.`);
    await mongoose.disconnect();
    return;
  }

  const maxEmpId = maxDoc[0].employeeId;
  const maxSeq = parseInt(maxEmpId.match(empRe)[1], 10);

  const before = await Counter.findOne({ name: 'employee', year, tenantId: tenant._id }).lean();
  console.log(`Tenant: ${tenant.schoolName} (${schoolCode})`);
  console.log(`Year:   ${year}`);
  console.log(`Highest existing employeeId: ${maxEmpId} (seq ${maxSeq})`);
  console.log(`Counter BEFORE: ${before ? before.sequence : '(no document)'}`);

  const result = await Counter.findOneAndUpdate(
    { name: 'employee', year, tenantId: tenant._id, sequence: { $lt: maxSeq } },
    { $set: { sequence: maxSeq } },
    { new: true, upsert: true }
  );

  console.log(`Counter AFTER:  ${result.sequence}`);
  console.log(`Next generated employeeId will be: EMP${year}${String(result.sequence + 1).padStart(4, '0')}`);

  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
