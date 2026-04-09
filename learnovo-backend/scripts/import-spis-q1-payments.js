/**
 * Import Q1 (Apr-Jun) paid fees from old ERP into Learnovo for SPIS tenant.
 *
 * SPIS PRODUCTION ONLY — hardcoded to schoolCode: 'spis'.
 *
 * This script is IDEMPOTENT — safe to run multiple times.
 * It tracks imported receipts by storing the old ERP receipt as
 * "SPIS-OLD-{Series}-{ReceiptNo}" in the Payment.receiptNumber field.
 * Already-imported receipts are skipped on re-run.
 *
 * Assumes:
 *   1. Students are imported into Learnovo with old ERP "Reg No." as admissionNumber
 *   2. Fee structures + allocations + quarterly invoices are generated
 *   3. Q1 (Apr-Jun) invoices exist with billingPeriod.quarter === 1
 *
 * CSV format (exported from old ERP "Daily Collection Report"):
 *   Date, Series, ReceiptNo, RegNo, StudentName, GrossFees, Concession,
 *   Discount, Cash, Bank, Card
 *
 * Minimal required columns: RegNo, GrossFees (or Cash+Bank+Card)
 *
 * Usage:
 *   node scripts/import-spis-q1-payments.js <csv-file> [--dry-run]
 *
 * Examples:
 *   node scripts/import-spis-q1-payments.js ./data/spis-apr-1-10.csv --dry-run
 *   node scripts/import-spis-q1-payments.js ./data/spis-apr-1-10.csv
 *   # Run again with new data — already-imported receipts are skipped:
 *   node scripts/import-spis-q1-payments.js ./data/spis-apr-11-30.csv
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');

const Tenant = require('../models/Tenant');
const User = require('../models/User');
const AcademicSession = require('../models/AcademicSession');
const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
const FeeInvoice = require('../models/FeeInvoice');
const Payment = require('../models/Payment');
const { syncFeePaymentToIncome } = require('../services/financeAutoSyncService');
const { roundToRupee, toNumber } = require('../utils/money');

// ── SPIS-only config ────────────────────────────────────────────────────────
const SCHOOL_CODE = 'spis';
const RECEIPT_PREFIX = 'SPIS-OLD'; // Prefix for imported receipt numbers
const Q1_QUARTER = 1; // billingPeriod.quarter for Q1 (Apr-Jun)

// ── Parse CSV (handles old ERP export with junk header rows + BOM) ───────────
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    // Read file, strip BOM, find the real header row containing "Reg No"
    let content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const lines = content.split('\n');
    const headerIdx = lines.findIndex(l => /Reg No/i.test(l));
    if (headerIdx === -1) {
      return reject(new Error('Could not find header row with "Reg No" in CSV'));
    }
    // Rebuild CSV from header row onward
    const cleanCsv = lines.slice(headerIdx).join('\n');

    const rows = [];
    const stream = require('stream');
    const readable = new stream.Readable();
    readable.push(cleanCsv);
    readable.push(null);

    readable
      .pipe(csvParser())
      .on('data', (raw) => {
        // Normalise keys: trim, lowercase, remove spaces/underscores/dots
        const norm = {};
        for (const [key, value] of Object.entries(raw)) {
          const k = key.trim().toLowerCase().replace(/[\s_/.]+/g, '');
          norm[k] = typeof value === 'string' ? value.trim() : value;
        }

        // Map old ERP columns to our fields
        const date = norm.date || '';
        const series = norm.series || 'UNKNOWN';
        const receiptNo = norm.receiptno || norm.receipt || norm.receiptnumber || '';
        const regNo = norm.regno || norm.regnonumber || norm.registrationnumber || norm.admissionnumber || '';
        const studentName = norm.studentname || norm.student || '';
        const fatherName = norm.fathername || norm.father || '';
        const className = norm.class || '';
        const section = norm.section || '';

        // Financial columns
        const grossFees = parseFloat(norm.grossfees || norm.gross || '0') || 0;
        const addOn = parseFloat(norm.addon || norm.addon || '0') || 0;
        const concession = parseFloat(norm.concession || '0') || 0;
        const lateExtra = parseFloat(norm.lateextrafees || norm.latefees || norm.extrafees || '0') || 0;
        const discount = parseFloat(norm.discount || '0') || 0;
        const cash = parseFloat(norm.cash || '0') || 0;
        const bank = parseFloat(norm.bank || '0') || 0;
        const card = parseFloat(norm.card || '0') || 0;
        const balAmt = parseFloat(norm.balamt || norm.balance || '0') || 0;

        // Calculate paid amount from payment columns
        const paidFromColumns = roundToRupee(cash + bank + card);
        // Fallback: if Cash/Bank/Card are all 0, calculate from gross
        const paidCalculated = roundToRupee(grossFees + addOn - concession + lateExtra - discount);
        const paidAmount = paidFromColumns > 0 ? paidFromColumns : Math.max(0, paidCalculated);

        // Determine payment method
        let paymentMethod = 'Online';
        if (cash > 0 && bank === 0 && card === 0) paymentMethod = 'Cash';
        else if (bank > 0 && cash === 0 && card === 0) paymentMethod = 'Bank Transfer';
        else if (card > 0 && cash === 0 && bank === 0) paymentMethod = 'Card';
        else if (cash > 0 && bank > 0) paymentMethod = 'Cash'; // Mixed — default to cash
        else if (series.toUpperCase() === 'MAIN') paymentMethod = 'Cash';
        else if (series.toUpperCase() === 'ONLINE') paymentMethod = 'Bank Transfer';

        rows.push({
          date,
          series,
          receiptNo,
          regNo,
          studentName,
          fatherName,
          className,
          section,
          grossFees,
          discount,
          concession,
          paidAmount,
          paymentMethod,
          balAmt,
          cash,
          bank,
          card
        });
      })
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// Build unique receipt key from old ERP data
function buildReceiptKey(series, receiptNo) {
  const s = (series || 'UNKNOWN').toUpperCase().trim();
  const r = String(receiptNo || '0').trim();
  return `${RECEIPT_PREFIX}-${s}-${r}`;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const csvPath = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!csvPath) {
    console.error('Usage: node scripts/import-spis-q1-payments.js <csv-file> [--dry-run]');
    console.error('');
    console.error('CSV columns (from old ERP Daily Collection Report):');
    console.error('  Date, Series, ReceiptNo, RegNo, StudentName, FatherName,');
    console.error('  Phone, Class, Section, Type, GrossFees, AddOn, Concession,');
    console.error('  LateExtraFees, Discount, Cash, Bank, Card, BalAmt');
    process.exit(1);
  }

  const resolvedPath = path.resolve(csvPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`File not found: ${resolvedPath}`);
    process.exit(1);
  }

  // ── Connect ─────────────────────────────────────────────────────────
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // ── Verify SPIS tenant ──────────────────────────────────────────────
  const tenant = await Tenant.findOne({ schoolCode: SCHOOL_CODE });
  if (!tenant) {
    console.error(`FATAL: Tenant "${SCHOOL_CODE}" not found. This script is SPIS-only.`);
    process.exit(1);
  }
  const tenantId = tenant._id;
  console.log(`Tenant: ${tenant.schoolName} (${tenant.schoolCode})`);

  // ── Active session ──────────────────────────────────────────────────
  const session = await AcademicSession.findOne({ tenantId, isActive: true });
  if (!session) {
    console.error('FATAL: No active academic session for SPIS.');
    process.exit(1);
  }
  console.log(`Academic Session: ${session.name}`);

  // ── Admin user for collectedBy ──────────────────────────────────────
  const admin = await User.findOne({ tenantId, role: 'admin', isActive: true })
    .select('_id name').lean();
  if (!admin) {
    console.error('FATAL: No active admin user for SPIS.');
    process.exit(1);
  }
  console.log(`Admin: ${admin.name}`);

  // ── Parse CSV ───────────────────────────────────────────────────────
  const rows = await parseCSV(resolvedPath);
  console.log(`\nParsed ${rows.length} rows from CSV`);

  // Filter out rows with no RegNo or zero payment
  const validRows = rows.filter(r => {
    if (!r.regNo) return false;
    if (r.paidAmount <= 0) return false;
    return true;
  });
  console.log(`Valid rows (with RegNo + paidAmount > 0): ${validRows.length}`);
  console.log(`Skipped: ${rows.length - validRows.length} (missing RegNo or zero amount)\n`);

  if (validRows.length === 0) {
    console.log('Nothing to import.');
    await mongoose.disconnect();
    process.exit(0);
  }

  if (dryRun) {
    console.log('═══════════════════════════════════════');
    console.log('  DRY RUN — no data will be written');
    console.log('═══════════════════════════════════════\n');
  }

  // ── Pre-fetch students by Reg No (admissionNumber) ──────────────────
  const regNos = [...new Set(validRows.map(r => String(r.regNo)))];
  const students = await User.find({
    tenantId,
    role: 'student',
    admissionNumber: { $in: regNos }
  }).select('_id admissionNumber name classId sectionId').lean();

  const studentMap = new Map();
  students.forEach(s => studentMap.set(s.admissionNumber, s));
  console.log(`Found ${students.length}/${regNos.length} students in Learnovo\n`);

  // ── Pre-fetch Q1 invoices ───────────────────────────────────────────
  const studentIds = students.map(s => s._id);
  const q1Invoices = await FeeInvoice.find({
    tenantId,
    academicSessionId: session._id,
    studentId: { $in: studentIds },
    'billingPeriod.quarter': Q1_QUARTER,
    status: { $ne: 'Cancelled' }
  });
  const invoiceMap = new Map();
  q1Invoices.forEach(inv => invoiceMap.set(String(inv.studentId), inv));

  // ── Pre-fetch already-imported receipts (for idempotency) ───────────
  const receiptKeys = validRows.map(r => buildReceiptKey(r.series, r.receiptNo));
  const existingPayments = await Payment.find({
    tenantId,
    receiptNumber: { $in: receiptKeys }
  }).select('receiptNumber').lean();
  const importedReceipts = new Set(existingPayments.map(p => p.receiptNumber));

  if (importedReceipts.size > 0) {
    console.log(`Already imported receipts found: ${importedReceipts.size} (will be skipped)\n`);
  }

  // ── Process rows ────────────────────────────────────────────────────
  const results = {
    created: 0,
    skippedDuplicate: 0,
    skippedPaid: 0,
    errors: []
  };

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    const rowNum = i + 1;
    const receiptKey = buildReceiptKey(row.series, row.receiptNo);

    // ── Dedup check ─────────────────────────────────────────────────
    if (importedReceipts.has(receiptKey)) {
      results.skippedDuplicate++;
      continue;
    }

    // ── Find student ────────────────────────────────────────────────
    const student = studentMap.get(String(row.regNo));
    if (!student) {
      results.errors.push({
        row: rowNum,
        regNo: row.regNo,
        name: row.studentName,
        error: `Student not found (RegNo: ${row.regNo})`
      });
      continue;
    }

    // ── Find Q1 invoice ─────────────────────────────────────────────
    const invoice = invoiceMap.get(String(student._id));
    if (!invoice) {
      results.errors.push({
        row: rowNum,
        regNo: row.regNo,
        name: row.studentName,
        error: 'Q1 (Apr-Jun) invoice not found — generate quarterly invoices first'
      });
      continue;
    }

    // ── Check if invoice is fully paid ──────────────────────────────
    if (invoice.status === 'Paid') {
      results.skippedPaid++;
      continue;
    }

    const paidAmount = roundToRupee(row.paidAmount);
    const paymentDate = row.date ? new Date(row.date) : new Date();
    const validDate = isNaN(paymentDate.getTime()) ? new Date() : paymentDate;

    if (dryRun) {
      console.log(`  [DRY] ${receiptKey} | RegNo ${row.regNo} (${row.studentName}) | ₹${paidAmount} via ${row.paymentMethod} → ${invoice.invoiceNumber}`);
      results.created++;
      importedReceipts.add(receiptKey); // Track in dry run too for dedup within same file
      continue;
    }

    // ── Create Payment ──────────────────────────────────────────────
    try {
      const payment = new Payment({
        tenantId,
        receiptNumber: receiptKey,
        studentId: student._id,
        invoiceId: invoice._id,
        amount: paidAmount,
        paymentMethod: row.paymentMethod,
        paymentDate: validDate,
        allocation: invoice.items.map(item => ({
          feeHeadName: item.feeHeadName,
          amount: roundToRupee(
            toNumber(item.netAmount || item.periodAmount || item.amount) *
            (paidAmount / toNumber(invoice.totalAmount))
          )
        })),
        remarks: `Old ERP import | ${row.series} #${row.receiptNo} | ${row.studentName} | ${row.className} ${row.section}`,
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedBy: admin._id,
        collectedBy: admin._id
      });

      await payment.save();

      // ── Update Invoice (additive — supports multiple payments) ────
      await invoice.recordPayment(paidAmount);

      // ── Recalculate Allocation ────────────────────────────────────
      if (invoice.annualAllocationId) {
        await AnnualFeeAllocation.recalculateFromInvoices(invoice.annualAllocationId);
      }

      // ── Finance sync (non-blocking) ───────────────────────────────
      try {
        await syncFeePaymentToIncome({
          tenantId,
          paymentId: payment._id,
          amount: paidAmount,
          paymentDate: validDate,
          paymentMethod: row.paymentMethod,
          studentName: student.name,
          invoiceNumber: invoice.invoiceNumber,
          addedBy: admin._id,
          paymentReference: receiptKey,
          referenceModel: 'Payment'
        });
      } catch (syncErr) {
        // Non-fatal
        console.warn(`  [WARN] Finance sync failed for ${row.regNo}: ${syncErr.message}`);
      }

      results.created++;
      importedReceipts.add(receiptKey);
      console.log(`  [OK] ${receiptKey} | RegNo ${row.regNo} | ₹${paidAmount} → ${invoice.invoiceNumber}`);

    } catch (err) {
      results.errors.push({
        row: rowNum,
        regNo: row.regNo,
        name: row.studentName,
        error: err.message
      });
      console.error(`  [ERR] ${receiptKey} | RegNo ${row.regNo} | ${err.message}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log('  SPIS Q1 PAYMENT IMPORT SUMMARY');
  console.log('═══════════════════════════════════════');
  console.log(`  Total CSV rows:        ${rows.length}`);
  console.log(`  Valid rows:            ${validRows.length}`);
  console.log(`  Payments created:      ${results.created}`);
  console.log(`  Skipped (duplicate):   ${results.skippedDuplicate}`);
  console.log(`  Skipped (already paid): ${results.skippedPaid}`);
  console.log(`  Errors:                ${results.errors.length}`);

  if (dryRun) {
    console.log('\n  ⚠ DRY RUN — nothing was written to the database');
    console.log('  Remove --dry-run to execute for real.');
  }

  if (results.errors.length > 0) {
    console.log('\n  Errors:');
    results.errors.forEach(e => {
      console.log(`    Row ${e.row}: RegNo ${e.regNo} (${e.name}) — ${e.error}`);
    });
  }

  console.log('');
  await mongoose.disconnect();
  process.exit(results.errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
