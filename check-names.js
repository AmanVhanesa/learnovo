const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
    .then(async () => {
        const tid = new mongoose.Types.ObjectId("69788171da522fa9b3baffa8");
        const testNames = ["Kanishka"];

        for (const name of testNames) {
            const s = await User.find({ role: 'student', tenantId: tid, fullName: new RegExp(name, 'i') }).select('class section sectionId academicYear isActive createdAt subDepartment');
            console.log(name, " => ", s);
        }

        mongoose.connection.close();
    });
