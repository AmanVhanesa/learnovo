/**
 * Diagnose SPIS defaulters list — explain why students with a real
 * pending balance are missing from /api/fees/defaulters.
 *
 * Buckets every "owing" student (AnnualFeeAllocation.balance > 0)
 * for the SPIS active academic session into one of:
 *
 *   A. SHOWN              — appears in defaulters aggregation. OK.
 *   B. NO_INVOICES        — allocation balance > 0 but zero invoices exist
 *                           (most common cause — fix by generating invoices).
 *   C. STATUS_DRIFT       — invoices exist with balanceAmount > 0 but their
 *                           status is "Paid" or "Cancelled" (data drift —
 *                           needs a status-correction script).
 *   D. NULL_DUE_DATE      — invoices exist with status Pending/Partial/Overdue
 *                           and balance > 0, but dueDate is null/missing
 *                           (drops out the moment a date filter is applied).
 *   E. CAPPED_BY_LIMIT    — student is a real defaulter but falls outside
 *                           the 1000-row cap (sort: liveBalance desc).
 *   F. STUDENT_INACTIVE   — student record is inactive/deleted but
 *                           allocation still shows balance.
 *
 * Writes a CSV per bucket to ./spis-defaulters-<bucket>.csv plus a console
 * summary. Read-only — does NOT modify any data.
 *
 * Usage:
 *   node scripts/diagnose-spis-defaulters.js
 *   node scripts/diagnose-spis-defaulters.js --session=<academicSessionId>
 *   node scripts/diagnose-spis-defaulters.js --classId=<classId>
 *
 * Optional --classId filters output to one class (e.g. just 8th std).
 */

require('dotenv').config({ path: './config.env' });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const User = require('../models/User');
// eslint-disable-next-line no-unused-vars
const Class = require('../models/Class');
// eslint-disable-next-line no-unused-vars
const Section = require('../models/Section');
const AcademicSession = require('../models/AcademicSession');
const AnnualFeeAllocation = require('../models/AnnualFeeAllocation');
const FeeInvoice = require('../models/FeeInvoice');

const SCHOOL_CODE = 'spis';
const DEFAULTERS_LIMIT = 1000;

function parseArg(name) {
  const a = process.argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1] : null;
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

