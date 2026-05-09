#!/usr/bin/env node
/**
 * Test fee import for a single student against the SPIS tenant.
 *
 * Usage:
 *   node test-import-one.js --admission 6121               # preview only (safe)
 *   node test-import-one.js --admission 6121 --execute     # actually create records
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') });

const Tenant = require('../../models/Tenant');
const User = require('../../models/User');
const AcademicSession = require('../../models/AcademicSession');
const AnnualFeeAllocation = require('../../models/AnnualFeeAllocation');
const FeeInvoice = require('../../models/FeeInvoice');
const Payment = require('../../models/Payment');
const FeeImportService = require('../../services/feeImportService');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { execute: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--admission') out.admission = args[++i];
    else if (args[i] === '--execute') out.execute = true;
  }
  if (!out.admission) {
    console.error('Usage: --admission <admissionNumber> [--execute]');
    process.exit(1);
  }
  return out;
}

(async () => {
  const { admission, execute } = parseArgs();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB\n');

  // 1. Find SPIS tenant
  const tenant = await Tenant.findOne({
    $or: [{ schoolCode: /spis/i }, { subdomain: /spis/i }, { schoolName: /spis/i }]
  }).lean();
  if (!tenant) {
    console.error('❌ SPIS tenant not found.');
    process.exit(1);
  }
  console.log(`✓ Tenant: ${tenant.schoolName} (${tenant.schoolCode})`);

  // 2. Verify student exists
  const student = await User.findOne({
    tenantId: tenant._id,
    role: 'student',
    admissionNumber: admission,
  }).select('_id firstName lastName name admissionNumber classId sectionId').lean();
  if (!student) {
    console.error(`❌ Student with admissionNumber ${admission} not found in SPIS tenant.`);
    console.error('   Make sure students are imported before running fee import.');
    process.exit(1);
  }
  const studentName = student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim();
  console.log(`✓ Student: ${studentName} (${admission})`);

  // 3. Verify active session exists
  const session = await AcademicSession.findOne({ tenantId: tenant._id, name: '2026-2027' }).lean();
  if (!session) {
    console.error('❌ Academic session "2026-2027" not found in SPIS tenant.');
    process.exit(1);
  }
  console.log(`✓ Session: ${session.name} (active: ${session.isActive})`);

  // 4. Check if allocation already exists (would block import)
  const existing = await AnnualFeeAllocation.findOne({
    tenantId: tenant._id,
    studentId: student._id,
    academicSessionId: session._id,
  }).lean();
  if (existing) {
    console.error(`\n❌ Allocation already exists for this student in ${session.name}.`);
    console.error(`   Allocation ID: ${existing._id}`);
    console.error('   Delete it from the DB before re-running this test.');
    process.exit(1);
  }
  console.log('✓ No existing allocation (clean slate)\n');

  // 5. Build a 1-student CSV from learnovo-fees.csv
  const csvPath = path.join(__dirname, 'learnovo-fees.csv');
  const lines = fs.readFileSync(csvPath, 'utf8').split('\n');
  const header = lines[0];
  const matched = lines.filter((line, i) => i > 0 && line.startsWith(`${admission},`));
  if (matched.length === 0) {
    console.error(`❌ No rows for admission ${admission} in learnovo-fees.csv`);
    process.exit(1);
  }
  const tempPath = path.join(os.tmpdir(), `spis-test-${admission}.csv`);
  fs.writeFileSync(tempPath, [header, ...matched].join('\n') + '\n');
  console.log(`Test rows for ${admission}:`);
  matched.forEach(r => {
    const cols = r.split(',');
    console.log(`  - ${cols[1]}: ₹${cols[3]} annual / ₹${cols[4]} paid (${cols[6]})`);
  });
  console.log('');

  // 6. Run preview
  console.log('--- PREVIEW ---');
  const preview = await FeeImportService.previewImport(tempPath, tenant._id);
  console.log(`Rows: ${preview.summary.totalRows} total, ${preview.summary.validRows} valid, ${preview.summary.invalidRows} invalid`);
  if (preview.errors.length > 0) {
    console.log('\nErrors:');
    preview.errors.forEach(e => console.log(`  ❌ Row ${e.row}, field "${e.field}": ${e.message}`));
    console.log('\nFix errors before running with --execute.');
    process.exit(1);
  }
  console.log('✓ All rows valid\n');

  if (!execute) {
    console.log('--- DRY RUN COMPLETE ---');
    console.log('Re-run with --execute to actually create records.');
    process.exit(0);
  }

  // 7. Execute
  console.log('--- EXECUTING ---');
  // We need a userId for "generatedBy". Find an admin user in this tenant.
  const adminUser = await User.findOne({ tenantId: tenant._id, role: 'admin' }).select('_id').lean();
  if (!adminUser) {
    console.error('❌ No admin user found in SPIS tenant — needed for "generatedBy" field.');
    process.exit(1);
  }
  const result = await FeeImportService.executeImport(preview.validData, tenant._id, adminUser._id);
  console.log('Result:', JSON.stringify(result, null, 2));

  // 8. Show what got created
  console.log('\n--- VERIFICATION ---');
  const allocation = await AnnualFeeAllocation.findOne({
    tenantId: tenant._id, studentId: student._id, academicSessionId: session._id,
  }).lean();
  const invoice = allocation
    ? await FeeInvoice.findOne({ annualAllocationId: allocation._id }).lean()
    : null;
  const payments = invoice
    ? await Payment.find({ invoiceId: invoice._id }).lean()
    : [];

  if (allocation) {
    console.log(`✓ Allocation: ₹${allocation.totalAnnualAmount} annual, ₹${allocation.totalPaid} paid, ₹${allocation.balance} balance`);
    console.log(`  Fee heads: ${allocation.allocatedFeeHeads.map(h => `${h.feeHeadName} (₹${h.annualAmount})`).join(', ')}`);
  }
  if (invoice) {
    console.log(`✓ Invoice: ${invoice.invoiceNumber}, status=${invoice.status}, total=₹${invoice.totalAmount}, paid=₹${invoice.paidAmount}`);
  }
  if (payments.length > 0) {
    payments.forEach(p => {
      console.log(`✓ Payment: ${p.receiptNumber}, ₹${p.amount} via ${p.paymentMethod}`);
    });
  }
  console.log('\n✅ Done. Check this student in the Learnovo UI to verify.');

  await mongoose.disconnect();
})().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
