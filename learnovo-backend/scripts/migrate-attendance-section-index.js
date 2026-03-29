/**
 * Migration: Update Attendance index to include sectionId
 *
 * Drops the old unique index { tenantId, classId, date, subject }
 * and lets Mongoose create the new one { tenantId, classId, sectionId, date, subject }
 *
 * Also sets sectionId = null on all existing records for index compatibility.
 *
 * Usage: node scripts/migrate-attendance-section-index.js
 */
require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

async function migrate() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not found in config.env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const collection = db.collection('attendances');

  // 1. Set sectionId = null on all existing records that don't have it
  const updateResult = await collection.updateMany(
    { sectionId: { $exists: false } },
    { $set: { sectionId: null } }
  );
  console.log(`Updated ${updateResult.modifiedCount} attendance records with sectionId: null`);

  // 2. Drop old unique index if it exists
  try {
    const indexes = await collection.indexes();
    const oldIndex = indexes.find(idx => {
      const keys = Object.keys(idx.key);
      return keys.length === 4 &&
        idx.key.tenantId === 1 &&
        idx.key.classId === 1 &&
        idx.key.date === 1 &&
        idx.key.subject === 1 &&
        idx.unique;
    });

    if (oldIndex) {
      await collection.dropIndex(oldIndex.name);
      console.log(`Dropped old index: ${oldIndex.name}`);
    } else {
      console.log('Old index not found (may already be migrated)');
    }
  } catch (err) {
    console.log('Error dropping old index:', err.message);
  }

  // 3. Create new unique index
  try {
    await collection.createIndex(
      { tenantId: 1, classId: 1, sectionId: 1, date: 1, subject: 1 },
      { unique: true }
    );
    console.log('Created new unique index with sectionId');
  } catch (err) {
    console.log('Error creating new index:', err.message);
  }

  await mongoose.disconnect();
  console.log('Migration complete');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
