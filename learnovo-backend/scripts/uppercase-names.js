/**
 * One-time migration: Convert all user name fields to UPPERCASE
 * Run: node scripts/uppercase-names.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

const User = require('../models/User');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({
        $or: [
            { name: { $exists: true, $ne: null } },
            { fullName: { $exists: true, $ne: null } },
            { firstName: { $exists: true, $ne: null } },
            { lastName: { $exists: true, $ne: null } }
        ]
    }).lean();

    console.log(`Found ${users.length} users to process...`);

    let updated = 0;
    for (const user of users) {
        const update = {};
        if (user.name) update.name = user.name.toUpperCase();
        if (user.fullName) update.fullName = user.fullName.toUpperCase();
        if (user.firstName) update.firstName = user.firstName.toUpperCase();
        if (user.middleName) update.middleName = user.middleName.toUpperCase();
        if (user.lastName) update.lastName = user.lastName.toUpperCase();

        if (Object.keys(update).length > 0) {
            await User.updateOne({ _id: user._id }, { $set: update });
            updated++;
        }
    }

    console.log(`✅ Done! Updated ${updated} users.`);
    await mongoose.disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
