// Script to delete all student records
// Usage: node scripts/deleteStudents.js

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function deleteAllStudents() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learnovo');
        console.log('✅ Connected to MongoDB');

        // Get count before deletion
        const countBefore = await User.countDocuments({ role: 'student' });
        console.log(`📊 Found ${countBefore} student(s) in the database`);

        if (countBefore === 0) {
            console.log('ℹ️  No students to delete');
            process.exit(0);
        }

        // Ask for confirmation
        console.log('\n⚠️  WARNING: This will delete ALL student records!');
        console.log('Press Ctrl+C to cancel, or wait 3 seconds to proceed...\n');

        // Wait 3 seconds
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Delete all students
        const result = await User.deleteMany({ role: 'student' });
        console.log(`✅ Successfully deleted ${result.deletedCount} student(s)`);

        // Verify deletion
        const countAfter = await User.countDocuments({ role: 'student' });
        console.log(`📊 Remaining students: ${countAfter}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error deleting students:', error.message);
        process.exit(1);
    }
}

deleteAllStudents();
