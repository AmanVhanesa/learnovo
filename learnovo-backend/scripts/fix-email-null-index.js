#!/usr/bin/env node
/**
 * fix-email-null-index.js
 *
 * One-time migration:
 * 1. Unset email field on all users where email is null (so the index ignores them)
 * 2. Drop the old sparse unique index on { email: 1, tenantId: 1 }
 * 3. Recreate it as a partial index (only indexes docs where email is a string)
 *
 * Run: node scripts/fix-email-null-index.js
 * Safe to run multiple times (idempotent).
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function run() {
  if (!MONGODB_URI) {
    console.error('No MONGODB_URI found in config.env');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const usersCol = db.collection('users');

  // Step 1: Unset email where it's null
  const unsetResult = await usersCol.updateMany(
    { email: null },
    { $unset: { email: '' } }
  );
  console.log(`Step 1: Unset email on ${unsetResult.modifiedCount} users with email: null`);

  // Step 2: Drop old index (try both possible names)
  const indexes = await usersCol.indexes();
  const emailIndex = indexes.find(
    idx => idx.key && idx.key.email === 1 && idx.key.tenantId === 1
  );

  if (emailIndex) {
    console.log(`Step 2: Dropping old index "${emailIndex.name}"...`);
    await usersCol.dropIndex(emailIndex.name);
    console.log('  Dropped.');
  } else {
    console.log('Step 2: No existing email_tenantId index found, skipping drop.');
  }

  // Step 3: Create new partial index
  console.log('Step 3: Creating new partial unique index on { email: 1, tenantId: 1 }...');
  await usersCol.createIndex(
    { email: 1, tenantId: 1 },
    {
      unique: true,
      partialFilterExpression: { email: { $type: 'string' } },
      name: 'email_1_tenantId_1'
    }
  );
  console.log('  Created.');

  console.log('\nDone! The email unique index now ignores null/missing emails.');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
