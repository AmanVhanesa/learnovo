/**
 * Migration: Backfill employeeType='User' on all existing Payroll records.
 *
 * Required after introducing the refPath-based employeeType field
 * so populate('employeeId') resolves correctly for legacy records.
 *
 * Usage:
 *   node scripts/backfill-payroll-employee-type.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../config.env') });
const mongoose = require('mongoose');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('FATAL: MONGO_URI or MONGODB_URI is not set');
  process.exit(1);
}

(async () => {
  await mongoose.connect(mongoUri);
  const result = await mongoose.connection.db
    .collection('payrolls')
    .updateMany(
      { employeeType: { $exists: false } },
      { $set: { employeeType: 'User' } }
    );
  console.log(`Updated ${result.modifiedCount} payroll records (matched ${result.matchedCount}).`);
  await mongoose.disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
