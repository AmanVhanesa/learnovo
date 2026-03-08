const mongoose = require('mongoose');
const User = require('./models/User');

const uri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
    .then(async () => {
        const tid = new mongoose.Types.ObjectId("69788171da522fa9b3baffa8");

        const bySection = await User.aggregate([
            { $match: { role: 'student', tenantId: tid, class: '1' } },
            { $group: { _id: "$section", count: { $sum: 1 } } }
        ]);

        console.log("By Section:", bySection);

        // Total is 204.
        const byActive = await User.aggregate([
            { $match: { role: 'student', tenantId: tid } },
            { $group: { _id: "$class", count: { $sum: 1 } } }
        ]);

        console.log("By Class:", byActive);

        mongoose.connection.close();
    });
