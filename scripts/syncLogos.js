const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });
const Tenant = require('../models/Tenant');
const Settings = require('../models/Settings');

const syncLogos = async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) throw new Error('No MongoDB URI found');

        await mongoose.connect(uri);
        console.log('Connected to DB');

        const settingsList = await Settings.find({});
        console.log(`Found ${settingsList.length} settings records.`);

        for (const setting of settingsList) {
            if (setting.institution && setting.tenantId) {
                const tenantUpdate = {};
                const inst = setting.institution;

                if (inst.logo) tenantUpdate.logo = inst.logo;
                if (inst.name) tenantUpdate.schoolName = inst.name;
                if (inst.contact?.email) tenantUpdate.email = inst.contact.email;
                if (inst.contact?.phone) tenantUpdate.phone = inst.contact.phone;

                if (inst.address) {
                    tenantUpdate.address = {
                        street: inst.address.street,
                        city: inst.address.city,
                        state: inst.address.state,
                        country: inst.address.country,
                        zipCode: inst.address.pincode
                    };
                }

                if (Object.keys(tenantUpdate).length > 0) {
                    await Tenant.findByIdAndUpdate(setting.tenantId, { $set: tenantUpdate });
                    console.log(`Updated Tenant ${setting.tenantId} from Settings ${setting._id}`);
                }
            }
        }

        console.log('Sync complete.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

syncLogos();
