#!/usr/bin/env node
/**
 * Clean up placeholder values on SPIS students that block edits:
 *   - email === ""  → unset (collides on the partial unique index for email)
 *   - rollNumber in ["0", 0, ""] → unset (false-positives on duplicate checks)
 *
 * Usage:
 *   node cleanup-spis-student-placeholders.js              # dry-run
 *   node cleanup-spis-student-placeholders.js --execute    # actually update
 */

const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') });

const Tenant = require('../../models/Tenant');
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
  console.log(`✓ Tenant: ${tenant.schoolName} (${tenant.schoolCode})\n`);

  const emailFilter = { tenantId: tenant._id, role: 'student', email: '' };
  const rollFilter = { tenantId: tenant._id, role: 'student', rollNumber: { $in: ['0', 0, ''] } };

  const [emailCount, rollCount] = await Promise.all([
    User.countDocuments(emailFilter),
    User.countDocuments(rollFilter)
  ]);

  console.log(`Students with email "":      ${emailCount}`);
  console.log(`Students with rollNumber 0:  ${rollCount}`);

  if (!EXECUTE) {
    console.log('\nDry-run only. Re-run with --execute to unset these fields.');
    await mongoose.disconnect();
    return;
  }

  const r1 = await User.updateMany(emailFilter, { $unset: { email: '' } });
  const r2 = await User.updateMany(rollFilter, { $unset: { rollNumber: '' } });
  console.log(`\n✓ Unset email on ${r1.modifiedCount} students.`);
  console.log(`✓ Unset rollNumber on ${r2.modifiedCount} students.`);

  await mongoose.disconnect();
})().catch(err => {
  console.error(err); process.exit(1);
});
