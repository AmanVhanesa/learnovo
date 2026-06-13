/**
 * SPIS Aadhaar Backfill
 *
 * Background: the SPIS student import landed everything correctly EXCEPT three
 * fields that were missing from the import payload:
 *   - student Aadhaar        → User.aadhaarNumber
 *   - father's Aadhaar       → User.guardians[relation='Father'].aadhaarNumber
 *   - mother's Aadhaar       → User.guardians[relation='Mother'].aadhaarNumber
 *
 * This script reads a source CSV that DOES contain those Aadhaar numbers
 * (the full student export), keys it by admission number, and fills the gaps
 * on the matching SPIS student documents.
 *
 * The source CSV is parsed by HEADER NAME, so any export/list with columns
 * named "Admission No", "Aadhaar Number", "Father Aadhaar", "Mother Aadhaar"
 * will work. Header matching is case/space/punctuation-insensitive.
 *
 * Field storage (confirmed against models/User.js + routes/students.js export):
 *   - aadhaarNumber                        (top-level string)
 *   - guardians[].aadhaarNumber where guardians[].relation === 'Father'
 *   - guardians[].aadhaarNumber where guardians[].relation === 'Mother'
 *
 * Safety:
 *   - Tenant-scoped to schoolCode "spis".
 *   - Only a 12-digit Aadhaar (after stripping spaces/hyphens) is accepted;
 *     blanks and malformed values in the source are skipped + reported.
 *   - By default ONLY fills a field that is currently empty. Pass --overwrite
 *     to also replace existing non-empty values that differ from the source.
 *   - A father/mother Aadhaar is only written onto an EXISTING guardian of
 *     that relation. Students missing that guardian row are reported, not
 *     silently mutated.
 *   - Dry-run by default. Pass --execute to mutate.
 *
 * Usage:
 *   node scripts/backfill-spis-student-aadhaar.js [csvPath]              # dry-run
 *   node scripts/backfill-spis-student-aadhaar.js [csvPath] --execute    # commit
 *   node scripts/backfill-spis-student-aadhaar.js [csvPath] --execute --overwrite
 *
 * Default csvPath: ./students_export_2026-06-13.csv (repo root)
 */

require('dotenv').config({ path: './config.env' });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const csv = require('fast-csv');

const Tenant = require('../models/Tenant');
const User = require('../models/User');

const DRY_RUN = !process.argv.includes('--execute');
const OVERWRITE = process.argv.includes('--overwrite');

// First non-flag arg is the CSV path.
const csvArg = process.argv.slice(2).find(a => !a.startsWith('--'));
const CSV_PATH = path.resolve(process.cwd(), csvArg || 'students_export_2026-06-13.csv');

