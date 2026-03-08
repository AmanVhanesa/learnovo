const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
    .then(async () => {
        const tid = new mongoose.Types.ObjectId("6978848ada522fa9b3bb010f");
        const allC1 = await User.countDocuments({ role: 'student', tenantId: tid, class: '1' });
        const activeC1 = await User.countDocuments({ role: 'student', tenantId: tid, class: '1', isActive: true });

        // what if class is 'Class 1'?
        const class1Count = await User.countDocuments({ role: 'student', tenantId: tid, class: 'Class 1' });

        // What if we count those with section D?
        const secD = await User.countDocuments({ role: 'student', tenantId: tid, class: '1', section: 'D' });

        // Get ALL active students in the entire school
        const activeAll = await User.countDocuments({ role: 'student', tenantId: tid, isActive: true });

        console.log({ allC1, activeC1, class1Count, secD, activeAll });
        mongoose.connection.close();
    });
