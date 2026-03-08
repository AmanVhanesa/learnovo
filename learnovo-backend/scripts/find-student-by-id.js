const mongoose = require('mongoose');
require('dotenv').config();

const findStudent = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learnovo');

        const User = require('../models/User');

        const query = '6006716450';
        console.log(`Searching for student with query: ${query}`);

        const students = await User.find({
            $or: [
                { admissionNumber: query },
                { studentId: query },
                { phone: query },
                { username: query }
            ]
        });

        console.log(`Found ${students.length} students.`);
        students.forEach(s => {
            console.log('--- Student Details ---');
            console.log(`ID: ${s._id}`);
            console.log(`Name: "_${s.name}_"`);
            console.log(`FullName: "_${s.fullName}_"`);
            console.log(`Admission: ${s.admissionNumber}`);
            console.log(`Phone: ${s.phone}`);
            console.log(`StudentId: ${s.studentId}`);
            console.log('-----------------------');
        });

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

findStudent();
