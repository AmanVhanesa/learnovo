/**
 * Teardown for seed-spis-class1-test-exams.js
 * Deletes every Exam tagged with "[TEST-SEED]" for SPIS Class 1 ROSE,
 * and all Results that reference those exams.
 *
 * Usage:
 *   node scripts/delete-spis-class1-test-exams.js
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const Exam = require('../models/Exam');
const Result = require('../models/Result');

const SCHOOL_CODE = 'spis';
const CLASS_NAME = 'Class 1';
const SECTION_NAME = 'ROSE';
const TAG = '[TEST-SEED]';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: SCHOOL_CODE });
  if (!tenant) throw new Error(`Tenant ${SCHOOL_CODE} not found`);

  const exams = await Exam.find({
    tenantId: tenant._id,
    class: CLASS_NAME,
    section: SECTION_NAME,
    description: { $regex: TAG, $options: 'i' }
  }).select('_id name subject').lean();

  if (!exams.length) {
    console.log('No tagged test exams found. Nothing to delete.');
    await mongoose.disconnect();
    return;
  }

  const examIds = exams.map(e => e._id);
  const resDel = await Result.deleteMany({ tenantId: tenant._id, exam: { $in: examIds } });
  const examDel = await Exam.deleteMany({ _id: { $in: examIds } });

  console.log(`Deleted ${examDel.deletedCount} exams and ${resDel.deletedCount} results.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('FAILED:', err); process.exit(1);
});
