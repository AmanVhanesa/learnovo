#!/usr/bin/env node
/**
 * Payments-only importer for SPIS migration.
 *
 * Reads the original SPIS daily-collection CSV and creates Payment records
 * against the student's existing invoices (oldest-first allocation).
 *
 * Does NOT create allocations or invoices — assumes those already exist.
 * Does NOT handle concession/discount (yet) — flags those receipts and skips them.
 *
 * Usage:
 *   # Dry-run for one student (no DB writes):
 *   node import-spis-payments.js --input FEES_IMPORT.csv --admission 6121
 *
 *   # Execute for one student:
 *   node import-spis-payments.js --input FEES_IMPORT.csv --admission 6121 --execute
 *
 *   # Dry-run for all students:
 *   node import-spis-payments.js --input FEES_IMPORT.csv
 *
 *   # Execute for all students (after dry-run looks clean):
 *   node import-spis-payments.js --input FEES_IMPORT.csv --execute
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') });

const Tenant = require('../../models/Tenant');
const User = require('../../models/User');
const AcademicSession = require('../../models/AcademicSession');
const AnnualFeeAllocation = require('../../models/AnnualFeeAllocation');
const FeeInvoice = require('../../models/FeeInvoice');
const Payment = require('../../models/Payment');
const { roundToRupee, toNumber } = require('../../utils/money');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { execute: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input') out.input = args[++i];
    else if (args[i] === '--admission') out.admission = args[++i];
    else if (args[i] === '--execute') out.execute = true;
    else if (args[i] === '--session') out.session = args[++i];
  }
  if (!out.input) {
    console.error('Usage: --input <spis.csv> [--admission <regNo>] [--session 2026-2027] [--execute]');
    process.exit(1);
  }
  out.session = out.session || '2026-2027';
  return out;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'; i++;
        } else inQuotes = false;
      } else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\r') { /* skip */ } else if (ch === '\n') {
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field); rows.push(row);
  }
  return rows;
}

function ddmmyyyyToDate(s) {
  if (!s) return null;
  s = s.trim();
  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    return new Date(`${m[3]}-${months[m[2]]}-${m[1].padStart(2, '0')}`);
  }
  return null;
}

function num(v) {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function inferPaymentMethod(receipt) {
  const remarks = (receipt.remarks || '').toUpperCase();
  const bn = (receipt.bankName || '').toUpperCase();
  if (receipt.cash > 0 && receipt.bank === 0 && receipt.card === 0) return 'Cash';
  if (bn.includes('PHONEPAY') || bn.includes('GPAY') || bn.includes('GOOGLE') || remarks.includes('GPAY') || remarks.includes('PHONEPAY')) return 'UPI';
  if (remarks.includes('UNIFIED PAYMENTS') || remarks.includes('UPI')) return 'UPI';
  if (receipt.card > 0 || remarks.includes('SWIPE') || remarks.includes('DEBIT CARD')) return 'Card';
  if (receipt.bank > 0) return 'Online';
  if (receipt.cash > 0) return 'Cash';
  return 'Cash';
}

function parseSpisReceipts(csvPath) {
  let text = fs.readFileSync(csvPath, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = parseCsv(text);
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'Date' && rows[i].includes('Receipt No.')) {
      headerIdx = i; break;
    }
  }
  if (headerIdx < 0) throw new Error('Header row not found');
  const header = rows[headerIdx];
  const C = (n) => header.indexOf(n);
  const COL = {
    date: C('Date'), receipt: C('Receipt No.'), regNo: C('Reg No.'),
    type: C('Type'), gross: C('Gross Fees'), concession: C('Concession'),
    lateFee: C('Late/Extra Fees'), discount: C('Discount'),
    cash: C('Cash'), bank: C('Bank'), card: C('Card'),
    user: C('User Name'), chequeNo: C('Cheque No'), chequeDate: C('Cheque Date'),
    bankName: C('Bank Name'), remarks: C('Remarks')
  };
  const receipts = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const regNo = (r[COL.regNo] || '').trim();
    const studentName = (r[6] || '').trim();
    if (!regNo || !studentName || studentName === 'Total' || studentName === 'Grand Total') continue;
    const cash = num(r[COL.cash]);
    const bank = num(r[COL.bank]);
    const card = num(r[COL.card]);
    const paid = cash + bank + card;
    const receipt = {
      date: ddmmyyyyToDate(r[COL.date]),
      receiptNo: r[COL.receipt],
      regNo, studentName,
      type: (r[COL.type] || '').trim(),
      gross: num(r[COL.gross]),
      concession: num(r[COL.concession]),
      lateFee: num(r[COL.lateFee]),
      discount: num(r[COL.discount]),
      cash, bank, card, paid,
      transactionRef: (r[COL.chequeNo] || '').trim(),
      chequeDate: ddmmyyyyToDate(r[COL.chequeDate]),
      bankName: (r[COL.bankName] || '').trim(),
      collectedBy: (r[COL.user] || '').trim(),
      remarks: (r[COL.remarks] || '').trim()
    };
    receipts.push(receipt);
  }
  return receipts;
}

