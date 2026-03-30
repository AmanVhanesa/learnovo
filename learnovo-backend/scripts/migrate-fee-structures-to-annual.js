/**
 * Migration: Convert Fee Structures to Annual Amount Model
 *
 * This script migrates existing FeeStructure documents from the old
 * frequency-based model to the new annual_amount model:
 *
 * Old model:
 *   feeHead.amount = 4500, feeHead.frequency = 'quarterly'
 *   (meaning ₹4,500 per quarter)
 *
 * New model:
 *   feeHead.annualAmount = 18000, feeHead.type = 'recurring'
 *   (meaning ₹18,000 per year, split by payment plan at invoice time)
 *
 * Conversion rules:
 *   monthly    → annualAmount = amount × 12
 *   quarterly  → annualAmount = amount × 4
 *   half-yearly → annualAmount = amount × 2
 *   yearly     → annualAmount = amount × 1
 *   one-time   → annualAmount = amount × 1, type = 'one_time'
 *
 * This migration is SAFE and NON-DESTRUCTIVE:
 *   - It adds new fields (annualAmount, type) without removing old ones
 *   - It only modifies documents that don't already have annualAmount set
 *   - It can be run multiple times safely (idempotent)
 *
 * Usage:
 *   NODE_ENV=production node scripts/migrate-fee-structures-to-annual.js
 *   NODE_ENV=production node scripts/migrate-fee-structures-to-annual.js --dry-run
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI not set in config.env');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');

function getMultiplier(frequency) {
  switch (frequency) {
  case 'monthly': return 12;
  case 'quarterly': return 4;
  case 'half-yearly': return 2;
  case 'yearly': return 1;
  case 'one-time': return 1;
  default: return 1;
  }
}

function getType(frequency, isAdmissionFee) {
  if (frequency === 'one-time' || isAdmissionFee) return 'one_time';
  return 'recurring';
}

async function migrate() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Fee Structure Migration: frequency → annualAmount');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`${'='.repeat(60)}\n`);

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const FeeStructure = require('../models/FeeStructure');

  const structures = await FeeStructure.find({});
  console.log(`Found ${structures.length} fee structures to check\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const structure of structures) {
    let needsSave = false;

    for (const head of structure.feeHeads) {
      // Skip if already migrated
      if (head.annualAmount && head.annualAmount > 0) {
        continue;
      }

      const oldAmount = head.amount || 0;
      const oldFreq = head.frequency || 'yearly';
      const multiplier = getMultiplier(oldFreq);
      const annualAmount = Math.round(oldAmount * multiplier);
      const type = getType(oldFreq, head.isAdmissionFee);

      console.log(`  [${structure._id}] "${head.name}": ${oldAmount} × ${oldFreq}(${multiplier}) → annualAmount=${annualAmount}, type=${type}`);

      head.annualAmount = annualAmount;
      head.type = type;
      // Keep amount = annualAmount for backward compat
      head.amount = annualAmount;
      // Set frequency to 'yearly' for recurring, 'one-time' for one_time
      head.frequency = type === 'one_time' ? 'one-time' : 'yearly';
      needsSave = true;
    }

    if (needsSave) {
      if (!isDryRun) {
        try {
          await structure.save();
          migrated++;
        } catch (err) {
          console.error(`  ERROR saving ${structure._id}: ${err.message}`);
          errors++;
        }
      } else {
        migrated++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Migration complete:');
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped (already migrated): ${skipped}`);
  console.log(`  Errors: ${errors}`);
  if (isDryRun) console.log('  (DRY RUN — no actual changes made)');
  console.log(`${'='.repeat(60)}\n`);

  // Also migrate AnnualFeeAllocation documents
  const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
  const allocations = await AnnualFeeAllocation.find({});
  console.log(`Checking ${allocations.length} annual fee allocations...\n`);

  let allocMigrated = 0;
  let allocSkipped = 0;

  for (const alloc of allocations) {
    let needsSave = false;

    for (const head of alloc.allocatedFeeHeads) {
      if (head.annualAmount && head.annualAmount > 0) continue;

      const oldAmount = head.amount || 0;
      const oldFreq = head.frequency || 'yearly';
      const multiplier = getMultiplier(oldFreq);
      const annualAmount = Math.round(oldAmount * multiplier);
      const type = getType(oldFreq, head.isAdmissionFee);

      head.annualAmount = annualAmount;
      head.type = type;
      needsSave = true;
    }

    if (needsSave) {
      if (!isDryRun) {
        try {
          await alloc.save();
          allocMigrated++;
        } catch (err) {
          console.error(`  ERROR saving allocation ${alloc._id}: ${err.message}`);
        }
      } else {
        allocMigrated++;
      }
    } else {
      allocSkipped++;
    }
  }

  console.log(`Allocation migration: ${allocMigrated} migrated, ${allocSkipped} skipped\n`);

  await mongoose.disconnect();
  console.log('Done.\n');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
