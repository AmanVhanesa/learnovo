#!/usr/bin/env node
/**
 * One-time fixup for SPIS migration payments imported with the OLD
 * inferPaymentMethod() logic, which mis-classified UPI QR-scan receipts as
 * "Card" and never recorded the online sub-mode (NEFT/IMPS/UPI/etc.).
 *
 * What this script does (idempotent):
 *   - Re-reads FEES_IMPORT.csv to recover each receipt's original
 *     Cash/Bank/Card/BankName/Remarks values.
 *   - Locates the corresponding Payment row(s) using the migration remark
 *     pattern `SPIS migration — receipt #<receiptNo>`.
 *   - Recomputes paymentMethod with the corrected SPIS rules:
 *       * Card column > 0   → UPI  (SPIS had no real POS)
 *       * Remarks SWIPE     → UPI  (UPI QR, not card)
 *   - For paymentMethod === 'Online', sets transactionDetails.onlineMode
 *     to UPI / NEFT / IMPS / RTGS / Net Banking / Other based on
 *     remarks + bank name.
 *
 * Will NOT change Cash payments. Will NOT touch payments outside the
 * "SPIS migration" remarks pattern (i.e. any payment collected through the UI
 * after migration is left alone).
 *
 * Usage:
 *   # Dry-run (default) — prints what would change, writes nothing:
 *   node fix-spis-payment-methods.js --input FEES_IMPORT.csv
 *
 *   # Apply changes:
 *   node fix-spis-payment-methods.js --input FEES_IMPORT.csv --execute
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') });

const Tenant = require('../../models/Tenant');
const Payment = require('../../models/Payment');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { execute: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input') out.input = args[++i];
    else if (args[i] === '--execute') out.execute = true;
  }
  if (!out.input) {
    console.error('Usage: --input <FEES_IMPORT.csv> [--execute]');
    process.exit(1);
  }
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

function num(v) {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
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
  if (headerIdx < 0) throw new Error('Header row not found in CSV');
  const header = rows[headerIdx];
  const C = (n) => header.indexOf(n);
  const COL = {
    receipt: C('Receipt No.'),
    cash: C('Cash'),
    bank: C('Bank'),
    card: C('Card'),
    bankName: C('Bank Name'),
    remarks: C('Remarks')
  };
  const byReceipt = new Map();
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const receiptNo = (r[COL.receipt] || '').trim();
    if (!receiptNo) continue;
    byReceipt.set(receiptNo, {
      receiptNo,
      cash: num(r[COL.cash]),
      bank: num(r[COL.bank]),
      card: num(r[COL.card]),
      bankName: (r[COL.bankName] || '').trim(),
      remarks: (r[COL.remarks] || '').trim()
    });
  }
  return byReceipt;
}

// Mirrors importer logic — keep these in sync with import-spis-payments.js.
function inferPaymentMethod(receipt) {
  const remarks = (receipt.remarks || '').toUpperCase();
  const bn = (receipt.bankName || '').toUpperCase();
  if (receipt.cash > 0 && receipt.bank === 0 && receipt.card === 0) return 'Cash';
  if (receipt.card > 0 || remarks.includes('SWIPE')) return 'UPI';
  if (bn.includes('PHONEPAY') || bn.includes('PHONEPE') || bn.includes('GPAY') || bn.includes('GOOGLE')) return 'UPI';
  if (remarks.includes('GPAY') || remarks.includes('PHONEPAY') || remarks.includes('PHONEPE')) return 'UPI';
  if (receipt.bank > 0) return 'Online';
  if (receipt.cash > 0) return 'Cash';
  return 'Cash';
}

function inferOnlineMode(receipt) {
  const remarks = (receipt.remarks || '').toUpperCase();
  const bn = (receipt.bankName || '').toUpperCase();
  const blob = `${remarks} ${bn}`;
  if (blob.includes('NEFT')) return 'NEFT';
  if (blob.includes('IMPS')) return 'IMPS';
  if (blob.includes('RTGS')) return 'RTGS';
  if (blob.includes('UNIFIED PAYMENTS') || blob.includes('UPI')) return 'UPI';
  if (blob.includes('NET BANKING') || blob.includes('NETBANKING') || blob.includes('INB')) return 'Net Banking';
  return 'Other';
}

// Pull the source receipt number from the Payment.remarks string written by
// the importer: "SPIS migration — receipt #1234 ..." or with em-dash variants.
function extractReceiptNoFromRemarks(remarks) {
  if (!remarks) return null;
  const m = remarks.match(/receipt\s*#\s*([A-Za-z0-9_-]+)/i);
  return m ? m[1].trim() : null;
}

(async() => {
  const args = parseArgs();

  const csvPath = path.resolve(args.input);
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✓ Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: /spis/i }).lean();
  if (!tenant) {
    console.error('SPIS tenant not found'); process.exit(1);
  }
  console.log(`✓ Tenant: ${tenant.schoolName} (${tenant.schoolCode})`);

  const byReceipt = parseSpisReceipts(csvPath);
  console.log(`✓ Parsed ${byReceipt.size} unique receipts from CSV`);

  // Find every payment that came from the migration importer.
  const migrationPayments = await Payment.find({
    tenantId: tenant._id,
    remarks: /SPIS migration/i
  }).select('_id receiptNumber remarks paymentMethod transactionDetails');
  console.log(`✓ Found ${migrationPayments.length} migration payment(s) in DB\n`);

  const summary = {
    total: migrationPayments.length,
    methodChanged: 0,
    onlineModeSet: 0,
    onlineModeChanged: 0,
    receiptNotFoundInCsv: 0,
    noChange: 0,
    byTransition: new Map() // "OLD → NEW" → count
  };
  const samples = [];
  const SAMPLE_LIMIT = 15;

  if (!args.execute) {
    console.log('═══════════════════════════════════════');
    console.log('  DRY RUN — no DB writes');
    console.log('═══════════════════════════════════════\n');
  }

  for (const p of migrationPayments) {
    const sourceReceiptNo = extractReceiptNoFromRemarks(p.remarks);
    if (!sourceReceiptNo) {
      summary.receiptNotFoundInCsv++; continue;
    }

    const csvReceipt = byReceipt.get(sourceReceiptNo);
    if (!csvReceipt) {
      summary.receiptNotFoundInCsv++; continue;
    }

    const newMethod = inferPaymentMethod(csvReceipt);
    const newOnlineMode = newMethod === 'Online' ? inferOnlineMode(csvReceipt) : undefined;

    const oldMethod = p.paymentMethod;
    const oldOnlineMode = p.transactionDetails?.onlineMode;

    const methodChange = oldMethod !== newMethod;
    const onlineModeChange = (newMethod === 'Online') && (oldOnlineMode !== newOnlineMode);

    if (!methodChange && !onlineModeChange) {
      summary.noChange++; continue;
    }

    if (methodChange) {
      summary.methodChanged++;
      const key = `${oldMethod} → ${newMethod}`;
      summary.byTransition.set(key, (summary.byTransition.get(key) || 0) + 1);
    }
    if (newMethod === 'Online') {
      if (oldOnlineMode === undefined) summary.onlineModeSet++;
      else if (oldOnlineMode !== newOnlineMode) summary.onlineModeChanged++;
    }

    if (samples.length < SAMPLE_LIMIT) {
      samples.push({
        receiptNumber: p.receiptNumber,
        sourceReceipt: sourceReceiptNo,
        from: { method: oldMethod, onlineMode: oldOnlineMode },
        to: { method: newMethod, onlineMode: newOnlineMode },
        csv: { cash: csvReceipt.cash, bank: csvReceipt.bank, card: csvReceipt.card, bankName: csvReceipt.bankName, remarks: csvReceipt.remarks }
      });
    }

    if (args.execute) {
      // Build update doc — drop onlineMode when method !== Online so we don't
      // leave stale sub-mode data on a Cash/UPI/Cheque/Card payment.
      const update = { $set: { paymentMethod: newMethod } };
      if (newMethod === 'Online') {
        update.$set['transactionDetails.onlineMode'] = newOnlineMode;
      } else if (oldOnlineMode !== undefined) {
        update.$unset = { 'transactionDetails.onlineMode': '' };
      }
      await Payment.updateOne({ _id: p._id }, update);
    }
  }

  console.log('=== Sample changes (first 15) ===');
  for (const s of samples) {
    const fromStr = s.from.onlineMode ? `${s.from.method}/${s.from.onlineMode}` : s.from.method;
    const toStr = s.to.onlineMode ? `${s.to.method}/${s.to.onlineMode}` : s.to.method;
    console.log(`  ${s.receiptNumber} (src #${s.sourceReceipt}): ${fromStr} → ${toStr}`);
    console.log(`    csv: cash=${s.csv.cash} bank=${s.csv.bank} card=${s.csv.card} bank="${s.csv.bankName}" remarks="${s.csv.remarks}"`);
  }

  console.log('\n=== Summary ===');
  console.log(`  Total migration payments scanned:  ${summary.total}`);
  console.log(`  Source receipt missing from CSV:   ${summary.receiptNotFoundInCsv}`);
  console.log(`  No change needed:                  ${summary.noChange}`);
  console.log(`  paymentMethod changed:             ${summary.methodChanged}`);
  console.log(`  onlineMode newly set:              ${summary.onlineModeSet}`);
  console.log(`  onlineMode changed:                ${summary.onlineModeChanged}`);

  if (summary.byTransition.size > 0) {
    console.log('\n  Method transitions:');
    for (const [k, v] of summary.byTransition) {
      console.log(`    ${k}: ${v}`);
    }
  }

  if (!args.execute) {
    console.log('\n  → Re-run with --execute to apply these changes.');
  } else {
    console.log('\n  ✅ Changes applied.');
  }

  await mongoose.disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
