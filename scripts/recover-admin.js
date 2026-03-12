const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './config.env' }); // Set relative to CWD

const User = require('../models/User');
const Tenant = require('../models/Tenant');
const SuperAdmin = require('../models/SuperAdmin'); // Assuming this model exists based on earlier routes

async function recover() {
    try {
        console.log('--- Learnovo Data Recovery Script ---');

        let uri = process.env.MONGO_URI || process.env.MONGODB_URI;
        if (!uri) throw new Error('MONGODB_URI not found in env.');

        const maskedUri = uri.replace(/:([^:@]+)@/, ':****@');
        console.log(`Connecting to: ${maskedUri}`);

        await mongoose.connect(uri);
        console.log('Connected to Database successfully.\n');

        // 1. Recreate Super Admin (using config.env credentials)
        console.log('Step 1: Recreating Super Admin...');
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'evotechnologiesinnovation@gmail.com';
        const superAdminName = process.env.SUPER_ADMIN_NAME || 'EvoTech Super Admin';
        const rawPassword = process.env.SUPER_ADMIN_PASSWORD || 'Aman_8856';

        let saModel = null;
        try {
            // Check if SuperAdmin model is separate or part of User role
            const saExists = mongoose.modelNames().includes('SuperAdmin');
            if (saExists || require('fs').existsSync(require('path').join(__dirname, '../models/SuperAdmin.js'))) {
                saModel = SuperAdmin;
            }
        } catch (e) { }

        if (saModel) {
            let existingSa = await saModel.findOne({ email: superAdminEmail });
            if (!existingSa) {
                const hashedPassword = await bcrypt.hash(rawPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));
                await saModel.create({
                    name: superAdminName,
                    email: superAdminEmail,
                    password: hashedPassword,
                    isActive: true
                });
                console.log(`✅ Super Admin created: ${superAdminEmail}`);
            } else {
                console.log(`ℹ️ Super Admin already exists: ${superAdminEmail}`);
            }
        } else {
            console.log("SuperAdmin model not found, skipping dedicated super admin creation (maybe it uses User collection).");
        }


        // 2. Recreate SP International School Tenant
        console.log('\nStep 2: Recreating SPIS Tenant...');
        let spisTenant = await Tenant.findOne({ schoolCode: 'spis' });

        if (!spisTenant) {
            spisTenant = await Tenant.create({
                schoolName: 'SP International School',
                schoolCode: 'spis',
                email: 'admin@spis.edu', // generic
                phone: '+910000000000',
                address: {
                    city: 'Local City',
                    country: 'India'
                },
                subscription: {
                    plan: 'enterprise',
                    status: 'active',
                    maxStudents: 5000,
                    maxTeachers: 200
                },
                isActive: true
            });
            console.log(`✅ SPIS Tenant created with ID: ${spisTenant._id}`);
        } else {
            console.log(`ℹ️ SPIS Tenant already exists with ID: ${spisTenant._id}`);
        }

        // 3. Recreate SPIS Admin User
        console.log('\nStep 3: Recreating SPIS Admin User...');
        const initialSpisAdminPassword = await bcrypt.hash('Admin@123', 12);

        let spisAdmin = await User.findOne({ email: 'admin@spis.edu', tenantId: spisTenant._id });
        if (!spisAdmin) {
            spisAdmin = await User.create({
                tenantId: spisTenant._id,
                fullName: 'SPIS Administrator',
                email: 'admin@spis.edu',
                password: initialSpisAdminPassword,
                role: 'admin',
                isActive: true
            });
            console.log(`✅ SPIS Admin User created.`);
            console.log(`   Email: admin@spis.edu`);
            console.log(`   Password: Admin@123`);
            console.log(`   IMPORTANT: Please change this password upon logging in!`);
        } else {
            console.log(`ℹ️ SPIS Admin User already exists: admin@spis.edu`);
        }

        console.log('\n✅ Recovery complete. You can now log in.');

    } catch (err) {
        console.error('❌ Recovery Error:', err);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from DB.');
    }
}

recover();
