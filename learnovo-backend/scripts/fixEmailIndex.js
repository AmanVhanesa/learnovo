/**
 * Migration: Fix email unique index to allow multiple null values
 *
 * This script drops the old email_1_tenantId_1 index and recreates it
 * with a partialFilterExpression to only enforce uniqueness on non-null emails.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function migrate() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/learnovo';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Check existing indexes
    const indexes = await usersCollection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

    // Drop the old email_1_tenantId_1 index if it exists
    try {
      await usersCollection.dropIndex('email_1_tenantId_1');
      console.log('\n✅ Dropped old email_1_tenantId_1 index');
    } catch (error) {
      if (error.code === 27 || error.codeName === 'IndexNotFound') {
        console.log('\n⚠️  Index email_1_tenantId_1 not found (already dropped or doesn\'t exist)');
      } else {
        throw error;
      }
    }

    // Create the new index with partialFilterExpression
    // Note: MongoDB doesn't support $ne: '' in partial filters, so we only check for exists and not null
    await usersCollection.createIndex(
      { email: 1, tenantId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          email: { $type: 'string', $gt: '' }  // Only index non-empty strings
        },
        name: 'email_1_tenantId_1'
      }
    );
    console.log('✅ Created new email_1_tenantId_1 index with partial filter');

    // Verify the new index
    const newIndexes = await usersCollection.indexes();
    const emailIndex = newIndexes.find(idx => idx.name === 'email_1_tenantId_1');
    console.log('\n📋 New email index:');
    console.log(JSON.stringify(emailIndex, null, 2));

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
