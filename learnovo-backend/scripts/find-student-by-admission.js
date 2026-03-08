const mongoose = require('mongoose');
require('dotenv').config();

const findStudent = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learnovo');

        const User = require('../models/User');

        const queries = ['9779194938', '6006716450', '9429480591'];
        console.log(`Searching for students with admission numbers: ${queries.join(', ')}`);

        const students = await User.find({
            admissionNumber: { $in: queries }
        });

        console.log(`Found ${students.length} students.`);
        students.forEach(s => {
            console.log('--- Student Details ---');
            console.log(`ID: ${s._id}`);
            console.log(`Name: "${s.name}"`);
            console.log(`FullName: "${s.fullName}"`);
            console.log(`Admission: "${s.admissionNumber}"`);
            console.log(`Phone: "${s.phone}"`);
            console.log('-----------------------');
        });

        // Also check if there are duplicate students (same phone but different admission number)
        // Check for the KUNAL we found earlier
        if (students.length === 0) {
            console.log("No students found by admission number. Checking by phone...");
            const phoneStudents = await User.find({
                phone: { $in: queries }
            });
            phoneStudents.forEach(s => {
                console.log('--- Student By Phone ---');
                console.log(`ID: ${s._id}`);
                console.log(`Name: "${s.name}"`);
                console.log(`FullName: "${s.fullName}"`);
                console.log(`Admission: "${s.admissionNumber}"`);
                console.log(`Phone: "${s.phone}"`);
                console.log('-----------------------');
            });
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

findStudent();
