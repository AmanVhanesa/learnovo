const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });
const User = require('./models/User');
const Class = require('./models/Class');
const Section = require('./models/Section');
const Fee = require('./models/Fee');
const Exam = require('./models/Exam');
const Tenant = require('./models/Tenant');

async function searchOrphans() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const oldTenantId = new mongoose.Types.ObjectId("6995a45cf91b84df06840fae");

        console.log(`Searching for data linked to OLD Tenant ID (${oldTenantId}):`);

        const models = {
            'Users': User,
            'Classes': Class,
            'Sections': Section,
            'Fees': Fee,
            'Exams': Exam
        };

        let totalFound = 0;
        for (const [name, model] of Object.entries(models)) {
            const count = await model.countDocuments({ tenantId: oldTenantId });
            console.log(`${name}: ${count}`);
            totalFound += count;
        }

        if (totalFound > 0) {
            console.log('\nSUCCESS! Found orphaned data linked to the old tenant ID.');
            // Show some examples of what was found
            const sampleUser = await User.findOne({ tenantId: oldTenantId });
            if (sampleUser) {
                console.log(`Sample User: ${sampleUser.fullName} (${sampleUser.email})`);
            }
        } else {
            console.log('\nNo data found for the old tenant ID either.');
            // Check if maybe it's stored as a string?
            const countString = await User.countDocuments({ tenantId: "6995a45cf91b84df06840fae" });
            console.log(`Users with string tenantId: ${countString}`);
        }

        // Check if the old tenant record itself exists (maybe it's just marked as deleted?)
        const oldTenant = await Tenant.findOne({ _id: oldTenantId });
        if (oldTenant) {
            console.log('\nOld Tenant record STILL EXISTS!');
            console.log(oldTenant);
        } else {
            console.log('\nOld Tenant record is COMPLETELY GONE from the Tenant collection.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

searchOrphans();
