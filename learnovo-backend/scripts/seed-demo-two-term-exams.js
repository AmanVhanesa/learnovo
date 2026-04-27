/**
 * Seed demo exams + results for two-term report card preview.
 *
 * Per subject creates 6 exams:
 *   Term 1: UT1, SA1, Assessment
 *   Term 2: UT2, SA2, Assessment
 *
 * Results are randomized (50-95), published, status=Completed so the
 * full two-term report card renders without manual data entry.
 *
 * Usage:
 *   node scripts/seed-demo-two-term-exams.js [schoolCode] [className] [sectionName]
 *
 * Defaults: spis / "Class 1" / ROSE
 * Pass "ALL" as section to seed every section in the class.
 *
 * Tag: every exam carries description "[DEMO-2TERM]" so a future teardown
 * script can locate and remove them.
 *
 * Re-runnable: skips exams whose (name, class, section, subject, day) exists.
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const AcademicSession = require('../models/AcademicSession');
const Class = require('../models/Class');
const Section = require('../models/Section');
const User = require('../models/User');
require('../models/Subject');
const ClassSubject = require('../models/ClassSubject');
const Exam = require('../models/Exam');
const Result = require('../models/Result');

const SCHOOL_CODE = (process.argv[2] || 'spis').toLowerCase();
const CLASS_NAME = process.argv[3] || 'Class 1';
const SECTION_ARG = process.argv[4] || 'ROSE';
const TAG = '[DEMO-2TERM]';

const EXAM_DEFS = [
  { name: 'Unit Test 1',   series: 'UT1',        term: 'Term 1', dayOffset:   0 },
  { name: 'SA1',           series: 'SA1',        term: 'Term 1', dayOffset:  21 },
  { name: 'Assessment 1',  series: 'Assessment', term: 'Term 1', dayOffset:  42 },
  { name: 'Unit Test 2',   series: 'UT2',        term: 'Term 2', dayOffset:  90 },
  { name: 'SA2',           series: 'SA2',        term: 'Term 2', dayOffset: 111 },
  { name: 'Assessment 2',  series: 'Assessment', term: 'Term 2', dayOffset: 132 }
];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function calcGrade(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

async function seedSection(tenant, session, klass, sectionName, subjects) {
  const students = await User.find({
    tenantId: tenant._id,
    role: 'student',
    classId: klass._id,
    section: sectionName,
    isActive: true
  }).select('_id').lean();

  if (!students.length) {
    console.log(`  Skip ${sectionName}: no students`);
    return { exams: 0, skipped: 0, results: 0 };
  }
  console.log(`  Section ${sectionName}: ${students.length} students`);

  const baseDate = new Date();
  let exams = 0, skipped = 0, results = 0;

  for (const def of EXAM_DEFS) {
    for (const subj of subjects) {
      const examDate = new Date(baseDate.getTime() + def.dayOffset * 86400000);
      const dayStart = new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);

      const existing = await Exam.findOne({
        tenantId: tenant._id,
        name: def.name,
        class: klass.name,
        section: sectionName,
        subject: subj.name,
        date: { $gte: dayStart, $lt: dayEnd }
      });
      if (existing) {
        skipped++; continue;
      }

      const exam = await Exam.create({
        tenantId: tenant._id,
        name: def.name,
        term: def.term,
        examSeries: def.series,
        class: klass.name,
        classId: klass._id,
        section: sectionName,
        subject: subj.name,
        date: examDate,
        totalMarks: subj.maxMarks,
        passingMarks: subj.passingMarks,
        examType: 'Written',
        examMode: 'Offline',
        status: 'Completed',
        description: `${TAG} two-term report card demo`
      });
      exams++;

      const docs = students.map(st => {
        const marks = rand(50, 95);
        const pct = (marks / subj.maxMarks) * 100;
        return {
          tenantId: tenant._id,
          exam: exam._id,
          student: st._id,
          marksObtained: marks,
          percentage: Math.round(pct * 100) / 100,
          grade: calcGrade(pct),
          isPassed: marks >= subj.passingMarks,
          isPublished: true
        };
      });
      await Result.insertMany(docs, { ordered: false });
      results += docs.length;
    }
  }
  return { exams, skipped, results };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: SCHOOL_CODE });
  if (!tenant) throw new Error(`Tenant ${SCHOOL_CODE} not found`);
  console.log(`Tenant: ${tenant.schoolName}`);

  const session = await AcademicSession.findOne({ tenantId: tenant._id, isActive: true });
  if (!session) throw new Error('No active academic session');
  console.log(`Session: ${session.name}`);

  const klass = await Class.findOne({ tenantId: tenant._id, name: CLASS_NAME });
  if (!klass) throw new Error(`Class "${CLASS_NAME}" not found`);
  console.log(`Class: ${klass.name}`);

  const classSubjects = await ClassSubject.find({
    tenantId: tenant._id,
    classId: klass._id,
    academicSessionId: session._id
  }).populate('subjectId', 'name').lean();

  const subjects = classSubjects
    .filter(cs => cs.subjectId && cs.subjectId.name)
    .map(cs => ({
      name: cs.subjectId.name,
      maxMarks: cs.maxMarks || 100,
      passingMarks: cs.passingMarks || 33
    }));
  if (!subjects.length) throw new Error(`No subjects mapped to ${CLASS_NAME} for active session`);
  console.log(`Subjects (${subjects.length}): ${subjects.map(s => s.name).join(', ')}`);

  let sectionsToSeed;
  if (SECTION_ARG.toUpperCase() === 'ALL') {
    const sections = await Section.find({ tenantId: tenant._id, classId: klass._id }).select('name').lean();
    sectionsToSeed = sections.map(s => s.name);
    if (!sectionsToSeed.length) throw new Error(`No sections found for ${CLASS_NAME}`);
  } else {
    sectionsToSeed = [SECTION_ARG.toUpperCase()];
  }
  console.log(`Sections: ${sectionsToSeed.join(', ')}\n`);

  const totals = { exams: 0, skipped: 0, results: 0 };
  for (const sec of sectionsToSeed) {
    const r = await seedSection(tenant, session, klass, sec, subjects);
    totals.exams += r.exams;
    totals.skipped += r.skipped;
    totals.results += r.results;
  }

  console.log(`\nDone. exams=${totals.exams} skipped=${totals.skipped} results=${totals.results}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
