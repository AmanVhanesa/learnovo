/**
 * Migration Script: Add fullName to existing student records
 * 
 * This script populates the fullName field for all existing students
 * by concatenating firstName, middleName, and lastName.
 * 
 * Run this script once after deploying the schema changes.
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import User model
const User = require('../models/User');

async function migrateStudentNames() {
    try {
        console.log('🔄 Starting student name migration...');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to database');

        // Find all students without fullName
        const students = await User.find({
            role: 'student',
            $or: [
                { fullName: { $exists: false } },
                { fullName: null },
                { fullName: '' }
            ]
        });

        console.log(`📊 Found ${students.length} students to migrate`);

        let successCount = 0;
        let errorCount = 0;

        for (const student of students) {
            try {
                // Generate fullName from existing name parts
                const nameParts = [
                    student.firstName,
                    student.middleName,
                    student.lastName
                ].filter(Boolean);

                if (nameParts.length > 0) {
                    student.fullName = nameParts.join(' ');
                } else if (student.name) {
                    // Fallback to 'name' field if it exists
                    student.fullName = student.name;
                } else {
                    // Last resort: use email username
                    student.fullName = student.email.split('@')[0];
                }

                await student.save();
                successCount++;

                if (successCount % 100 === 0) {
                    console.log(`   Processed ${successCount} students...`);
                }
            } catch (error) {
                console.error(`❌ Error migrating student ${student._id}:`, error.message);
                errorCount++;
            }
        }

        console.log('\n✅ Migration completed!');
        console.log(`   Success: ${successCount}`);
        console.log(`   Errors: ${errorCount}`);
        console.log(`   Total: ${students.length}`);

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
    }
}

// Run migration
if (require.main === module) {
    migrateStudentNames()
        .then(() => {
            console.log('🎉 Migration script finished successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration script failed:', error);
            process.exit(1);
        });
}

module.exports = migrateStudentNames;
