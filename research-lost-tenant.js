const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });
const Tenant = require('./models/Tenant');
const User = require('./models/User');

async function research() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database');

        // 1. Search for Tenants with schoolName containing "SP" or "International"
        const tenants = await Tenant.find({
            $or: [
                { schoolName: /sp/i },
                { schoolName: /international/i },
                { schoolCode: /sp/i },
                { schoolCode: /spis/i }
            ]
        });
        console.log('\nTenants found:', tenants.map(t => ({
            id: t._id,
            schoolName: t.schoolName,
            schoolCode: t.schoolCode,
            isActive: t.isActive,
            isDeleted: t.isDeleted
        })));

        // 2. Search for Users that might belong to an SP-related tenant
        // We'll search for users where email contains "sp" or "international"
        // or where they are admins for a tenant we found above
        const spUsers = await User.find({
            $or: [
                { email: /sp/i },
                { email: /international/i },
                { fullName: /sp/i }
            ]
        }).limit(20);
        console.log('\nPotential SP Users found:', spUsers.map(u => ({
            id: u._id,
            fullName: u.fullName,
            email: u.email,
            tenantId: u.tenantId,
            role: u.role
        })));

        // 3. Look for orphaned users (tenantId points to nothing)
        // This is more complex, let's just see if we can find a tenantId from the users we found
        const tenantIds = [...new Set(spUsers.map(u => u.tenantId?.toString()))].filter(Boolean);
        console.log('\nTenant IDs from potential SP users:', tenantIds);

        for (const tid of tenantIds) {
            const t = await Tenant.findById(tid);
            if (t) {
                console.log(`Tenant for ID ${tid}: ${t.schoolName} (${t.schoolCode})`);
            } else {
                console.log(`No Tenant found for ID ${tid} (ORPHANED USER!)`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

research();
