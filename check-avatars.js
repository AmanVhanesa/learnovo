const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        try {
            const user = await User.findOne({ email: /evotechnologies/i }).select('name email avatar photo');
            console.log('Superadmin User:', user);

            const teacher = await User.findOne({ role: 'teacher' }).select('name email avatar photo');
            console.log('Teacher User:', teacher);
        } catch (err) {
            console.error('Error:', err.message);
        }
        process.exit(0);
    });
