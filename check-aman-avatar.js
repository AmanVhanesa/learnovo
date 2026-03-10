const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    try {
      const user = await User.findOne({ name: /Aman/i }).select('name email avatar photo');
      console.log('User:', user);
    } catch (err) {
      console.error('Error:', err.message);
    }
    process.exit(0);
  });
