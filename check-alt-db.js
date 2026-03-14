const mongoose = require('mongoose');
// The alternative URI found in check-tenants.js
const alternativeUri = "mongodb+srv://evotechnologiesinnovation_db_user:V9ZYlKfuNpdzePqW@cluster0.soajlb4.mongodb.net/learnovo?retryWrites=true&w=majority&appName=Cluster0";
const Tenant = require('./models/Tenant');
const User = require('./models/User');

async function checkAltDb() {
    try {
        console.log('Connecting to Alternative DB...');
        await mongoose.connect(alternativeUri);
        console.log('Connected to Alternative DB');

        const totalUsers = await User.countDocuments({});
        console.log(`Total Users in system: ${totalUsers}`);

        const tenants = await Tenant.find({});
        console.log(`Total Tenants in system: ${tenants.length}`);
        for (const t of tenants) {
            const uCount = await User.countDocuments({ tenantId: t._id });
            console.log(`- ${t.schoolName} (${t._id}): ${uCount} users`);
        }

        // Search for SP International School
        const spis = await Tenant.findOne({ schoolName: /SP International/i });
        if (spis) {
            console.log('\nFound SPIS in Alternative DB!');
            console.log(spis);
            const users = await User.find({ tenantId: spis._id });
            console.log(`Users for SPIS in Alt DB: ${users.length}`);
            users.forEach(u => console.log(`- ${u.fullName} (${u.email}) - Role: ${u.role}`));
        } else {
            console.log('\nSPIS NOT found in Alternative DB');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkAltDb();
