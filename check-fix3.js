const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
    .then(async () => {
        const tid = new mongoose.Types.ObjectId("69788171da522fa9b3baffa8");
        const sectionNameRegex = new RegExp(`^A$`, 'i');
        const sectionIds = [new mongoose.Types.ObjectId("6996b56eefd80d8d2c7b7f60")]; // ID for Section A from check-students6.js

        const filter = { role: 'student', tenantId: tid, class: '1' };
        filter.$and = [];
        filter.$and.push({
            $or: [
                { sectionId: { $in: sectionIds } },
                { section: sectionNameRegex }
            ]
        });

        const students = await User.find(filter).select('fullName class section sectionId isActive');
        console.log(`With hardened $or filter length:`, students.length);

        // Check if the other 38 students have a DIFFERENT sectionId?
        const rawClass1A = await User.find({ role: 'student', tenantId: tid, class: '1', section: 'A' }).select('fullName class section sectionId');
        console.log(`Raw DB Class 1 Section A length:`, rawClass1A.length);

        const withDiffSectionId = rawClass1A.filter(s => s.sectionId && !s.sectionId.equals(sectionIds[0]));
        console.log(`Students with section: 'A' but different sectionId:`, withDiffSectionId.length);
        if (withDiffSectionId.length > 0) {
            console.log("Sample of different sectionId:", withDiffSectionId[0]);
        }

        mongoose.connection.close();
    });
