const Exam = require('../models/Exam');
const Result = require('../models/Result');
const User = require('../models/User');
const Class = require('../models/Class');

/**
 * Resolve class names a teacher is assigned to (all allocation methods).
 */
async function resolveTeacherClassNames(teacherId, tenantId) {
  const classNames = new Set();
  try {
    // 1. Class model: classTeacher or subjects[].teacher
    const directClasses = await Class.find({
      tenantId,
      $or: [{ classTeacher: teacherId }, { 'subjects.teacher': teacherId }]
    }).select('grade').lean();
    directClasses.forEach(c => c.grade && classNames.add(c.grade));

    // 2. Section model: sectionTeacher
    const Section = require('../models/Section');
    const sectionDocs = await Section.find({
      tenantId, sectionTeacher: teacherId, isActive: true
    }).select('classId').lean();
    if (sectionDocs.length > 0) {
      const ids = [...new Set(sectionDocs.map(s => s.classId?.toString()).filter(Boolean))];
      const cls = await Class.find({ _id: { $in: ids }, tenantId }).select('grade').lean();
      cls.forEach(c => c.grade && classNames.add(c.grade));
    }

    // 3. TeacherSubjectAssignment
    const TSA = require('../models/TeacherSubjectAssignment');
    const tsaDocs = await TSA.find({ teacherId, tenantId, isActive: true }).select('classId').lean();
    if (tsaDocs.length > 0) {
      const ids = [...new Set(tsaDocs.map(a => a.classId?.toString()).filter(Boolean))];
      const cls = await Class.find({ _id: { $in: ids }, tenantId }).select('grade').lean();
      cls.forEach(c => c.grade && classNames.add(c.grade));
    }

    // 4. Legacy User.assignedClasses
    const teacher = await User.findById(teacherId).select('assignedClasses').lean();
    if (teacher && Array.isArray(teacher.assignedClasses)) {
      teacher.assignedClasses.forEach(c => c && classNames.add(c));
    }
  } catch (e) {
    console.warn('resolveTeacherClassNames error:', e.message);
  }
  return [...classNames];
}

/**
 * Calculate grade from percentage.
 */
function calculateGrade(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

/**
 * Get exams visible to a student (matching their class).
 */
async function getExamsForStudent(student, tenantId) {
  const classOr = [];
  if (student.classId) classOr.push({ classId: student.classId });
  if (student.class) classOr.push({ class: student.class });

  // Resolve class document for broader matching
  if (student.classId) {
    try {
      const classDoc = await Class.findById(student.classId).select('grade name').lean();
      if (classDoc) {
        if (classDoc.grade) classOr.push({ class: classDoc.grade });
        if (classDoc.name && classDoc.name !== classDoc.grade) classOr.push({ class: classDoc.name });
      }
    } catch (_) { /* ignore */ }
  } else if (student.class) {
    try {
      const classDoc = await Class.findOne({
        tenantId,
        $or: [{ grade: student.class }, { name: student.class }]
      }).select('_id grade name').lean();
      if (classDoc) {
        classOr.push({ classId: classDoc._id });
        if (classDoc.grade && classDoc.grade !== student.class) classOr.push({ class: classDoc.grade });
        if (classDoc.name && classDoc.name !== student.class) classOr.push({ class: classDoc.name });
      }
    } catch (_) { /* ignore */ }
  }

  if (classOr.length === 0) return [];

  const filter = { tenantId, $or: classOr };

  // Section filter: show exams for student's section OR exams with no section
  if (student.section) {
    filter.$and = [{
      $or: [
        { section: student.section },
        { section: { $exists: false } },
        { section: null },
        { section: '' }
      ]
    }];
  }

  return Exam.find(filter)
    .populate('supervisor', 'name')
    .sort({ date: -1 })
    .lean();
}

/**
 * Get published results for a student.
 */
async function getResultsForStudent(studentId, tenantId) {
  return Result.find({
    tenantId,
    student: studentId,
    isPublished: true
  })
    .populate({
      path: 'exam',
      select: 'name subject class section date totalMarks passingMarks examSeries examType status'
    })
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Create or update a result for a student on an exam.
 */
async function createOrUpdateResult({ examId, studentId, marks, remarks, tenantId, updatedBy }) {
  const exam = await Exam.findOne({ _id: examId, tenantId });
  if (!exam) throw new Error('Exam not found');

  const marksObtained = Number(marks);
  if (marksObtained < 0 || marksObtained > exam.totalMarks) {
    throw new Error(`Marks must be between 0 and ${exam.totalMarks}`);
  }

  const percentage = exam.totalMarks > 0
    ? Math.round((marksObtained / exam.totalMarks) * 100 * 10) / 10
    : 0;
  const grade = calculateGrade(percentage);
  const isPassed = exam.passingMarks != null
    ? marksObtained >= exam.passingMarks
    : percentage >= 40;

  return Result.findOneAndUpdate(
    { exam: examId, student: studentId, tenantId },
    { marksObtained, percentage, grade, isPassed, remarks, tenantId, updatedBy },
    { new: true, upsert: true, runValidators: true }
  );
}

module.exports = {
  resolveTeacherClassNames,
  calculateGrade,
  getExamsForStudent,
  getResultsForStudent,
  createOrUpdateResult
};
