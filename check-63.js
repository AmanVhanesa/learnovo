const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
    .then(async () => {
        const tid = new mongoose.Types.ObjectId("69788171da522fa9b3baffa8");

        const count2026 = await User.countDocuments({ role: 'student', tenantId: tid, class: '1', academicYear: '2026-2027' });
        const countActive = await User.countDocuments({ role: 'student', tenantId: tid, class: '1', isActive: true });

        // Let's count by SubDepartment!
        const subDepCount1 = await User.countDocuments({ role: 'student', tenantId: tid, class: '1', subDepartment: new mongoose.Types.ObjectId("697b1e0d7e7a7030777b6e8d") });
        const subDepCount2 = await User.countDocuments({ role: 'student', tenantId: tid, class: '1', subDepartment: new mongoose.Types.ObjectId("697b1e0d7e7a7030777b6e66") });

        console.log({ count2026, countActive, subDepCount1, subDepCount2 });

        // What if Section D has exactly 63 students?!
        const countD = await User.countDocuments({ role: 'student', tenantId: tid, class: '1', section: 'D' });
        console.log({ countD });

        mongoose.connection.close();
    });
