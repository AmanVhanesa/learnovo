const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb://127.0.0.1:27017/learnovo";

mongoose.connect(uri)
    .then(async () => {
        // get students for class 1
        const students = await User.find({ role: 'student', class: '1' }).select('fullName class section sectionId');
        console.log('\nStudents in class 1 on local DB:');
        students.forEach(s => {
            console.log(`- ${String(s.fullName).padEnd(30)} | class: ${s.class} | section: ${s.section} | sectionId: ${s.sectionId}`);
        });

        mongoose.connection.close();
    })
    .catch(err => {
        console.error('Local DB not running or error:', err);
    });