// Recurring concession patterns (per quarter in Q1 must equal these to auto-extend to Q2-Q4)
const RECURRING_PATTERNS = {
  1200: { label: 'Financially weak (₹3300 tuition/quarter)', perQuarter: 1200 },
  2250: { label: '3rd child (50% off tuition)', perQuarter: 2250 }
};

async function importStudentReceipts({ tenant, session, student, receipts, execute, adminUserId }) {
  const log = [];
  const studentName = student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim();
  log.push(`\n=== ${student.admissionNumber} ${studentName} (${receipts.length} receipts) ===`);

  // Skip students who have already been migrated (idempotency guard)
  const alreadyImported = await Payment.countDocuments({
    tenantId: tenant._id,
    studentId: student._id,
    remarks: /SPIS migration/i
  });
  if (alreadyImported > 0) {
    log.push(`  ⏭️  Already migrated (${alreadyImported} payment(s) exist). Skipping.`);
    return { log, paymentsCreated: 0, skipped: receipts.length, alreadyImported: true };
  }

  // Detect recurring concession pattern from total Q1 concession
  const totalConcession = roundToRupee(receipts.reduce((s, r) => s + r.concession, 0));
  const recurringPattern = RECURRING_PATTERNS[totalConcession] || null;
  if (recurringPattern) {
    log.push(`  📋 Detected: ${recurringPattern.label} (Q1 concession ₹${totalConcession})`);
  }

  // Sort receipts by date
  receipts.sort((a, b) => (a.date || 0) - (b.date || 0));

  // Load existing invoices for this student in this session, oldest-first
  const invoices = await FeeInvoice.find({
    tenantId: tenant._id,
    studentId: student._id,
    academicSessionId: session._id
  }).sort({ periodStart: 1 }).lean();
  if (invoices.length === 0) {
    log.push('  ❌ No invoices found for this student in session — skipping all receipts');
    return { log, paymentsCreated: 0, skipped: receipts.length };
  }

  // Track running state per invoice (in-memory)
  const invoiceState = invoices.map(inv => ({
    _id: inv._id,
    invoiceNumber: inv.invoiceNumber,
    periodLabel: inv.periodLabel,
    totalAmount: roundToRupee(toNumber(inv.totalAmount) + toNumber(inv.lateFeeApplied || 0)),
    paidAmount: toNumber(inv.paidAmount),
    discountAmount: toNumber(inv.discountAmount),
    items: inv.items
  }));
  invoiceState.forEach(s => {
    s.balance = roundToRupee(s.totalAmount - s.paidAmount - s.discountAmount);
  });

  const paymentsToCreate = [];
  const invoiceUpdates = new Map();   // invoiceId → { paidAdd, discountAdd, status, balanceSet }
  let skippedReceipts = 0;

  for (const receipt of receipts) {
    const gross = roundToRupee(receipt.gross);
    const paid = roundToRupee(receipt.paid);
    const waiver = roundToRupee(receipt.concession + receipt.discount);

    // Sanity check: gross should equal paid + waiver. If not, prefer paid + waiver
    let amountToSettle;
    if (Math.abs(gross - (paid + waiver)) <= 1) {
      amountToSettle = roundToRupee(paid + waiver);
    } else {
      amountToSettle = roundToRupee(paid + waiver);
      log.push(`  ⚠️  Receipt #${receipt.receiptNo}: gross ₹${gross} ≠ paid+waiver ₹${paid + waiver}, using ${amountToSettle}`);
    }
    if (amountToSettle <= 0) {
      skippedReceipts++; continue;
    }

    let remaining = amountToSettle;
    const allocatedToInvoices = [];

    for (const inv of invoiceState) {
      if (remaining <= 0) break;
      if (inv.balance <= 0) continue;
      const apply = Math.min(remaining, inv.balance);
      // Split this slice into paid vs waiver in proportion to the receipt's mix
      const paidPortion = amountToSettle === 0 ? 0 : roundToRupee((paid / amountToSettle) * apply);
      const waiverPortion = roundToRupee(apply - paidPortion);
      allocatedToInvoices.push({ invoice: inv, applied: roundToRupee(apply), paidPortion, waiverPortion });
      inv.paidAmount = roundToRupee(inv.paidAmount + paidPortion);
      inv.discountAmount = roundToRupee(inv.discountAmount + waiverPortion);
      inv.balance = roundToRupee(inv.balance - apply);
      remaining = roundToRupee(remaining - apply);
    }

    if (remaining > 0) {
      log.push(`  ⚠️  Receipt #${receipt.receiptNo} (₹${gross} gross): ₹${remaining} unallocated (invoices already fully covered)`);
    }

    if (allocatedToInvoices.length === 0) {
      skippedReceipts++; continue;
    }

    const paymentMethod = inferPaymentMethod(receipt);
    const transactionDetails = {};
    if (receipt.bankName) transactionDetails.bankName = receipt.bankName;
    if (receipt.transactionRef) {
      if (paymentMethod === 'Cheque') {
        transactionDetails.chequeNumber = receipt.transactionRef;
        if (receipt.chequeDate) transactionDetails.chequeDate = receipt.chequeDate;
      } else {
        transactionDetails.referenceNumber = receipt.transactionRef;
      }
    }

    for (const { invoice, applied, paidPortion, waiverPortion } of allocatedToInvoices) {
      // Track invoice update aggregations
      if (!invoiceUpdates.has(String(invoice._id))) {
        invoiceUpdates.set(String(invoice._id), {
          _id: invoice._id, invoiceNumber: invoice.invoiceNumber,
          paidAdd: 0, discountAdd: 0, totalAmount: invoice.totalAmount
        });
      }
      const upd = invoiceUpdates.get(String(invoice._id));
      upd.paidAdd = roundToRupee(upd.paidAdd + paidPortion);
      upd.discountAdd = roundToRupee(upd.discountAdd + waiverPortion);

      // Only create a Payment record if there's an actual payment portion (>0)
      if (paidPortion > 0) {
        const invoiceTotal = roundToRupee(invoice.totalAmount);
        const allocation = invoice.items.map(item => ({
          feeHeadName: item.feeHeadName,
          amount: roundToRupee((toNumber(item.netAmount) / invoiceTotal) * paidPortion)
        }));
        const allocSum = allocation.reduce((s, a) => s + a.amount, 0);
        if (allocSum !== paidPortion && allocation.length > 0) {
          allocation[allocation.length - 1].amount = roundToRupee(allocation[allocation.length - 1].amount + (paidPortion - allocSum));
        }
        paymentsToCreate.push({
          receipt, invoice, amount: paidPortion, paymentMethod, transactionDetails, allocation
        });
      }

      const flag = waiverPortion > 0 ? ` (waiver: ₹${waiverPortion})` : '';
      log.push(`  ✓ Receipt #${receipt.receiptNo} (₹${gross} gross / ₹${paid} paid ${paymentMethod}) → ${invoice.invoiceNumber} ${invoice.periodLabel}: applied ₹${applied}${flag}`);
    }
  }

  // Project recurring concession pattern to Q2-Q4 invoices.
  // First "touched" invoice (Q1) already has its discount applied via the receipts loop.
  // For each subsequent invoice without any payment yet, add the recurring per-quarter discount.
  let projectedDiscount = 0;
  if (recurringPattern && invoiceState.length > 1) {
    const sortedInvoices = invoiceState.slice().sort((_a, _b) => 0); // already in periodStart order from query
    let isFirst = true;
    for (const inv of sortedInvoices) {
      if (isFirst) {
        isFirst = false; continue;
      } // skip Q1
      // Only project if this invoice hasn't been touched yet (no payments in this run)
      const hasUpdate = invoiceUpdates.has(String(inv._id));
      const projected = Math.min(recurringPattern.perQuarter, inv.balance);
      if (projected <= 0) continue;
      if (!hasUpdate) {
        invoiceUpdates.set(String(inv._id), {
          _id: inv._id, invoiceNumber: inv.invoiceNumber,
          paidAdd: 0, discountAdd: 0, totalAmount: inv.totalAmount
        });
      }
      const upd = invoiceUpdates.get(String(inv._id));
      upd.discountAdd = roundToRupee(upd.discountAdd + projected);
      inv.discountAmount = roundToRupee(inv.discountAmount + projected);
      inv.balance = roundToRupee(inv.balance - projected);
      projectedDiscount = roundToRupee(projectedDiscount + projected);
      log.push(`  → Projected ₹${projected} concession to ${inv.invoiceNumber} ${inv.periodLabel}`);
    }
    if (projectedDiscount > 0) {
      log.push(`  📋 Total recurring concession projected: ₹${projectedDiscount}`);
    }
  }

  if (!execute) {
    log.push(`\n  → Would create ${paymentsToCreate.length} payment(s) across ${invoiceUpdates.size} invoice(s). Re-run with --execute to apply.`);
    return { log, paymentsCreated: 0, skipped: skippedReceipts, planned: paymentsToCreate.length, classified: recurringPattern ? recurringPattern.label : null };
  }

  // Persist payments
  let created = 0;
  for (const p of paymentsToCreate) {
    const receiptNumber = await Payment.generateReceiptNumber(tenant._id);
    const remarks = `SPIS migration — receipt #${p.receipt.receiptNo}${
      p.receipt.collectedBy ? ` (collected by: ${p.receipt.collectedBy})` : ''
    }${p.receipt.remarks ? ` — ${p.receipt.remarks}` : ''}`;

    const payment = new Payment({
      tenantId: tenant._id,
      receiptNumber,
      studentId: student._id,
      invoiceId: p.invoice._id,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentDate: p.receipt.date || new Date(),
      transactionDetails: Object.keys(p.transactionDetails).length > 0 ? p.transactionDetails : undefined,
      allocation: p.allocation,
      remarks,
      isConfirmed: true,
      confirmedAt: new Date(),
      confirmedBy: adminUserId,
      collectedBy: adminUserId
    });
    await payment.save();
    created++;
  }

  // Apply aggregated updates to each touched invoice (one update per invoice)
  let totalPaidAdded = 0;
  let totalDiscountAdded = 0;
  for (const upd of invoiceUpdates.values()) {
    // Re-read invoice to compute exact final status & balance
    const inv = await FeeInvoice.findById(upd._id).lean();
    const newPaid = roundToRupee(toNumber(inv.paidAmount) + upd.paidAdd);
    const newDiscount = roundToRupee(toNumber(inv.discountAmount) + upd.discountAdd);
    const newBalance = Math.max(0, roundToRupee(toNumber(inv.totalAmount) + toNumber(inv.lateFeeApplied || 0) - newPaid - newDiscount));
    const status = newBalance <= 0 ? 'Paid' : (newPaid > 0 ? 'Partial' : 'Pending');
    await FeeInvoice.updateOne({ _id: upd._id }, {
      $set: {
        paidAmount: newPaid,
        discountAmount: newDiscount,
        balanceAmount: newBalance,
        status
      }
    });
    totalPaidAdded += upd.paidAdd;
    totalDiscountAdded += upd.discountAdd;
  }

  // Update the allocation
  await AnnualFeeAllocation.updateOne(
    { tenantId: tenant._id, studentId: student._id, academicSessionId: session._id },
    { $inc: { totalPaid: totalPaidAdded, totalDiscount: totalDiscountAdded, balance: -(totalPaidAdded + totalDiscountAdded) } }
  );

  log.push(`\n  ✅ Created ${created} payment(s), allocated ₹${totalPaidAdded} paid + ₹${totalDiscountAdded} waiver across ${invoiceUpdates.size} invoice(s)`);
  return { log, paymentsCreated: created, skipped: skippedReceipts, classified: recurringPattern ? recurringPattern.label : null };
}

