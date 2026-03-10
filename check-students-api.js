const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });
const User = require('./models/User');
require('./models/SubDepartment');
require('./models/Driver');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    try {
      console.log('Testing student populate...');
      const users = await User.find({ role: 'student' })
        .populate('subDepartment', 'name')
        .populate('driverId', 'name phone')
        .limit(2);

      console.log(`Successfully fetched ${users.length} students without crashing.`);
      if (users.length > 0) {
        console.log('Sample User keys:', Object.keys(users[0].toObject()));
      }
    } catch (err) {
      console.error('Error during query:', err.message);
    }
    process.exit(0);
  });
