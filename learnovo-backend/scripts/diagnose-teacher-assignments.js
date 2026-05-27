/* eslint-disable no-console */
/**
 * Diagnose why a teacher's /api/teachers/my-classes returns empty.
 *
 *   node scripts/diagnose-teacher-assignments.js <teacher-email-or-name>
 *
 * Reports every linkage the my-classes endpoint checks:
 *   - Class.classTeacher
 *   - Class.subjects[].teacher
 *   - Section.sectionTeacher
 *   - TeacherSubjectAssignment
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

const User = require('../models/User');
const Class = require('../models/Class');
const Section = require('../models/Section');
const TeacherSubjectAssignment = require('../models/TeacherSubjectAssignment');
const AcademicSession = require('../models/AcademicSession');

(async() => {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/diagnose-teacher-assignments.js <email-or-name>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  const teachers = await User.find({
    role: 'teacher',
    $or: [
      { email: new RegExp(`^${arg}$`, 'i') },
      { name: new RegExp(arg, 'i') },
      { fullName: new RegExp(arg, 'i') }
    ]
  }).select('_id name fullName email tenantId role isActive');

  if (teachers.length === 0) {
    console.log(`No teachers matched "${arg}"`);
    await mongoose.disconnect();
    return;
  }

  for (const t of teachers) {
    console.log('\n========================================');
    console.log(`Teacher: ${t.fullName || t.name}  <${t.email || 'no-email'}>`);
    console.log(`  _id      : ${t._id}`);
    console.log(`  tenantId : ${t.tenantId}`);
    console.log(`  isActive : ${t.isActive}`);

    const tenantId = t.tenantId;

    const activeSession = await AcademicSession.findOne({ tenantId, isActive: true }).select('_id name');
    console.log(`  active session: ${activeSession ? `${activeSession.name} (${activeSession._id})` : 'NONE'}`);

    // Strategy 1a: classTeacher
    const asClassTeacher = await Class.find({ tenantId, classTeacher: t._id })
      .select('name grade academicYear isActive');
    console.log(`\n  [Strategy 1a] Class.classTeacher  -> ${asClassTeacher.length} class(es)`);
    asClassTeacher.forEach(c => console.log(`    - ${c.name} (grade ${c.grade}, ${c.academicYear}, active=${c.isActive})`));

    // Strategy 1b: Class.subjects[].teacher
    const asSubjectInClass = await Class.find({ tenantId, 'subjects.teacher': t._id })
      .select('name grade academicYear isActive subjects');
    console.log(`\n  [Strategy 1b] Class.subjects[].teacher  -> ${asSubjectInClass.length} class(es)`);
    asSubjectInClass.forEach(c => {
      const count = (c.subjects || []).filter(s => s.teacher && s.teacher.toString() === t._id.toString()).length;
      console.log(`    - ${c.name} (grade ${c.grade}, active=${c.isActive}, ${count} subject entries)`);
    });

    // Strategy 2: TeacherSubjectAssignment
    const assignments = await TeacherSubjectAssignment.find({ tenantId, teacherId: t._id })
      .populate('classId', 'name grade')
      .populate('subjectId', 'name subjectCode')
      .populate('sectionId', 'name')
      .populate('academicSessionId', 'name');
    console.log(`\n  [Strategy 2] TeacherSubjectAssignment  -> ${assignments.length} total`);
    assignments.forEach(a => {
      console.log(`    - class=${a.classId?.name || '?'}, subject=${a.subjectId?.name || '?'}, section=${a.sectionId?.name || 'ALL'}, session=${a.academicSessionId?.name || '?'}, isActive=${a.isActive}`);
    });
    const activeAssignments = assignments.filter(a => a.isActive);
    console.log(`    -> active only: ${activeAssignments.length}`);

    // Strategy 3: Section.sectionTeacher
    const asSectionTeacher = await Section.find({ tenantId, sectionTeacher: t._id })
      .populate('classId', 'name grade')
      .select('name classId isActive');
    console.log(`\n  [Strategy 3] Section.sectionTeacher  -> ${asSectionTeacher.length} section(s)`);
    asSectionTeacher.forEach(s => console.log(`    - class=${s.classId?.name || '?'}, section=${s.name}, active=${s.isActive}`));

    // Summary
    const totalLinks =
      asClassTeacher.length +
      asSubjectInClass.length +
      activeAssignments.length +
      asSectionTeacher.length;
    console.log(`\n  TOTAL linkages: ${totalLinks}`);
    if (totalLinks === 0) {
      console.log('  >>> This teacher has NO assignments in any strategy.');
      console.log('      /api/teachers/my-classes?strict=true will return [].');
    }
  }

  await mongoose.disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
