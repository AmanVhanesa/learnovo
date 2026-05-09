#!/usr/bin/env node
/**
 * Convert SPIS daily-collection CSV to Learnovo fee-import CSV.
 *
 * Aggregates receipts per (student × fee-head) so each student-fee combination
 * gets ONE row regardless of how many SPIS receipts they had.
 *
 * Fee head classification:
 *   - Registration Fee (one_time): Type=New rows with Gross Fees ≤ 1000
 *   - Tuition Fee (recurring): everything else
 *
 * Usage:
 *   node convert-spis-fees.js --input SPIS.csv --output learnovo.csv --session 2026-2027
 */

const fs = require('fs');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { session: '2026-2027' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input') out.input = args[++i];
    else if (args[i] === '--output') out.output = args[++i];
    else if (args[i] === '--session') out.session = args[++i];
  }
  if (!out.input || !out.output) {
    console.error('Usage: --input <spis.csv> --output <learnovo.csv> [--session 2026-2027]');
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

function csvEscape(s) {
  if (s == null) return '';
  const str = String(s);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${  str.replace(/"/g, '""')  }"`;
  }
  return str;
}

function ddmmyyyyToIso(s) {
  if (!s) return '';
  s = s.trim();
  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    return `${m[3]}-${months[m[2]]}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

function num(v) {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function main() {
  const { input, output, session } = parseArgs();
  // Strip BOM if present
  let text = fs.readFileSync(input, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = parseCsv(text);

  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'Date' && rows[i].includes('Receipt No.')) {
      headerIdx = i; break;
    }
  }
  if (headerIdx < 0) {
    console.error('Could not find header row'); process.exit(1);
  }

  const header = rows[headerIdx];
  const COL = {
    date: header.indexOf('Date'),
    receipt: header.indexOf('Receipt No.'),
    regNo: header.indexOf('Reg No.'),
    type: header.indexOf('Type'),
    gross: header.indexOf('Gross Fees'),
    concession: header.indexOf('Concession'),
    lateFee: header.indexOf('Late/Extra Fees'),
    discount: header.indexOf('Discount'),
    cash: header.indexOf('Cash'),
    bank: header.indexOf('Bank'),
    card: header.indexOf('Card'),
    user: header.indexOf('User Name'),
    chequeNo: header.indexOf('Cheque No'),
    chequeDate: header.indexOf('Cheque Date'),
    bankName: header.indexOf('Bank Name'),
    remarks: header.indexOf('Remarks')
  };

  const groups = new Map();
  const flagged = [];
  let skipped = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const regNo = (r[COL.regNo] || '').trim();
    const studentName = (r[6] || '').trim();
    if (!regNo || !studentName || studentName === 'Total' || studentName === 'Grand Total') {
      skipped++;
      continue;
    }

    const type = (r[COL.type] || '').trim();
    const gross = num(r[COL.gross]);
    const cash = num(r[COL.cash]);
    const bankAmt = num(r[COL.bank]);
    const cardAmt = num(r[COL.card]);
    const concession = num(r[COL.concession]);
    const lateFee = num(r[COL.lateFee]);
    const discount = num(r[COL.discount]);
    const paid = cash + bankAmt + cardAmt;

    let feeHead, feeType;
    if (type === 'New' && gross <= 1000) {
      feeHead = 'Registration Fee';
      feeType = 'one_time';
    } else {
      feeHead = 'Tuition Fee';
      feeType = 'recurring';
    }

    // Flag suspicious rows for manual review
    if (type === 'Old' && gross > 0 && gross <= 1000) {
      flagged.push({
        date: r[COL.date],
        receipt: r[COL.receipt],
        regNo,
        studentName,
        type,
        gross,
        paid,
        reason: 'Old student with ≤₹1000 — possible misclassified registration fee',
        remarks: r[COL.remarks] || ''
      });
    }

    const key = `${regNo}__${feeHead}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        regNo, feeHead, feeType,
        annualAmount: 0, paidAmount: 0, concessionAmount: 0,
        lateFeeAmount: 0, discountAmount: 0,
        latestDate: '', latestMethod: '', latestRef: '',
        latestChequeDate: '', latestBank: '', latestRemarks: '',
        receiptNos: [], collectedBy: ''
      };
      groups.set(key, g);
    }

    g.annualAmount += gross;
    g.paidAmount += paid;
    g.concessionAmount += concession;
    g.lateFeeAmount += lateFee;
    g.discountAmount += discount;
    g.receiptNos.push(r[COL.receipt]);

    const dateIso = ddmmyyyyToIso(r[COL.date]);
    if (paid > 0 && dateIso >= g.latestDate) {
      g.latestDate = dateIso;

      let method;
      const remarks = (r[COL.remarks] || '').toUpperCase();
      const bn = (r[COL.bankName] || '').toUpperCase();
      if (cash > 0 && bankAmt === 0 && cardAmt === 0) method = 'Cash';
      else if (bn.includes('PHONEPAY') || bn.includes('GPAY') || bn.includes('GOOGLE') || remarks.includes('GPAY') || remarks.includes('PHONEPAY')) method = 'UPI';
      else if (remarks.includes('UNIFIED PAYMENTS') || remarks.includes('UPI')) method = 'UPI';
      else if (cardAmt > 0 || remarks.includes('SWIPE') || remarks.includes('DEBIT CARD')) method = 'Card';
      else if (bankAmt > 0) method = 'Online';
      else method = 'Cash';

      g.latestMethod = method;
      g.latestRef = (r[COL.chequeNo] || '').trim();
      g.latestChequeDate = ddmmyyyyToIso(r[COL.chequeDate]);
      g.latestBank = (r[COL.bankName] || '').trim();
      g.latestRemarks = (r[COL.remarks] || '').trim();
      g.collectedBy = (r[COL.user] || '').trim();
    }
  }

  const outHeader = [
    'admissionNumber', 'feeHead', 'feeType', 'annualAmount', 'paidAmount',
    'paymentDate', 'paymentMethod', 'receiptNumber', 'transactionReference',
    'chequeDate', 'bankName', 'collectedBy', 'dueDate', 'discountAmount',
    'discountReason', 'concessionAmount', 'lateFeeAmount', 'academicSession', 'remarks'
  ];

  const out = [outHeader.join(',')];
  let regCount = 0, tuitionCount = 0;
  const students = new Set();

  for (const g of groups.values()) {
    students.add(g.regNo);
    if (g.feeHead === 'Registration Fee') regCount++; else tuitionCount++;

    const safeName = g.feeHead.replace(/\s+/g, '');
    const remarks = `Migrated from SPIS (${g.receiptNos.length} receipt${g.receiptNos.length > 1 ? 's' : ''})`;

    const row = [
      g.regNo, g.feeHead, g.feeType, g.annualAmount, g.paidAmount,
      g.latestDate, g.latestMethod, `MIG-${g.regNo}-${safeName}`,
      g.latestRef, g.latestChequeDate, g.latestBank, g.collectedBy,
      g.latestDate, g.discountAmount, '',
      g.concessionAmount, g.lateFeeAmount, session, remarks
    ];
    out.push(row.map(csvEscape).join(','));
  }

  fs.writeFileSync(output, `${out.join('\n')  }\n`);

  console.log(`✅ Wrote ${out.length - 1} rows to ${output}`);
  console.log(`   Unique students: ${students.size}`);
  console.log(`   Registration Fee rows: ${regCount}`);
  console.log(`   Tuition Fee rows: ${tuitionCount}`);
  console.log(`   Skipped non-data rows: ${skipped}`);

  // Write sanity-check sidecar of suspicious rows
  if (flagged.length > 0) {
    const flagPath = `${output.replace(/\.csv$/i, '')  }-flagged.csv`;
    const flagHeader = ['date', 'receiptNo', 'admissionNumber', 'studentName', 'type', 'grossFees', 'paidAmount', 'reason', 'spisRemarks'];
    const flagRows = [flagHeader.join(',')];
    for (const f of flagged) {
      flagRows.push([f.date, f.receipt, f.regNo, f.studentName, f.type, f.gross, f.paid, f.reason, f.remarks].map(csvEscape).join(','));
    }
    fs.writeFileSync(flagPath, `${flagRows.join('\n')  }\n`);
    console.log(`\n⚠️  ${flagged.length} suspicious row(s) flagged for review → ${flagPath}`);
    console.log('   Review these and decide whether to relabel them as "New" in the source CSV before re-running.');
  } else {
    console.log('\n✅ No suspicious rows flagged.');
  }
}

main();
