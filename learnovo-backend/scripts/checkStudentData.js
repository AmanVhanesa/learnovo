const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

const User = require('../models/User');

async function checkStudents() {
    try {
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
        console.log('Connected to MongoDB\n');

        // Get sample students
        const students = await User.find({ role: 'student' })
            .select('name class classId role isActive tenantId')
            .limit(5);

        console.log('=== Sample Students ===');
        students.forEach(s => {
            console.log({
                name: s.name,
                class: s.class,
                classId: s.classId?.toString(),
                role: s.role,
                isActive: s.isActive,
                tenantId: s.tenantId?.toString()
            });
        });

        // Count students by class
        console.log('\n=== Students by Class Field ===');
        const byClass = await User.aggregate([
            { $match: { role: 'student' } },
            { $group: { _id: '$class', count: { $sum: 1 } } }
        ]);
        console.log(byClass);

        // Count students by classId
        console.log('\n=== Students by ClassId Field ===');
        const byClassId = await User.aggregate([
            { $match: { role: 'student' } },
            { $group: { _id: '$classId', count: { $sum: 1 } } }
        ]);
        console.log(byClassId);

        await mongoose.disconnect();
        console.log('\nDone!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkStudents();
