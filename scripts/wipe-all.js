const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' }); // Ensure execution from root

const User = require('../models/User');
const Tenant = require('../models/Tenant');

async function removeAllTenants() {
    try {
        console.log('--- Learnovo User & Tenant Wipe ---');

        let uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI not found in env.');

        const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
        console.log(`Connecting to: ${maskedUri}`);

        await mongoose.connect(uri);
        console.log('Connected to Database successfully.\n');

        console.log('User explicitly requested to clear all tenants to start fresh.');

        // Wipe Tenants
        const tenantResult = await Tenant.deleteMany({});
        console.log(`✅ Deleted ${tenantResult.deletedCount} Tenants.`);

        // Wipe Users (so no orphaned users remain)
        const userResult = await User.deleteMany({});
        console.log(`✅ Deleted ${userResult.deletedCount} Users.`);

        console.log('\n✅ Database wiped successfully. You can now recreate the tenant from scratch.');

    } catch (err) {
        console.error('❌ Wipe Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from DB.');
    }
}

removeAllTenants();
