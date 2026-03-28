/**
 * Migration: Backfill subdomain field for all tenants that don't have one.
 *
 * Sets subdomain = schoolCode (sanitised to slug format).
 * Skips tenants that already have a subdomain.
 * Handles duplicates by appending a numeric suffix.
 *
 * Usage:
 *   node scripts/backfill-subdomains.js
 *
 * Requires MONGO_URI or MONGODB_URI in config.env or environment.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../config.env') });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('FATAL: MONGO_URI or MONGODB_URI is not set');
  process.exit(1);
}

function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const tenants = await Tenant.find({ $or: [{ subdomain: null }, { subdomain: '' }, { subdomain: { $exists: false } }] });
  console.log(`Found ${tenants.length} tenant(s) without a subdomain\n`);

  if (tenants.length === 0) {
    console.log('Nothing to do.');
    await mongoose.disconnect();
    return;
  }

  // Collect existing subdomains to avoid conflicts
  const existing = new Set(
    (await Tenant.find({ subdomain: { $nin: [null, ''] } }).select('subdomain').lean())
      .map(t => t.subdomain)
  );

  let updated = 0;
  for (const tenant of tenants) {
    let slug = toSlug(tenant.schoolCode || tenant.schoolName || 'school');

    // Ensure minimum length
    if (slug.length < 3) slug = `${slug  }-school`;

    // Handle duplicates
    let candidate = slug;
    let suffix = 2;
    while (existing.has(candidate)) {
      candidate = `${slug}-${suffix}`;
      suffix++;
    }

    tenant.subdomain = candidate;
    existing.add(candidate);

    try {
      await tenant.save();
      console.log(`  ✓ ${tenant.schoolName} (${tenant.schoolCode}) → ${candidate}.learnovoportal.com`);
      updated++;
    } catch (err) {
      console.error(`  ✗ ${tenant.schoolName}: ${err.message}`);
    }
  }

  console.log(`\nDone. Updated ${updated}/${tenants.length} tenants.`);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
