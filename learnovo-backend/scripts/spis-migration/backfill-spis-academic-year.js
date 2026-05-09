#!/usr/bin/env node
/**
 * Backfill `academicYear` on SPIS students who were imported without it.
 *
 * Sets academicYear = name of the active AcademicSession for the SPIS tenant on
 * any student (role: 'student') with a missing/empty academicYear field.
 *
 * Usage:
 *   node backfill-spis-academic-year.js              # dry-run
 *   node backfill-spis-academic-year.js --execute    # actually update
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') });

const Tenant = require('../../models/Tenant');
const AcademicSession = require('../../models/AcademicSession');
const User = require('../../models/User');

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');

(async() => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: /spis/i }).lean();
  if (!tenant) {
    console.error('SPIS tenant not found'); process.exit(1);
  }
  console.log(`✓ Tenant: ${tenant.schoolName} (${tenant.schoolCode})`);

  const activeSession = await AcademicSession.findOne({
    tenantId: tenant._id,
    isActive: true
  }).lean();
  if (!activeSession) {
    console.error('No active AcademicSession for tenant'); process.exit(1);
  }
  console.log(`✓ Active session: ${activeSession.name}\n`);

  const filter = {
    tenantId: tenant._id,
    role: 'student',
    $or: [
      { academicYear: { $exists: false } },
      { academicYear: null },
      { academicYear: '' }
    ]
  };

  const count = await User.countDocuments(filter);
  console.log(`Students missing academicYear: ${count}`);

  if (count === 0) {
    await mongoose.disconnect(); return;
  }

  if (!EXECUTE) {
    const sample = await User.find(filter).select('admissionNumber name class section').limit(5).lean();
    console.log('\nSample (first 5):');
    sample.forEach(s => console.log(`  ${s.admissionNumber || '-'}  ${s.name}  ${s.class}-${s.section}`));
    console.log(`\nDry-run only. Re-run with --execute to set academicYear="${activeSession.name}" on ${count} students.`);
    await mongoose.disconnect();
    return;
  }

  const result = await User.updateMany(filter, { $set: { academicYear: activeSession.name } });
  console.log(`✓ Updated ${result.modifiedCount} students.`);

  await mongoose.disconnect();
})().catch(err => {
  console.error(err); process.exit(1);
});