// Normalise a header label so "Admission No", "admission_no", "AdmissionNo"
// all collapse to the same key.
const normHeader = (s) => (s == null ? '' : s.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

// Aadhaar must be exactly 12 digits once spaces/hyphens are stripped.
const cleanAadhaar = (s) => {
  if (s == null) return '';
  const digits = s.toString().replace(/[\s-]/g, '');
  return /^[0-9]{12}$/.test(digits) ? digits : '';
};

const normAdm = (s) => (s == null ? '' : s.toString().trim());

function readSourceCsv(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Source CSV not found: ${filePath}`));
    }

    const byAdmission = new Map(); // admissionNumber → { student, father, mother, raw:{...} }
    let headerMap = null; // normalised header → column index
    const malformed = { student: 0, father: 0, mother: 0 };
    let rows = 0;

    fs.createReadStream(filePath)
      .pipe(csv.parse({ headers: false, ignoreEmpty: true }))
      .on('error', reject)
      .on('data', (cols) => {
        if (!headerMap) {
          headerMap = {};
          cols.forEach((label, idx) => {
            headerMap[normHeader(label)] = idx;
          });
          const need = ['admissionno', 'aadhaarnumber', 'fatheraadhaar', 'motheraadhaar'];
          const missing = need.filter(h => headerMap[h] === undefined);
          if (missing.length) {
            reject(new Error(`CSV missing required column(s): ${missing.join(', ')}. ` +
              `Found headers: ${cols.join(', ')}`));
          }
          return;
        }
        rows += 1;
        const get = (h) => cols[headerMap[h]];
        const adm = normAdm(get('admissionno'));
        if (!adm) return;

        const rawStudent = get('aadhaarnumber');
        const rawFather = get('fatheraadhaar');
        const rawMother = get('motheraadhaar');

        const student = cleanAadhaar(rawStudent);
        const father = cleanAadhaar(rawFather);
        const mother = cleanAadhaar(rawMother);

        if (rawStudent && rawStudent.trim() && !student) malformed.student += 1;
        if (rawFather && rawFather.trim() && !father) malformed.father += 1;
        if (rawMother && rawMother.trim() && !mother) malformed.mother += 1;

        byAdmission.set(adm, { student, father, mother });
      })
      .on('end', () => resolve({ byAdmission, malformed, rows }));
  });
}

async function run() {
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'EXECUTE (will mutate DB)'}`);
  console.log(`Overwrite existing values: ${OVERWRITE ? 'YES' : 'no (fill blanks only)'}`);
  console.log(`Source CSV: ${CSV_PATH}\n`);

  const { byAdmission, malformed, rows } = await readSourceCsv(CSV_PATH);
  console.log(`Source rows parsed: ${rows}`);
  console.log(`Source rows with admission no: ${byAdmission.size}`);
  console.log(`Malformed (non-12-digit, ignored) → student: ${malformed.student}, ` +
    `father: ${malformed.father}, mother: ${malformed.mother}\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: 'spis' });
  if (!tenant) {
    console.error('SPIS tenant not found. Aborting.');
    process.exit(1);
  }
  const tenantId = tenant._id;
  console.log(`SPIS tenant: ${tenant.schoolName} (${tenantId})\n`);

  const students = await User.find({ tenantId, role: 'student' })
    .select('_id admissionNumber name aadhaarNumber guardians')
    .lean();
  console.log(`SPIS students: ${students.length}\n`);

  // Counters / reports
  const stats = {
    matched: 0,
    noSourceRow: [],          // student in DB, no matching admission in CSV
    studentFilled: 0,
    studentConflict: [],      // existing non-empty differs from source (only when !OVERWRITE)
    fatherFilled: 0,
    fatherNoGuardian: [],     // source has father aadhaar but no Father guardian row
    fatherConflict: [],
    motherFilled: 0,
    motherNoGuardian: [],
    motherConflict: []
  };

  const planned = []; // { _id, set:{...}, arrayFilters:[...] }

  for (const stu of students) {
    const src = byAdmission.get(normAdm(stu.admissionNumber));
    if (!src) {
      stats.noSourceRow.push(stu.admissionNumber);
      continue;
    }
    stats.matched += 1;

    const set = {};
    const arrayFilters = [];
    const label = `${stu.admissionNumber} (${stu.name || ''})`;

    // ---- Student Aadhaar (top-level) ----
    if (src.student) {
      const cur = (stu.aadhaarNumber || '').toString().trim();
      if (!cur) {
        set.aadhaarNumber = src.student;
        stats.studentFilled += 1;
      } else if (cur !== src.student) {
        if (OVERWRITE) {
          set.aadhaarNumber = src.student;
          stats.studentFilled += 1;
        } else {
          stats.studentConflict.push(`${label}: db=${cur} csv=${src.student}`);
        }
      }
    }

    // ---- Father / Mother guardian Aadhaar ----
    const guardians = Array.isArray(stu.guardians) ? stu.guardians : [];
    const handleGuardian = (relation, srcVal, filledKey, noGuardKey, conflictKey, afId) => {
      if (!srcVal) return;
      const g = guardians.find(x => x && x.relation === relation);
      if (!g) {
        stats[noGuardKey].push(label);
        return;
      }
      const cur = (g.aadhaarNumber || '').toString().trim();
      if (!cur) {
        set[`guardians.$[${afId}].aadhaarNumber`] = srcVal;
        arrayFilters.push({ [`${afId}.relation`]: relation, [`${afId}.aadhaarNumber`]: { $in: [null, ''] } });
        stats[filledKey] += 1;
      } else if (cur !== srcVal) {
        if (OVERWRITE) {
          set[`guardians.$[${afId}].aadhaarNumber`] = srcVal;
          arrayFilters.push({ [`${afId}.relation`]: relation });
          stats[filledKey] += 1;
        } else {
          stats[conflictKey].push(`${label}: db=${cur} csv=${srcVal}`);
        }
      }
    };

    handleGuardian('Father', src.father, 'fatherFilled', 'fatherNoGuardian', 'fatherConflict', 'f');
    handleGuardian('Mother', src.mother, 'motherFilled', 'motherNoGuardian', 'motherConflict', 'm');

    if (Object.keys(set).length > 0) {
      planned.push({ _id: stu._id, set, arrayFilters });
    }
  }

  // ---- Report ----
  console.log('=== PLAN ===');
  console.log(`  Students matched to a source row:        ${stats.matched}`);
  console.log(`  Student Aadhaar to fill:                 ${stats.studentFilled}`);
  console.log(`  Father  Aadhaar to fill:                 ${stats.fatherFilled}`);
  console.log(`  Mother  Aadhaar to fill:                 ${stats.motherFilled}`);
  console.log(`  Documents to update:                     ${planned.length}\n`);

  console.log('=== SKIPPED / NEEDS ATTENTION ===');
  console.log(`  DB students with no matching CSV row:    ${stats.noSourceRow.length}`);
  console.log(`  Father aadhaar but no Father guardian:   ${stats.fatherNoGuardian.length}`);
  console.log(`  Mother aadhaar but no Mother guardian:   ${stats.motherNoGuardian.length}`);
  if (!OVERWRITE) {
    console.log(`  Student conflicts (db≠csv, kept db):     ${stats.studentConflict.length}`);
    console.log(`  Father  conflicts (db≠csv, kept db):     ${stats.fatherConflict.length}`);
    console.log(`  Mother  conflicts (db≠csv, kept db):     ${stats.motherConflict.length}`);
  }
  console.log('');

  const sample = (arr, n = 15) => arr.slice(0, n).forEach(x => console.log(`    - ${x}`));
  if (stats.noSourceRow.length)   {
    console.log('  No CSV row for admission no (first 15):'); sample(stats.noSourceRow);
  }
  if (stats.fatherNoGuardian.length) {
    console.log('  Father aadhaar present but no Father guardian (first 15):'); sample(stats.fatherNoGuardian);
  }
  if (stats.motherNoGuardian.length) {
    console.log('  Mother aadhaar present but no Mother guardian (first 15):'); sample(stats.motherNoGuardian);
  }
  if (!OVERWRITE && stats.studentConflict.length) {
    console.log('  Student conflicts (first 15):'); sample(stats.studentConflict);
  }
  if (!OVERWRITE && stats.fatherConflict.length)  {
    console.log('  Father conflicts (first 15):'); sample(stats.fatherConflict);
  }
  if (!OVERWRITE && stats.motherConflict.length)  {
    console.log('  Mother conflicts (first 15):'); sample(stats.motherConflict);
  }
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN complete. Re-run with --execute to apply.');
    process.exit(0);
  }

  if (planned.length === 0) {
    console.log('Nothing to write.');
    process.exit(0);
  }

  const BATCH = 500;
  let written = 0;
  for (let i = 0; i < planned.length; i += BATCH) {
    const chunk = planned.slice(i, i + BATCH);
    const ops = chunk.map(p => {
      const op = {
        updateOne: {
          filter: { _id: p._id, tenantId },
          update: { $set: p.set }
        }
      };
      if (p.arrayFilters.length) op.updateOne.arrayFilters = p.arrayFilters;
      return op;
    });
    const res = await User.bulkWrite(ops, { ordered: false });
    written += res.modifiedCount || 0;
    console.log(`  ${Math.min(i + BATCH, planned.length)}/${planned.length} (modified so far: ${written})`);
  }

  console.log(`\nDONE. Modified ${written} student documents.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Aadhaar backfill failed:', err);
  process.exit(1);
});