function writeCsv(filename, header, rows) {
  const lines = [header.map(csvCell).join(',')];
  for (const r of rows) lines.push(header.map(h => csvCell(r[h])).join(','));
  fs.writeFileSync(path.resolve(process.cwd(), filename), lines.join('\n'));
  console.log(`  wrote ${filename} (${rows.length} rows)`);
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const tenant = await Tenant.findOne({ schoolCode: SCHOOL_CODE });
  if (!tenant) throw new Error(`Tenant '${SCHOOL_CODE}' not found`);
  const tenantId = tenant._id;
  console.log(`Tenant: ${tenant.schoolName} (${tenantId})`);

  const sessionArg = parseArg('session');
  const session = sessionArg
    ? await AcademicSession.findOne({ _id: sessionArg, tenantId })
    : await AcademicSession.findOne({ tenantId, isActive: true });
  if (!session) throw new Error('Active academic session not found');
  console.log(`Session: ${session.name} (${session._id})`);

  const classFilter = parseArg('classId');
  if (classFilter) console.log(`Class filter: ${classFilter}`);
  console.log('');

  // ── 1. All allocations with balance > 0 ──────────────────────────────
  const allocQuery = { tenantId, academicSessionId: session._id, balance: { $gt: 0 } };
  const allocs = await AnnualFeeAllocation.find(allocQuery).lean();
  console.log(`Allocations with balance > 0: ${allocs.length}`);

  // Map studentId -> alloc
  const allocByStudent = new Map();
  for (const a of allocs) allocByStudent.set(String(a.studentId), a);

  // ── 2. Pull student docs in one go ───────────────────────────────────
  const studentIds = Array.from(allocByStudent.keys()).map(s => new mongoose.Types.ObjectId(s));
  const studentMatch = { _id: { $in: studentIds }, tenantId };
  if (classFilter) studentMatch.classId = new mongoose.Types.ObjectId(classFilter);
  const students = await User.find(studentMatch).populate('classId sectionId').lean();
  const studentById = new Map(students.map(s => [String(s._id), s]));
  console.log(`Student records found:           ${students.length}`);

  // ── 3. Run the same aggregation /defaulters uses ─────────────────────
  const tenantOid = new mongoose.Types.ObjectId(tenantId);
  const sessionOid = session._id;
  const pipeline = [
    { $match: {
      tenantId: tenantOid,
      academicSessionId: sessionOid,
      status: { $in: ['Pending', 'Partial', 'Overdue'] }
    } },
    { $group: {
      _id: '$studentId',
      liveBalance: { $sum: '$balanceAmount' },
      unpaidInvoiceCount: { $sum: 1 }
    } },
    { $match: { liveBalance: { $gt: 0 } } },
    { $sort: { liveBalance: -1 } }
  ];
  const aggregated = await FeeInvoice.aggregate(pipeline).allowDiskUse(true);
  const shownIds = new Set(aggregated.slice(0, DEFAULTERS_LIMIT).map(a => String(a._id)));
  const cappedOutIds = new Set(aggregated.slice(DEFAULTERS_LIMIT).map(a => String(a._id)));
  console.log(`/defaulters would return:        ${shownIds.size} (cap ${DEFAULTERS_LIMIT})`);
  console.log(`Capped out (over limit):         ${cappedOutIds.size}\n`);

  // ── 4. Bucket each owing student ─────────────────────────────────────
  const buckets = {
    SHOWN: [], NO_INVOICES: [], STATUS_DRIFT: [],
    NULL_DUE_DATE: [], CAPPED_BY_LIMIT: [], STUDENT_INACTIVE: []
  };

  for (const [sid, alloc] of allocByStudent) {
    const student = studentById.get(sid);
    if (classFilter && !student) continue; // class-filtered out

    const baseRow = {
      studentId: sid,
      admissionNumber: student?.admissionNumber || student?.studentId || '',
      name: student?.fullName || student?.name || '(missing student doc)',
      class: student?.classId?.name || '',
      section: student?.sectionId?.name || '',
      allocationBalance: alloc.balance,
      allocated: alloc.totalAnnualAmount,
      paid: alloc.totalPaid,
      waived: alloc.totalWaived,
      discount: alloc.totalDiscount
    };

    if (!student || student.isActive === false) {
      buckets.STUDENT_INACTIVE.push({ ...baseRow, reason: 'student inactive or missing' });
      continue;
    }

    if (shownIds.has(sid)) {
      buckets.SHOWN.push(baseRow); continue;
    }
    if (cappedOutIds.has(sid)) {
      buckets.CAPPED_BY_LIMIT.push({ ...baseRow, reason: 'falls outside top-1000' });
      continue;
    }

    // Not in aggregation at all — inspect their invoices
    const invs = await FeeInvoice.find({
      tenantId, academicSessionId: session._id, studentId: alloc.studentId
    }).select('status balanceAmount totalAmount dueDate periodLabel').lean();

    if (invs.length === 0) {
      buckets.NO_INVOICES.push({ ...baseRow, invoiceCount: 0, reason: 'no FeeInvoice rows' });
      continue;
    }

    const owing = invs.filter(i => (i.balanceAmount || 0) > 0);
    const owingByStatus = owing.reduce((m, i) => {
      m[i.status] = (m[i.status] || 0) + 1; return m;
    }, {});
    const allOwingStatuses = Object.keys(owingByStatus);
    const onlyClosedStatus = owing.length > 0 && allOwingStatuses.every(s => s === 'Paid' || s === 'Cancelled');

    if (onlyClosedStatus) {
      buckets.STATUS_DRIFT.push({
        ...baseRow,
        invoiceCount: invs.length,
        owingInvoices: owing.length,
        statuses: JSON.stringify(owingByStatus),
        sampleInvoiceIds: owing.slice(0, 3).map(i => String(i._id)).join(';'),
        reason: 'invoices have balance>0 but status is Paid/Cancelled'
      });
      continue;
    }

    // status looks unpaid — does any owing invoice have null dueDate?
    const unpaidOwing = owing.filter(i => ['Pending', 'Partial', 'Overdue'].includes(i.status));
    const nullDueCount = unpaidOwing.filter(i => !i.dueDate).length;
    if (nullDueCount > 0) {
      buckets.NULL_DUE_DATE.push({
        ...baseRow,
        invoiceCount: invs.length,
        unpaidOwingInvoices: unpaidOwing.length,
        nullDueDateInvoices: nullDueCount,
        reason: 'some unpaid invoices have null dueDate'
      });
      continue;
    }

    // Shouldn't reach here — fall through means aggregation/data is inconsistent
    buckets.STATUS_DRIFT.push({
      ...baseRow,
      invoiceCount: invs.length,
      owingInvoices: owing.length,
      statuses: JSON.stringify(owingByStatus),
      reason: 'unexplained — manual inspection needed'
    });
  }

  // ── 5. Report ────────────────────────────────────────────────────────
  console.log('═══ Bucket counts ═══');
  for (const k of Object.keys(buckets)) {
    console.log(`  ${k.padEnd(22)} ${buckets[k].length}`);
  }

  console.log('\n═══ Writing CSVs ═══');
  const baseHeader = ['studentId', 'admissionNumber', 'name', 'class', 'section',
    'allocationBalance', 'allocated', 'paid', 'waived', 'discount'];
  if (buckets.NO_INVOICES.length)
    writeCsv('spis-defaulters-no_invoices.csv', [...baseHeader, 'invoiceCount', 'reason'], buckets.NO_INVOICES);
  if (buckets.STATUS_DRIFT.length)
    writeCsv('spis-defaulters-status_drift.csv',
      [...baseHeader, 'invoiceCount', 'owingInvoices', 'statuses', 'sampleInvoiceIds', 'reason'],
      buckets.STATUS_DRIFT);
  if (buckets.NULL_DUE_DATE.length)
    writeCsv('spis-defaulters-null_due_date.csv',
      [...baseHeader, 'invoiceCount', 'unpaidOwingInvoices', 'nullDueDateInvoices', 'reason'],
      buckets.NULL_DUE_DATE);
  if (buckets.CAPPED_BY_LIMIT.length)
    writeCsv('spis-defaulters-capped_by_limit.csv', [...baseHeader, 'reason'], buckets.CAPPED_BY_LIMIT);
  if (buckets.STUDENT_INACTIVE.length)
    writeCsv('spis-defaulters-student_inactive.csv', [...baseHeader, 'reason'], buckets.STUDENT_INACTIVE);

  // Spot-check the IDs the user mentioned
  console.log('\n═══ Spot-check (user-mentioned admission numbers) ═══');
  const spot = ['2362', '2480', '4834'];
  const matches = students.filter(s => spot.includes(String(s.admissionNumber)) || spot.includes(String(s.studentId)));
  for (const m of matches) {
    const sid = String(m._id);
    const bucket = Object.entries(buckets).find(([, list]) => list.some(r => r.studentId === sid));
    console.log(`  Adm ${m.admissionNumber || m.studentId} (${m.fullName || m.name}) → ${bucket ? bucket[0] : 'NOT IN ALLOC (no balance)'}`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
