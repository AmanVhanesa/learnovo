/**
 * Fix orphaned certificate records caused by Puppeteer failures.
 *
 * What happened:
 *   1. Certificate generation created a DB record (TC/2026/0001)
 *   2. Puppeteer failed (missing libatk on VPS)
 *   3. The counter was rolled back, but the DB record remained
 *   4. Every retry hit a duplicate key error on that same cert number
 *
 * This script:
 *   - Finds orphaned GeneratedCertificate records (no matching PDF was ever served)
 *   - Deletes them
 *   - Resets the counter so the next generation starts fresh
 *
 * Usage:  cd /var/www/learnovo/learnovo-backend && node scripts/fix-certificate-orphans.js
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const GeneratedCertificate = require('../models/GeneratedCertificate');
const Counter = require('../models/Counter');

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  // 1. Find all certificate records for the affected tenant
  const tenantId = '69b997691a50bdbb83c75e09';

  const orphans = await GeneratedCertificate.find({
    tenantId,
    certificateNumber: 'TC/2026/0001'
  });

  if (orphans.length === 0) {
    console.log('No orphaned TC/2026/0001 records found. Already clean.');
  } else {
    console.log(`Found ${orphans.length} orphaned record(s):`);
    orphans.forEach(o => {
      console.log(`  - ${o.certificateNumber} | student: ${o.student} | created: ${o.createdAt}`);
    });

    const result = await GeneratedCertificate.deleteMany({
      tenantId,
      certificateNumber: 'TC/2026/0001'
    });
    console.log(`Deleted ${result.deletedCount} orphaned record(s).\n`);
  }

  // 2. Reset the TC counter for 2026 so next generation starts at 0001 again
  const counter = await Counter.findOne({
    name: 'cert_tc',
    year: '2026',
    tenantId
  });

  if (counter) {
    console.log(`Current cert_tc counter: sequence = ${counter.sequence}`);
    counter.sequence = 0;
    await counter.save();
    console.log('Reset cert_tc counter to 0. Next certificate will be TC/2026/0001.\n');
  } else {
    console.log('No cert_tc counter found for 2026 — will be auto-created on next generation.\n');
  }

  // 3. Also check for any BONAFIDE orphans (just in case)
  const bonafideOrphans = await GeneratedCertificate.find({
    tenantId,
    type: 'BONAFIDE',
    createdAt: { $gte: new Date('2026-03-27') }
  });

  if (bonafideOrphans.length > 0) {
    console.log(`Found ${bonafideOrphans.length} recent BONAFIDE record(s) — inspect manually if needed:`);
    bonafideOrphans.forEach(o => {
      console.log(`  - ${o.certificateNumber} | student: ${o.student} | created: ${o.createdAt}`);
    });
  }

  console.log('\nDone! Now install Chromium dependencies and restart PM2:');
  console.log('  sudo apt-get update && sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 libasound2 libnspr4 libnss3');
  console.log('  pm2 restart learnovo');

  await mongoose.disconnect();
}

fix().catch(err => {
  console.error('Fix script failed:', err);
  process.exit(1);
});
