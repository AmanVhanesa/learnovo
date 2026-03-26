const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });
const Tenant = require('../models/Tenant');
const Settings = require('../models/Settings');

const checkLogo = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) throw new Error('No MongoDB URI found');

        await mongoose.connect(uri);
        console.log('Connected to DB');

        const tenants = await Tenant.find({}, 'schoolName logo');
        console.log('--- Tenants ---');
        console.log(JSON.stringify(tenants, null, 2));

        const settings = await Settings.find({}, 'institution.logo');
        console.log('--- Settings ---');
        console.log(JSON.stringify(settings, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkLogo();
