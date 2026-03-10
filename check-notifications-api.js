const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });
const Notification = require('./models/Notification');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    try {
      console.log('Testing notification getUnreadCount...');
      const user = await User.findOne({ role: 'student' }).select('_id tenantId');
      
      if (!user) {
        throw new Error('No test user found');
      }

      console.log(`Found test user: ${user._id}`);
      
      const count = await Notification.getUnreadCount(user._id, user.tenantId);
      console.log(`Unread notifications count: ${count}`);
    } catch (err) {
      console.error('Error during test:', err.message);
    }
    process.exit(0);
  });
