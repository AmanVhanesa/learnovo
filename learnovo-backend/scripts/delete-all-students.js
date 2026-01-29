/**
 * Script to delete all student records from the database
 * USE WITH CAUTION - This will permanently delete all student data
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

async function deleteAllStudents() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✓ Connected to MongoDB');

        // Count students before deletion
        const studentCount = await User.countDocuments({ role: 'student' });
        console.log(`\nFound ${studentCount} student(s) in database`);

        if (studentCount === 0) {
            console.log('No students to delete.');
            process.exit(0);
        }

        // Ask for confirmation
        console.log('\n⚠️  WARNING: This will permanently delete ALL student records!');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');

        await new Promise(resolve => setTimeout(resolve, 5000));

        // Delete all students
        const result = await User.deleteMany({ role: 'student' });

        console.log(`\n✓ Successfully deleted ${result.deletedCount} student record(s)`);

        // Verify deletion
        const remainingCount = await User.countDocuments({ role: 'student' });
        console.log(`✓ Remaining students: ${remainingCount}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error deleting students:', error);
        process.exit(1);
    }
}

deleteAllStudents();
