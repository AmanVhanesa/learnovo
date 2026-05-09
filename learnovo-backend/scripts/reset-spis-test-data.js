/**
 * SPIS Production Tenant — Test Data Reset
 *
 * Wipes student-side test data so SPIS can be re-onboarded fresh:
 *   - All students (User role:'student') and student-linked records
 *   - All invoices (paid + unpaid), receipts, payments, payment attempts
 *   - All TCs / LCs / Bonafide certificates issued
 *   - Resets Counter sequences (invoice, receipt, student_receipt,
 *     cert_tc, cert_bonafide, admission) to 0 by deleting them — next
 *     getNextSequence upsert starts at 1.
 *
 * Does NOT touch:
 *   - Employees, admins, teachers, drivers, support staff (any non-student User)
 *   - Drivers / Vehicles / Routes (employee transport infrastructure)
 *   - Payroll, AdvanceSalary, Expenses, ExpenseCategory, ExpenseBudget
 *   - Manually-entered Income (only auto-synced fee_payment Income deleted)
 *   - Classes, Sections, Subjects, FeeStructure, AcademicSession, Settings
 *   - Timetables, Holidays, Announcements, Notifications (non-student)
 *   - CertificateTemplate, Homework (assignments), Exam (definitions)
 *
 * Usage:
 *   node scripts/reset-spis-test-data.js --dry-run     (counts only, no writes)
 *   node scripts/reset-spis-test-data.js --confirm     (perform deletion)
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const SCHOOL_CODE = 'spis';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CONFIRM = args.includes('--confirm');

if (!DRY_RUN && !CONFIRM) {
  console.error('Refusing to run without --dry-run or --confirm flag.');
  console.error('Usage:');
  console.error('  node scripts/reset-spis-test-data.js --dry-run');
  console.error('  node scripts/reset-spis-test-data.js --confirm');
  process.exit(1);
}

// Required models
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Counter = require('../models/Counter');
const GeneratedCertificate = require('../models/GeneratedCertificate');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
const StudentBalance = require('../models/StudentBalance');
const Fee = require('../models/Fee');
const Result = require('../models/Result');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const Income = require('../models/Income');

// Optional models — load defensively
function safeRequire(path) {
  try {
    return require(path);
  } catch (e) {
    return null;
  }
}
const Receipt = safeRequire('../models/Receipt');
const PaymentAttempt = safeRequire('../models/PaymentAttempt');
const FeePaymentOrder = safeRequire('../models/FeePaymentOrder');
const PaymentDispute = safeRequire('../models/PaymentDispute');
const FeeAuditLog = safeRequire('../models/FeeAuditLog');
const PaymentAuditLog = safeRequire('../models/PaymentAuditLog');
const HomeworkSubmission = safeRequire('../models/HomeworkSubmission');
const StudentClassHistory = safeRequire('../models/StudentClassHistory');
const StudentTransportAssignment = safeRequire('../models/StudentTransportAssignment');
const Family = safeRequire('../models/Family');
const Admission = safeRequire('../models/Admission');
const StudentList = safeRequire('../models/StudentList');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.');
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'CONFIRM (will delete)'}\n`);

  const tenant = await Tenant.findOne({ schoolCode: SCHOOL_CODE });
  if (!tenant) {
    console.error(`FATAL: Tenant "${SCHOOL_CODE}" not found.`);
    process.exit(1);
  }
  const tenantId = tenant._id;
  console.log(`Tenant: ${tenant.schoolName} (${tenant.subdomain || 'no subdomain'})`);
  console.log(`TenantId: ${tenantId}\n`);

  const studentIds = await User.find({ tenantId, role: 'student' }).distinct('_id');

  // Pre-counts for everything we will / will not touch
  const employeeCountBefore = await User.countDocuments({ tenantId, role: { $ne: 'student' } });
  const driversCount = await mongoose.connection.collection('drivers').countDocuments({ tenantId });
  const vehiclesCount = await mongoose.connection.collection('vehicles').countDocuments({ tenantId });
  const routesCount = await mongoose.connection.collection('routes').countDocuments({ tenantId });
  const payrollCount = await mongoose.connection.collection('payrolls').countDocuments({ tenantId });
  const expenseCount = await mongoose.connection.collection('expenses').countDocuments({ tenantId });

  const plan = [
    ['Students',                 () => User.countDocuments({ tenantId, role: 'student' }),
      () => User.deleteMany({ tenantId, role: 'student' })],
    ['Generated Certificates',   () => GeneratedCertificate.countDocuments({ tenantId }),
      () => GeneratedCertificate.deleteMany({ tenantId })],
    ['Fee Invoices',             () => FeeInvoice.countDocuments({ tenantId }),
      () => FeeInvoice.deleteMany({ tenantId })],
    ['Receipts',                 Receipt && (() => Receipt.countDocuments({ tenantId })),
      Receipt && (() => Receipt.deleteMany({ tenantId }))],
    ['Payments',                 () => Payment.countDocuments({ tenantId }),
      () => Payment.deleteMany({ tenantId })],
    ['Payment Attempts',         PaymentAttempt && (() => PaymentAttempt.countDocuments({ tenantId })),
      PaymentAttempt && (() => PaymentAttempt.deleteMany({ tenantId }))],
    ['Fee Payment Orders',       FeePaymentOrder && (() => FeePaymentOrder.countDocuments({ tenantId })),
      FeePaymentOrder && (() => FeePaymentOrder.deleteMany({ tenantId }))],
    ['Payment Disputes',         PaymentDispute && (() => PaymentDispute.countDocuments({ tenantId })),
      PaymentDispute && (() => PaymentDispute.deleteMany({ tenantId }))],
    ['Fee Audit Logs',           FeeAuditLog && (() => FeeAuditLog.countDocuments({ tenantId })),
      FeeAuditLog && (() => FeeAuditLog.deleteMany({ tenantId }))],
    ['Payment Audit Logs',       PaymentAuditLog && (() => PaymentAuditLog.countDocuments({ tenantId })),
      PaymentAuditLog && (() => PaymentAuditLog.deleteMany({ tenantId }))],
    ['Annual Fee Allocations',   () => AnnualFeeAllocation.countDocuments({ tenantId }),
      () => AnnualFeeAllocation.deleteMany({ tenantId })],
    ['Student Balances',         () => StudentBalance.countDocuments({ tenantId }),
      () => StudentBalance.deleteMany({ tenantId })],
    ['Legacy Fees',              () => Fee.countDocuments({ tenantId }),
      () => Fee.deleteMany({ tenantId })],
    ['Income (fee_payment only)', () => Income.countDocuments({ tenantId, referenceType: 'fee_payment' }),
      () => Income.deleteMany({ tenantId, referenceType: 'fee_payment' })],
    ['Exam Results',             () => Result.countDocuments({ tenantId }),
      () => Result.deleteMany({ tenantId })],
    ['Attendance Records',       () => Attendance.countDocuments({ tenantId }),
      () => Attendance.deleteMany({ tenantId })],
    ['Homework Submissions',     HomeworkSubmission && (() => HomeworkSubmission.countDocuments({ tenantId })),
      HomeworkSubmission && (() => HomeworkSubmission.deleteMany({ tenantId }))],
    ['Student Class Histories',  StudentClassHistory && (() => StudentClassHistory.countDocuments({ tenantId })),
      StudentClassHistory && (() => StudentClassHistory.deleteMany({ tenantId }))],
    ['Student Transport Assignments', StudentTransportAssignment && (() => StudentTransportAssignment.countDocuments({ tenantId })),
      StudentTransportAssignment && (() => StudentTransportAssignment.deleteMany({ tenantId }))],
    ['Families',                 Family && (() => Family.countDocuments({ tenantId })),
      Family && (() => Family.deleteMany({ tenantId }))],
    ['Admissions',               Admission && (() => Admission.countDocuments({ tenantId })),
      Admission && (() => Admission.deleteMany({ tenantId }))],
    ['Student Lists',            StudentList && (() => StudentList.countDocuments({ tenantId })),
      StudentList && (() => StudentList.deleteMany({ tenantId }))],
    ['Student Notifications',    () => studentIds.length ? Notification.countDocuments({ tenantId, userId: { $in: studentIds } }) : Promise.resolve(0),
      () => studentIds.length ? Notification.deleteMany({ tenantId, userId: { $in: studentIds } }) : Promise.resolve({ deletedCount: 0 })],
    ['Counters (invoice/receipt/cert/admission — reset to 0)',
      () => Counter.countDocuments({ tenantId }),
      () => Counter.deleteMany({ tenantId })]
  ];

  console.log('=== PRE-DELETION COUNTS (SPIS only) ===');
  const counts = {};
  for (const [label, countFn] of plan) {
    if (!countFn) {
      console.log(`  ${label}: (model not loaded — skipped)`); continue;
    }
    counts[label] = await countFn();
    console.log(`  ${label}: ${counts[label]}`);
  }

  console.log('\n=== PRESERVED (must be unchanged) ===');
  console.log(`  Employees/staff (non-student Users): ${employeeCountBefore}`);
  console.log(`  Drivers: ${driversCount}`);
  console.log(`  Vehicles: ${vehiclesCount}`);
  console.log(`  Routes: ${routesCount}`);
  console.log(`  Payrolls: ${payrollCount}`);
  console.log(`  Expenses: ${expenseCount}`);

  if (DRY_RUN) {
    console.log('\nDry-run complete. No data was modified.');
    console.log('Re-run with --confirm to actually delete.');
    process.exit(0);
  }

  console.log('\n=== STARTING DELETION (5s pause — Ctrl+C to abort) ===');
  await new Promise(r => setTimeout(r, 5000));

  const results = {};
  for (const [label, , delFn] of plan) {
    if (!delFn) continue;
    const r = await delFn();
    results[label] = (r && typeof r.deletedCount === 'number') ? r.deletedCount : 0;
    console.log(`  Deleted ${label}: ${results[label]}`);
  }

  console.log('\n=== POST-DELETION VERIFICATION ===');
  const remStudents = await User.countDocuments({ tenantId, role: 'student' });
  const remEmployees = await User.countDocuments({ tenantId, role: { $ne: 'student' } });
  const remDrivers = await mongoose.connection.collection('drivers').countDocuments({ tenantId });
  const remVehicles = await mongoose.connection.collection('vehicles').countDocuments({ tenantId });
  const remRoutes = await mongoose.connection.collection('routes').countDocuments({ tenantId });
  const remPayrolls = await mongoose.connection.collection('payrolls').countDocuments({ tenantId });
  const remExpenses = await mongoose.connection.collection('expenses').countDocuments({ tenantId });

  console.log(`  Remaining students: ${remStudents} (expected 0)`);
  console.log(`  Remaining employees: ${remEmployees} (expected ${employeeCountBefore})`);
  console.log(`  Remaining drivers: ${remDrivers} (expected ${driversCount})`);
  console.log(`  Remaining vehicles: ${remVehicles} (expected ${vehiclesCount})`);
  console.log(`  Remaining routes: ${remRoutes} (expected ${routesCount})`);
  console.log(`  Remaining payrolls: ${remPayrolls} (expected ${payrollCount})`);
  console.log(`  Remaining expenses: ${remExpenses} (expected ${expenseCount})`);

  const mismatch =
    remStudents !== 0 ||
    remEmployees !== employeeCountBefore ||
    remDrivers !== driversCount ||
    remVehicles !== vehiclesCount ||
    remRoutes !== routesCount ||
    remPayrolls !== payrollCount ||
    remExpenses !== expenseCount;

  if (mismatch) {
    console.error('\n  WARNING: Preserved-collection count mismatch. Investigate before further action.');
    process.exit(2);
  }
  console.log('\n  All preserved collections intact.');
  process.exit(0);
}

run().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
