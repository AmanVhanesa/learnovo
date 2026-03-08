const mongoose = require('mongoose');
require('dotenv').config();

const checkTenant = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/learnovo');

        const Tenant = require('../models/Tenant');

        const tenants = await Tenant.find({}).limit(1);

        if (tenants.length > 0) {
            console.log('Tenant Found:');
            console.log(`ID: ${tenants[0]._id}`);
            console.log(`Name: ${tenants[0].schoolName}`);
            console.log(`Logo: "${tenants[0].logo}"`);
        } else {
            console.log('No tenants found');
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

checkTenant();
