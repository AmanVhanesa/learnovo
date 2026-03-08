const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
    .then(async () => {
        const tid = new mongoose.Types.ObjectId("69788171da522fa9b3baffa8");
        const sectionIds = [new mongoose.Types.ObjectId("6996b56eefd80d8d2c7b7f60")]; // ID for Section A from check-students6.js

        const filter = { role: 'student', tenantId: tid, class: '1' };
        filter.sectionId = { $in: sectionIds }; // Exact original logic BEFORE my fix!

        const students = await User.find(filter).select('fullName section');
        console.log(`Original API Logic matching students:`);
        students.forEach(s => console.log(`- ${s.fullName} (${s.section})`));

        mongoose.connection.close();
    });
