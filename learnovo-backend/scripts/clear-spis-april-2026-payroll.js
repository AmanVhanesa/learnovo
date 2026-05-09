require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Payroll = require('../models/Payroll');

const MONTH = 4;
const YEAR = 2026;
const SCHOOL_CODE = 'spis';
const CONFIRM = process.argv.includes('--confirm');

(async() => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const tenant = await Tenant.findOne({ schoolCode: SCHOOL_CODE });
  if (!tenant) {
    console.error(`Tenant not found for schoolCode=${SCHOOL_CODE}`);
    process.exit(1);
  }

  const filter = { tenantId: tenant._id, month: MONTH, year: YEAR };
  const records = await Payroll.find(filter).select('_id employeeId month year status netSalary').lean();

  console.log(`Tenant: ${tenant.schoolName} (${tenant._id})`);
  console.log(`Found ${records.length} payroll record(s) for ${MONTH}/${YEAR}:`);
  records.forEach(r => console.log(`  - ${r._id} employee=${r.employeeId} status=${r.status} net=${r.netSalary}`));

  if (!CONFIRM) {
    console.log('\nDry run. Re-run with --confirm to delete.');
    await mongoose.disconnect();
    return;
  }

  const result = await Payroll.deleteMany(filter);
  console.log(`\nDeleted ${result.deletedCount} payroll record(s).`);
  await mongoose.disconnect();
})().catch(async(err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
