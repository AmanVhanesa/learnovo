require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const SuperAdmin = require('../models/SuperAdmin');

const seedSuperAdmin = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!mongoUri) {
            console.error('❌ FATAL: MONGO_URI or MONGODB_URI is not set in config.env');
            process.exit(1);
        }

        const email = process.env.SUPER_ADMIN_EMAIL;
        const password = process.env.SUPER_ADMIN_PASSWORD;
        const name = process.env.SUPER_ADMIN_NAME || 'Learnovo Super Admin';

        if (!email || !password) {
            console.error('❌ FATAL: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in config.env');
            process.exit(1);
        }

        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');

        // Check if super admin already exists
        const existing = await SuperAdmin.findOne({ email: email.toLowerCase() });

        if (existing) {
            console.log(`ℹ️  Super admin already exists: ${existing.email} (id: ${existing._id})`);
            console.log('   No changes made. To reset the password, delete the document and re-run.');
        } else {
            const superAdmin = await SuperAdmin.create({ name, email: email.toLowerCase(), password });
            console.log('✅ Super admin created successfully!');
            console.log(`   Name:  ${superAdmin.name}`);
            console.log(`   Email: ${superAdmin.email}`);
            console.log(`   ID:    ${superAdmin._id}`);
        }

        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding super admin:', error.message);
        try { await mongoose.disconnect(); } catch (_) { }
        process.exit(1);
    }
};

seedSuperAdmin();
