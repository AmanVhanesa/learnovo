const mongoose = require('mongoose');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
require('dotenv').config({ path: './config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learnovo', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Seed demo data
const seedDemoData = async() => {
  try {
    console.log('🌱 Starting to seed demo data...');

    // Check if demo tenant exists
    let demoTenant = await Tenant.findOne({ schoolCode: 'demo' });
    
    if (!demoTenant) {
      console.log('Creating Demo Tenant...');
      demoTenant = await Tenant.create({
        schoolName: 'Demo School',
        schoolCode: 'demo',
        subdomain: 'demo',
        email: 'admin@learnovo.com',
        phone: '+919876543210',
        subscription: {
          plan: 'enterprise',
          status: 'active',
          maxStudents: 10000,
          maxTeachers: 500,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          price: 0
        }
      });
      console.log('✅ Demo Tenant created');
    } else {
      console.log('✅ Demo Tenant already exists');
    }

    // Check if demo admin exists
    let demoAdmin = await User.findOne({ 
      email: 'admin@learnovo.com',
      tenantId: demoTenant._id 
    });
    
    if (!demoAdmin) {
      console.log('Creating Demo Admin user...');
      demoAdmin = await User.create({
        tenantId: demoTenant._id,
        name: 'Demo Admin',
        email: 'admin@learnovo.com',
        password: 'admin123',
        role: 'admin',
        phone: '+919876543210'
      });
      console.log('✅ Demo Admin user created');
    } else {
      console.log('✅ Demo Admin user already exists');
      // Update password to ensure it's correct
      demoAdmin.password = 'admin123';
      await demoAdmin.save();
      console.log('✅ Demo Admin password updated');
    }

    console.log('\n🎉 Demo data seeding completed successfully!');
    console.log('\n📋 Demo Login Credentials:');
    console.log('Email: admin@learnovo.com');
    console.log('Password: admin123');
    console.log('School Code: demo (optional)');
    console.log('\n💡 You can now login with these credentials without requiring a school code.');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  }
};

// Run seed data
seedDemoData();
