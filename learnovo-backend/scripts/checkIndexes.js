/**
 * Check and fix all unique indexes to allow null/empty values
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function checkIndexes() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/learnovo';
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Get all indexes
        const indexes = await usersCollection.indexes();

        console.log('\n📋 All indexes on users collection:');
        console.log('=====================================');
        indexes.forEach(idx => {
            console.log(`\n${idx.name}:`);
            console.log('  Key:', JSON.stringify(idx.key));
            console.log('  Unique:', idx.unique || false);
            if (idx.partialFilterExpression) {
                console.log('  Partial Filter:', JSON.stringify(idx.partialFilterExpression));
            }
            if (idx.sparse) {
                console.log('  Sparse:', idx.sparse);
            }
        });

        console.log('\n\n🔍 Checking for problematic indexes...');

        const problematicIndexes = indexes.filter(idx => {
            // Find unique indexes without partial filters (except _id)
            return idx.unique &&
                !idx.partialFilterExpression &&
                !idx.sparse &&
                idx.name !== '_id_';
        });

        if (problematicIndexes.length > 0) {
            console.log('\n⚠️  Found potentially problematic unique indexes:');
            problematicIndexes.forEach(idx => {
                console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
            });
        } else {
            console.log('\n✅ No problematic indexes found');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

checkIndexes();
