/**
 * Locate any User record in the SPIS tenant that collides with the phone/email
 * being entered for a new employee. Pinpoints the "duplicate entry detected"
 * error when the conflicting record is invisible in the Employees list
 * (e.g. parent/student record, soft-deleted employee, role outside the
 * employee filter).
 *
 * Usage:
 *   node scripts/find-spis-employee-conflict.js \
 *     --phone=6283866695 \
 *     --email=pooja06yadav28@gmail.com \
 *     [--schoolCode=spis]
 *
 * Run against the PRODUCTION database (MONGODB_URI in config.env).
 * Read-only — does not modify any data.
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');

function parseArgs(argv) {
  const out = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function run() {
  const args = parseArgs(process.argv);
  const phone = (args.phone || '').trim();
  const email = (args.email || '').trim().toLowerCase();
  const schoolCode = (args.schoolCode || 'spis').toLowerCase();

  if (!phone && !email) {
    console.error('Provide at least --phone= or --email=');
    process.exit(1);
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI / MONGODB_URI not set in config.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`Connected to ${uri.replace(/\/\/[^@]+@/, '//***@')}`);

  const tenant = await Tenant.findOne({ schoolCode });
  if (!tenant) {
    console.error(`Tenant with schoolCode="${schoolCode}" not found`);
    process.exit(1);
  }
  console.log(`Tenant: ${tenant.schoolName}  (_id=${tenant._id})`);
  console.log(`Looking for conflicts with phone="${phone}"  email="${email}"\n`);

  const orClauses = [];
  if (phone) orClauses.push({ phone });
  if (email) orClauses.push({ email });

  const matches = await User.find({
    tenantId: tenant._id,
    $or: orClauses
  }).select('+password').lean();

  console.log(`Found ${matches.length} matching User document(s) in this tenant.\n`);

  if (matches.length === 0) {
    console.log('No conflict in this tenant — the duplicate must come from elsewhere.');
    console.log('Cross-tenant collisions are not possible since phone uniqueness is scoped to tenantId.');
    await mongoose.disconnect();
    return;
  }

  matches.forEach((u, idx) => {
    console.log(`──────────── Match #${idx + 1} ────────────`);
    console.log(`_id:             ${u._id}`);
    console.log(`role:            ${u.role}`);
    console.log(`name:            "${u.name || ''}"  fullName: "${u.fullName || ''}"`);
    console.log(`email:           "${u.email || ''}"`);
    console.log(`phone:           "${u.phone || ''}"`);
    console.log(`employeeId:      "${u.employeeId || ''}"`);
    console.log(`admissionNumber: "${u.admissionNumber || ''}"`);
    console.log(`isActive:        ${u.isActive}`);
    console.log(`loginEnabled:    ${u.loginEnabled}`);
    if (u.inactiveReason || u.inactivatedAt) {
      console.log(`inactiveReason:  "${u.inactiveReason || ''}"`);
      console.log(`inactivatedAt:   ${u.inactivatedAt || ''}`);
    }
    console.log(`createdAt:       ${u.createdAt}`);
    console.log(`updatedAt:       ${u.updatedAt}`);
    const matchOnPhone = phone && u.phone === phone;
    const matchOnEmail = email && u.email === email;
    console.log(`conflict on:     ${[matchOnPhone && 'phone', matchOnEmail && 'email'].filter(Boolean).join(', ')}`);
    console.log('');
  });

  console.log('─── Suggested next steps ───');
  console.log('• If role is "teacher"/"staff"/etc. and isActive=false  → reactivate via Employees page (toggle status), or use a one-off script to flip isActive=true.');
  console.log('• If role is "student" or "parent"                      → the contact is held by another user. Either use a different phone/email for Pooja, or correct the other record.');
  console.log('• If the record looks like Pooja from a prior attempt   → it already exists. Adjust the Employees filter (set Status=Inactive, or clear search) to confirm.');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
