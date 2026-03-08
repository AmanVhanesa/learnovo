const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri).then(async () => {
    try {
        const aman = await User.findOne({ fullName: /Aman Vhanesa/i });
        console.log("Aman role:", aman ? aman.role : "not found");

        if (aman) {
            const TeacherSubjectAssignment = require('./models/TeacherSubjectAssignment');
            const assignments = await TeacherSubjectAssignment.find({ teacherId: aman._id });
            console.log("Assignments:", assignments.length);
        }
    } catch (err) {
        console.error(err);
    }
    mongoose.connection.close();
});
