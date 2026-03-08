const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
    .then(async () => {
        const admins = await User.find({ role: 'admin' }).select('fullName email tenantId');
        console.log("Admins:");
        admins.forEach(a => console.log(a.fullName, a.email, a.tenantId));

        // specifically find Aman Vhanesa
        const aman = await User.findOne({ fullName: /Aman Vhanesa/i });
        if (aman) {
            console.log("\nFound Aman Vhanesa: ", aman.tenantId);

            // Find students in THAT tenant for class 1 and what section they have
            const students = await User.find({ role: 'student', tenantId: aman.tenantId, class: "1", isActive: true: '1' }).select('fullName class section sectionId');
            console.log(`\nStudents in Class 1 for Aman's tenant (${students.length}):`);
            students.slice(0, 15).forEach(s => console.log(s.fullName, s.section, s.sectionId));
        }
        mongoose.connection.close();
    })
    .catch(err => {
        console.error(err);
    });
