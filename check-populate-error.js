const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    try {
      const users = await User.find({ role: 'student' })
        .populate('subDepartment')
        .populate('driverId')
        .limit(1);
      console.log('Success:', users);
    } catch (err) {
      console.error('Error:', err.message);
    }
    process.exit(0);
  });
