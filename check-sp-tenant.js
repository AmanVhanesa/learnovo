const mongoose = require('mongoose');
require('dotenv').config({ path: './config.env' });
const Tenant = require('./models/Tenant');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const tenants = await Tenant.find({ name: /sp international/i });
    console.log('Tenants found:', tenants.map(t => ({ id: t._id, name: t.name })));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