(async() => {
  const args = parseArgs();
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: /spis/i }).lean();
  if (!tenant) {
    console.error('SPIS tenant not found'); process.exit(1);
  }
  console.log(`✓ Tenant: ${tenant.schoolName} (${tenant.schoolCode})`);

  const session = await AcademicSession.findOne({ tenantId: tenant._id, name: args.session }).lean();
  if (!session) {
    console.error(`Session ${args.session} not found`); process.exit(1);
  }
  console.log(`✓ Session: ${session.name}`);

  const adminUser = await User.findOne({ tenantId: tenant._id, role: 'admin' }).select('_id').lean();
  if (!adminUser) {
    console.error('No admin user found in SPIS'); process.exit(1);
  }

  const allReceipts = parseSpisReceipts(args.input);
  console.log(`✓ Parsed ${allReceipts.length} receipts from SPIS CSV\n`);

  // Group by admission number
  const byAdmission = new Map();
  for (const r of allReceipts) {
    if (!byAdmission.has(r.regNo)) byAdmission.set(r.regNo, []);
    byAdmission.get(r.regNo).push(r);
  }

  // Filter to one student if --admission given
  const admissionsToProcess = args.admission ? [args.admission] : [...byAdmission.keys()];

  let totalCreated = 0, totalSkipped = 0, studentsProcessed = 0, studentsMissing = 0;
  const classifications = {};

  for (const adm of admissionsToProcess) {
    const receipts = byAdmission.get(adm) || [];
    if (receipts.length === 0) {
      console.log(`⚠️  No receipts found for ${adm}`);
      continue;
    }
    const student = await User.findOne({
      tenantId: tenant._id, role: 'student', admissionNumber: adm
    }).select('_id name firstName lastName admissionNumber').lean();
    if (!student) {
      studentsMissing++;
      console.log(`❌ Student ${adm} not found in Learnovo (${receipts.length} receipts skipped)`);
      continue;
    }
    const result = await importStudentReceipts({
      tenant, session, student, receipts,
      execute: args.execute, adminUserId: adminUser._id
    });
    console.log(result.log.join('\n'));
    totalCreated += args.execute ? result.paymentsCreated : (result.planned || 0);
    totalSkipped += result.skipped;
    studentsProcessed++;
    if (result.classified) classifications[result.classified] = (classifications[result.classified] || 0) + 1;
  }

  console.log('\n========== SUMMARY ==========');
  console.log(`Students processed: ${studentsProcessed}`);
  console.log(`Students not found in Learnovo: ${studentsMissing}`);
  console.log(`Payments ${args.execute ? 'created' : 'planned'}: ${totalCreated}`);
  console.log(`Receipts skipped: ${totalSkipped}`);
  if (Object.keys(classifications).length > 0) {
    console.log('\nRecurring concession classifications:');
    for (const [label, count] of Object.entries(classifications)) {
      console.log(`  - ${label}: ${count} student(s)`);
    }
  }
  if (!args.execute) console.log('\n(Dry run — re-run with --execute to apply)');

  await mongoose.disconnect();
})().catch(err => {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
