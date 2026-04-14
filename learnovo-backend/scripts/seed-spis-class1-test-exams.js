/**
 * Seed test exams + random results for SPIS Class 1 ROSE.
 *
 * Creates 6 exams per subject across Term 1 / Term 2:
 *   Term 1: Unit Test 1 (UT1), Assessment Test 1 (FA1), SA1
 *   Term 2: Unit Test 2 (UT2), Assessment Test 2 (FA2), SA2
 *
 * Results are random (40-95), isPublished=false. Safe to re-run — skips
 * exams whose (name, class, section, subject, session) already exists.
 *
 * Usage:
 *   node scripts/seed-spis-class1-test-exams.js
 *
 * Every created exam is tagged with description "[TEST-SEED]" so the
 * teardown script (delete-spis-class1-test-exams.js) can find them.
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const AcademicSession = require('../models/AcademicSession');
const Class = require('../models/Class');
const User = require('../models/User');
require('../models/Subject'); // required for ClassSubject.populate
const ClassSubject = require('../models/ClassSubject');
const Exam = require('../models/Exam');
const Result = require('../models/Result');

const SCHOOL_CODE = 'spis';
const CLASS_NAME = 'Class 1';
const SECTION_NAME = 'ROSE';
const TAG = '[TEST-SEED]';

const EXAM_DEFS = [
  { name: 'Unit Test 1',       series: 'UT1', term: 'Term 1', dayOffset:   0 },
  { name: 'Assessment Test 1', series: 'FA1', term: 'Term 1', dayOffset:  14 },
  { name: 'SA1',               series: 'SA1', term: 'Term 1', dayOffset:  28 },
  { name: 'Unit Test 2',       series: 'UT2', term: 'Term 2', dayOffset:  60 },
  { name: 'Assessment Test 2', series: 'FA2', term: 'Term 2', dayOffset:  74 },
  { name: 'SA2',               series: 'SA2', term: 'Term 2', dayOffset:  88 }
];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calcGrade(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode: SCHOOL_CODE });
  if (!tenant) throw new Error(`Tenant ${SCHOOL_CODE} not found`);
  console.log(`Tenant: ${tenant.schoolName} (${tenant._id})`);

  const session = await AcademicSession.findOne({ tenantId: tenant._id, isActive: true });
  if (!session) throw new Error('No active academic session');
  console.log(`Session: ${session.name} (${session._id})`);

  const klass = await Class.findOne({ tenantId: tenant._id, name: CLASS_NAME });
  if (!klass) throw new Error(`Class ${CLASS_NAME} not found`);
  console.log(`Class: ${klass.name} (${klass._id})`);

  const students = await User.find({
    tenantId: tenant._id,
    role: 'student',
    classId: klass._id,
    section: SECTION_NAME,
    isActive: true
  }).select('_id fullName firstName admissionNumber').lean();
  if (!students.length) throw new Error(`No students in ${CLASS_NAME} ${SECTION_NAME}`);
  console.log(`Students in ${SECTION_NAME}: ${students.length}`);

  const classSubjects = await ClassSubject.find({
    tenantId: tenant._id,
    classId: klass._id,
    academicSessionId: session._id
  }).populate('subjectId', 'name').lean();
  const subjects = classSubjects
    .filter(cs => cs.subjectId && cs.subjectId.name)
    .map(cs => ({ name: cs.subjectId.name, maxMarks: cs.maxMarks || 100, passingMarks: cs.passingMarks || 33 }));
  if (!subjects.length) throw new Error('No subjects mapped to Class 1 for this session');
  console.log(`Subjects: ${subjects.map(s => s.name).join(', ')}`);

  const baseDate = new Date();
  let examsCreated = 0, examsSkipped = 0, resultsCreated = 0;

  for (const def of EXAM_DEFS) {
    for (const subj of subjects) {
      const examDate = new Date(baseDate.getTime() + def.dayOffset * 86400000);

      const existing = await Exam.findOne({
        tenantId: tenant._id,
        name: def.name,
        class: klass.name,
        section: SECTION_NAME,
        subject: subj.name,
        date: { $gte: new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate()),
          $lt: new Date(examDate.getFullYear(), examDate.getMonth(), examDate.getDate() + 1) }
      });
      if (existing) {
        examsSkipped++; continue;
      }

      const exam = await Exam.create({
        tenantId: tenant._id,
        name: def.name,
        term: def.term,
        examSeries: def.series,
        class: klass.name,
        classId: klass._id,
        section: SECTION_NAME,
        subject: subj.name,
        date: examDate,
        totalMarks: subj.maxMarks,
        passingMarks: subj.passingMarks,
        examType: 'Written',
        examMode: 'Offline',
        status: 'Completed',
        description: `${TAG} auto-generated for report card preview`
      });
      examsCreated++;

      const docs = students.map(st => {
        const marks = rand(40, 95);
        const pct = (marks / subj.maxMarks) * 100;
        return {
          tenantId: tenant._id,
          exam: exam._id,
          student: st._id,
          marksObtained: marks,
          percentage: Math.round(pct * 100) / 100,
          grade: calcGrade(pct),
          isPassed: marks >= subj.passingMarks,
          isPublished: false
        };
      });
      await Result.insertMany(docs, { ordered: false });
      resultsCreated += docs.length;
    }
  }

  console.log(`\nDone. exams created=${examsCreated}, skipped=${examsSkipped}, results=${resultsCreated}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('FAILED:', err); process.exit(1);
});
