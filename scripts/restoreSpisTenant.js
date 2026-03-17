require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // used for direct password updates (bypasses pre-save hook)
const Tenant = require('../models/Tenant');
const User = require('../models/User');

async function restore() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Check if tenant already exists
  let tenant = await Tenant.findOne({ schoolCode: 'spis' });
  if (tenant) {
    console.log('Tenant already exists:', tenant._id);
  } else {
    tenant = await Tenant.create({
      schoolName: 'SP International School',
      schoolCode: 'spis',
      email: 'spinternationalschool2021@gmail.com',
      phone: '',
      address: { city: '', country: 'India' },
      isActive: true,
      subscription: {
        plan: 'enterprise',
        status: 'active',
        maxStudents: 10000,
        maxTeachers: 500
      },
      settings: {
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        currency: 'INR',
        academicYear: '2024-2025'
      }
    });
    console.log('Tenant created:', tenant._id);
  }

  // Check if admin user already exists
  let admin = await User.findOne({ email: 'spinternationalschool2021@gmail.com', tenantId: tenant._id });
  if (admin) {
    console.log('Admin user already exists, updating password...');
    // Use raw collection update to bypass the pre-save hook (which would double-hash)
    const hashed = await bcrypt.hash('Sp@2021', 12);
    await mongoose.connection.collection('users').updateOne(
      { _id: admin._id },
      { $set: { password: hashed, isActive: true } }
    );
    console.log('Password updated.');
  } else {
    // Pass plain text — the pre-save hook will hash it once
    await User.create({
      tenantId: tenant._id,
      fullName: 'SP International Admin',
      firstName: 'SP International',
      lastName: 'Admin',
      email: 'spinternationalschool2021@gmail.com',
      password: 'Sp@2021',
      role: 'admin',
      isActive: true
    });
    console.log('Admin user created.');
  }

  console.log('\nDone! Login with:');
  console.log('  School Code : spis');
  console.log('  Email       : spinternationalschool2021@gmail.com');
  console.log('  Password    : Sp@2021');

  await mongoose.connection.close();
}

restore().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
