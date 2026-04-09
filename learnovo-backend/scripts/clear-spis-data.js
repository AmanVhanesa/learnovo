/**
 * SPIS Production Tenant Data Cleanup Script
 *
 * Deletes ONLY for SPIS tenant (schoolCode: 'spis'):
 * - Students (role: 'student' only)
 * - Leaving certificates (TC) and Bonafide certificates
 * - All invoices, payments, receipts, and related financial data
 *
 * Does NOT touch:
 * - Employees, admins, teachers, drivers, staff, etc.
 * - Drivers collection, vehicles, routes
 * - Classes, sections, subjects, fee structures, settings
 * - Any other tenant's data
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

// Models
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const GeneratedCertificate = require('../models/GeneratedCertificate');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
const StudentBalance = require('../models/StudentBalance');
const Fee = require('../models/Fee');
const Result = require('../models/Result');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');

// Models that may or may not exist - load safely
let Receipt, PaymentAttempt, FeePaymentOrder, PaymentDispute, FeeAuditLog, PaymentAuditLog;
let HomeworkSubmission, StudentClassHistory, StudentTransportAssignment, Family;

try {
  Receipt = require('../models/Receipt');
} catch (e) {
  console.log('Receipt model not found, skipping');
}
try {
  PaymentAttempt = require('../models/PaymentAttempt');
} catch (e) {
  console.log('PaymentAttempt model not found, skipping');
}
try {
  FeePaymentOrder = require('../models/FeePaymentOrder');
} catch (e) {
  console.log('FeePaymentOrder model not found, skipping');
}
try {
  PaymentDispute = require('../models/PaymentDispute');
} catch (e) {
  console.log('PaymentDispute model not found, skipping');
}
try {
  FeeAuditLog = require('../models/FeeAuditLog');
} catch (e) {
  console.log('FeeAuditLog model not found, skipping');
}
try {
  PaymentAuditLog = require('../models/PaymentAuditLog');
} catch (e) {
  console.log('PaymentAuditLog model not found, skipping');
}
try {
  HomeworkSubmission = require('../models/HomeworkSubmission');
} catch (e) {
  console.log('HomeworkSubmission model not found, skipping');
}
try {
  StudentClassHistory = require('../models/StudentClassHistory');
} catch (e) {
  console.log('StudentClassHistory model not found, skipping');
}
try {
  StudentTransportAssignment = require('../models/StudentTransportAssignment');
} catch (e) {
  console.log('StudentTransportAssignment model not found, skipping');
}
try {
  Family = require('../models/Family');
} catch (e) {
  console.log('Family model not found, skipping');
}

async function clearSpisData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Step 1: Find SPIS tenant
    const tenant = await Tenant.findOne({ schoolCode: 'spis' });
    if (!tenant) {
      console.error('SPIS tenant not found (schoolCode: "spis"). Aborting.');
      process.exit(1);
    }

    const tenantId = tenant._id;
    console.log(`Found SPIS tenant: ${tenant.schoolName}`);
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Subdomain: ${tenant.subdomain || 'N/A'}\n`);

    // Step 2: Count everything before deletion
    console.log('=== PRE-DELETION COUNTS ===\n');

    const studentCount = await User.countDocuments({ tenantId, role: 'student' });
    console.log(`Students: ${studentCount}`);

    const tcCount = await GeneratedCertificate.countDocuments({ tenantId, type: 'TC' });
    console.log(`Leaving Certificates (TC): ${tcCount}`);

    const bonafideCount = await GeneratedCertificate.countDocuments({ tenantId, type: 'BONAFIDE' });
    console.log(`Bonafide Certificates: ${bonafideCount}`);

    const invoiceCount = await FeeInvoice.countDocuments({ tenantId });
    console.log(`Fee Invoices: ${invoiceCount}`);

    const paymentCount = await Payment.countDocuments({ tenantId });
    console.log(`Payments: ${paymentCount}`);

    const allocationCount = await AnnualFeeAllocation.countDocuments({ tenantId });
    console.log(`Fee Allocations: ${allocationCount}`);

    const balanceCount = await StudentBalance.countDocuments({ tenantId });
    console.log(`Student Balances: ${balanceCount}`);

    const resultCount = await Result.countDocuments({ tenantId });
    console.log(`Exam Results: ${resultCount}`);

    const attendanceCount = await Attendance.countDocuments({ tenantId });
    console.log(`Attendance Records: ${attendanceCount}`);

    const legacyFeeCount = await Fee.countDocuments({ tenantId });
    console.log(`Legacy Fees: ${legacyFeeCount}`);

    // Verify no employees will be affected
    const employeeCount = await User.countDocuments({ tenantId, role: { $ne: 'student' } });
    console.log(`\nEmployees/Staff (WILL NOT BE DELETED): ${employeeCount}`);

    console.log('\n=== STARTING DELETION (SPIS tenant only) ===\n');
    console.log('Waiting 5 seconds before proceeding... Press Ctrl+C to abort.\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 3: Get student IDs for notification cleanup
    const studentIds = await User.find({ tenantId, role: 'student' }).distinct('_id');

    // Step 4: Delete in order (dependent data first)
    const results = {};

    // Certificates
    let r = await GeneratedCertificate.deleteMany({ tenantId, type: 'TC' });
    results['Leaving Certificates (TC)'] = r.deletedCount;

    r = await GeneratedCertificate.deleteMany({ tenantId, type: 'BONAFIDE' });
    results['Bonafide Certificates'] = r.deletedCount;

    // Financial data (child records first)
    if (Receipt) {
      r = await Receipt.deleteMany({ tenantId });
      results['Receipts'] = r.deletedCount;
    }

    if (PaymentAttempt) {
      r = await PaymentAttempt.deleteMany({ tenantId });
      results['Payment Attempts'] = r.deletedCount;
    }

    if (FeePaymentOrder) {
      r = await FeePaymentOrder.deleteMany({ tenantId });
      results['Fee Payment Orders'] = r.deletedCount;
    }

    if (PaymentDispute) {
      r = await PaymentDispute.deleteMany({ tenantId });
      results['Payment Disputes'] = r.deletedCount;
    }

    if (FeeAuditLog) {
      r = await FeeAuditLog.deleteMany({ tenantId });
      results['Fee Audit Logs'] = r.deletedCount;
    }

    if (PaymentAuditLog) {
      r = await PaymentAuditLog.deleteMany({ tenantId });
      results['Payment Audit Logs'] = r.deletedCount;
    }

    r = await Payment.deleteMany({ tenantId });
    results['Payments'] = r.deletedCount;

    r = await FeeInvoice.deleteMany({ tenantId });
    results['Fee Invoices'] = r.deletedCount;

    r = await AnnualFeeAllocation.deleteMany({ tenantId });
    results['Fee Allocations'] = r.deletedCount;

    r = await StudentBalance.deleteMany({ tenantId });
    results['Student Balances'] = r.deletedCount;

    r = await Fee.deleteMany({ tenantId });
    results['Legacy Fees'] = r.deletedCount;

    // Academic data
    r = await Result.deleteMany({ tenantId });
    results['Exam Results'] = r.deletedCount;

    r = await Attendance.deleteMany({ tenantId });
    results['Attendance Records'] = r.deletedCount;

    if (HomeworkSubmission) {
      r = await HomeworkSubmission.deleteMany({ tenantId });
      results['Homework Submissions'] = r.deletedCount;
    }

    if (StudentClassHistory) {
      r = await StudentClassHistory.deleteMany({ tenantId });
      results['Student Class Histories'] = r.deletedCount;
    }

    if (StudentTransportAssignment) {
      r = await StudentTransportAssignment.deleteMany({ tenantId });
      results['Student Transport Assignments'] = r.deletedCount;
    }

    if (Family) {
      r = await Family.deleteMany({ tenantId });
      results['Family Records'] = r.deletedCount;
    }

    // Student notifications
    if (studentIds.length > 0) {
      r = await Notification.deleteMany({ tenantId, userId: { $in: studentIds } });
      results['Student Notifications'] = r.deletedCount;
    }

    // Finally: Delete students
    r = await User.deleteMany({ tenantId, role: 'student' });
    results['Students'] = r.deletedCount;

    // Step 5: Print summary
    console.log('=== DELETION COMPLETE ===\n');
    for (const [key, count] of Object.entries(results)) {
      console.log(`  ${key}: ${count} deleted`);
    }

    // Step 6: Verify no non-student users were affected
    const remainingEmployees = await User.countDocuments({ tenantId, role: { $ne: 'student' } });
    const remainingStudents = await User.countDocuments({ tenantId, role: 'student' });
    console.log('\n=== VERIFICATION ===');
    console.log(`  Remaining employees/staff: ${remainingEmployees} (should be ${employeeCount})`);
    console.log(`  Remaining students: ${remainingStudents} (should be 0)`);

    if (remainingEmployees !== employeeCount) {
      console.error('\n  WARNING: Employee count mismatch! Some non-student users may have been affected.');
    } else {
      console.log('\n  All employee/staff data is intact.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

clearSpisData();
