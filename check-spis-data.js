const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });
const Tenant = require('./models/Tenant');
const User = require('./models/User');
const Class = require('./models/Class');
const Section = require('./models/Section');
const Fee = require('./models/Fee');
const Exam = require('./models/Exam');

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const tenantId = new mongoose.Types.ObjectId("69b1768c587d373e40f64862");

        console.log(`Checking data for Tenant SPIS (${tenantId}):`);

        const models = {
            'Users': User,
            'Classes': Class,
            'Sections': Section,
            'Fees': Fee,
            'Exams': Exam
        };

        for (const [name, model] of Object.entries(models)) {
            const count = await model.countDocuments({ tenantId });
            console.log(`${name}: ${count}`);
        }

        // Check for "orphaned" SPIS data that might have a string ID or different field name
        const schoolNameSearch = /SP International/i;
        const usersWithName = await User.find({ fullName: schoolNameSearch });
        console.log(`\nUsers with name matching "SP International": ${usersWithName.length}`);

        // Check for any user with the name "SP International School" (sometimes used as admin)
        const adminUser = await User.findOne({ email: /spis/i });
        if (adminUser) {
            console.log(`\nFound potential admin user by email: ${adminUser.email}, tenantId: ${adminUser.tenantId}`);
        } else {
            console.log(`\nNo user found with email containing "spis"`);
        }

        // Check for ANY user at all for ANY tenant to see if data is globally lost
        const totalUsers = await User.countDocuments({});
        console.log(`\nTotal Users in system: ${totalUsers}`);

        const tenants = await Tenant.find({});
        console.log(`Total Tenants in system: ${tenants.length}`);
        for (const t of tenants) {
            const uCount = await User.countDocuments({ tenantId: t._id });
            console.log(`- ${t.schoolName} (${t._id}): ${uCount} users`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
