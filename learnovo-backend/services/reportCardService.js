const Result = require('../models/Result');
const User = require('../models/User');
const Settings = require('../models/Settings');
const Section = require('../models/Section');
const Exam = require('../models/Exam');
const AcademicSession = require('../models/AcademicSession');

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  return 'F';
}

/**
 * Build the common PDF data payload from raw results + settings.
 * Shared by regular, blank, and final report card flows.
 */
function buildSchoolData(settings) {
  const inst = settings?.institution || {};
  const addressParts = [inst.address?.street, inst.address?.city, inst.address?.state].filter(Boolean);
  return {
    name: inst.name || 'School',
    address: addressParts.join(', '),
    phone: inst.contact?.phone || '',
    email: inst.contact?.email || '',
    board: inst.board || '',
    affiliation: inst.affiliationNumber || '',
    schoolCode: inst.schoolCode || '',
    udise: inst.udiseCode || '',
    logo: inst.logo || null,
    brand_color: inst.brandColor || '#1E3A5F'
  };
}

function buildStudentData(student, fallbackClass, fallbackSection) {
  return {
    name: student.fullName || student.name || '',
    admissionNumber: student.admissionNumber || '',
    class: student.class || fallbackClass || '',
    section: student.section || fallbackSection || '',
    rollNumber: student.rollNumber || '',
    dob: student.dateOfBirth || '',
    fatherOrHusbandName: student.fatherOrHusbandName || '',
    guardianName: student.guardianName || ''
  };
}

function buildSubjectsAndSummary(filtered) {
  const subjects = filtered.map(r => ({
    name: r.exam.subject,
    subject: r.exam.subject,
    examName: r.exam.name,
    date: r.exam.date,
    totalMarks: r.exam.totalMarks,
    marksObtained: r.marksObtained,
    percentage: r.percentage,
    grade: r.grade,
    isPassed: r.isPassed,
    remarks: r.remarks || ''
  }));

  const grandTotal = subjects.reduce((acc, s) => acc + s.totalMarks, 0);
  const grandObtained = subjects.reduce((acc, s) => acc + s.marksObtained, 0);
  const overallPercentage = grandTotal > 0
    ? Math.round((grandObtained / grandTotal) * 100 * 10) / 10
    : 0;
  const overallGrade = calculateGrade(overallPercentage);
  const overallPassed = subjects.every(s => s.isPassed);
  const passCount = subjects.filter(s => s.isPassed).length;

  return {
    subjects,
    summary: {
      grandTotal,
      grandObtained,
      overallPercentage,
      overallGrade,
      overallPassed,
      passCount,
      totalSubjects: subjects.length
    }
  };
}

/**
 * Fetch and filter results for a student, returning the raw filtered array + student doc.
 */
async function fetchFilteredResults(tenantId, studentId, { examSeries, className, requirePublished = false } = {}) {
  const resultFilter = { tenantId, student: studentId };
  if (requirePublished) resultFilter.isPublished = true;

  const results = await Result.find(resultFilter)
    .populate({
      path: 'exam',
      select: 'name subject class section date totalMarks passingMarks examSeries examType status'
    })
    .populate('student', 'name fullName rollNumber admissionNumber class section dateOfBirth fatherOrHusbandName guardianName photo skippedSubjects')
    .sort({ 'exam.date': 1 });

  if (!results.length) return { filtered: [], student: null };

  let filtered = results.filter(r => r.exam);
  if (examSeries) filtered = filtered.filter(r => r.exam.examSeries === examSeries);
  if (className) filtered = filtered.filter(r => r.exam.class === className);

  // Exclude skipped subjects
  const studentDoc = results[0]?.student;
  const skippedSubjects = studentDoc?.skippedSubjects || [];
  if (skippedSubjects.length > 0) {
    filtered = filtered.filter(r => !skippedSubjects.includes(r.exam.subject));
  }

  return { filtered, student: studentDoc };
}

const reportCardService = {
  /**
   * Get full report card PDF data payload for a student (regular — with marks).
   */
  async getReportCardData(tenantId, studentId, { examSeries, className, requirePublished = false } = {}) {
    const { filtered, student } = await fetchFilteredResults(tenantId, studentId, { examSeries, className, requirePublished });
    if (!filtered.length || !student) return null;

    const settings = await Settings.findOne({ tenantId });
    const { subjects, summary } = buildSubjectsAndSummary(filtered);

    return {
      school: buildSchoolData(settings),
      student: buildStudentData(student, filtered[0]?.exam?.class, filtered[0]?.exam?.section),
      exam: {
        type: examSeries || filtered[0]?.exam?.examSeries || 'Mid Term',
        academicYear: settings?.academicYear || '',
        date_issued: new Date().toISOString()
      },
      subjects,
      summary,
      attendance: null,
      signatures: {
        principal: settings?.institution?.principalSignature || null,
        class_teacher: null
      }
    };
  },

  /**
   * Get blank report card data — same structure but marks/grades are empty.
   * Used for teachers to print and fill by hand.
   */
  async getBlankReportCardData(tenantId, studentId, { examSeries, className } = {}) {
    // For blank cards, fetch student directly — don't require exam results
    const studentDoc = await User.findOne({ _id: studentId, tenantId, role: 'student' })
      .select('name fullName rollNumber admissionNumber class section dateOfBirth fatherOrHusbandName guardianName skippedSubjects classId sectionId')
      .lean();
    if (!studentDoc) return null;

    const resolvedClass = className || studentDoc.class;
    const settings = await Settings.findOne({ tenantId });

    // Try to get subject list from existing results first
    const { filtered } = await fetchFilteredResults(tenantId, studentId, { examSeries, className: resolvedClass });

    let subjects;
    if (filtered.length) {
      const seen = new Set();
      subjects = filtered
        .filter(r => {
          if (seen.has(r.exam.subject)) return false;
          seen.add(r.exam.subject);
          return true;
        })
        .map(r => ({
          name: r.exam.subject,
          subject: r.exam.subject,
          examName: '',
          date: null,
          totalMarks: r.exam.totalMarks,
          marksObtained: '',
          percentage: '',
          grade: '',
          isPassed: null,
          remarks: ''
        }));
    } else {
      // Fallback: get subjects from exams matching this student's class
      const examFilter = { tenantId };
      if (resolvedClass) examFilter.class = resolvedClass;
      if (studentDoc.classId) examFilter.classId = studentDoc.classId;
      if (examSeries) examFilter.examSeries = examSeries;
      const exams = await Exam.find(examFilter).select('subject totalMarks').lean();
      const seen = new Set();
      subjects = exams
        .filter(e => {
          if (seen.has(e.subject)) return false;
          seen.add(e.subject);
          return true;
        })
        .map(e => ({
          name: e.subject,
          subject: e.subject,
          examName: '',
          date: null,
          totalMarks: e.totalMarks,
          marksObtained: '',
          percentage: '',
          grade: '',
          isPassed: null,
          remarks: ''
        }));
    }

    return {
      school: buildSchoolData(settings),
      student: buildStudentData(studentDoc, resolvedClass, studentDoc.section),
      exam: {
        type: examSeries || 'Mid Term',
        academicYear: settings?.academicYear || '',
        date_issued: new Date().toISOString()
      },
      subjects,
      summary: {
        grandTotal: '',
        grandObtained: '',
        overallPercentage: '',
        overallGrade: '',
        overallPassed: null,
        passCount: '',
        totalSubjects: subjects.length
      },
      attendance: null,
      signatures: {
        principal: settings?.institution?.principalSignature || null,
        class_teacher: null
      },
      isBlank: true
    };
  },

  /**
   * Get final/cumulative report card data — combines ALL exam series in a session.
   * Returns per-exam columns plus totals.
   */
  async getFinalReportCardData(tenantId, studentId, sessionId) {
    // Get academic session
    const session = await AcademicSession.findOne({ _id: sessionId, tenantId });
    if (!session) return null;

    // Fetch ALL results for this student (published and unpublished)
    const allResults = await Result.find({ tenantId, student: studentId })
      .populate({
        path: 'exam',
        select: 'name subject class section date totalMarks passingMarks examSeries examType term'
      })
      .populate('student', 'name fullName rollNumber admissionNumber class section dateOfBirth fatherOrHusbandName guardianName skippedSubjects')
      .sort({ 'exam.date': 1 });

    if (!allResults.length) return null;

    // Remove results with missing exam refs
    const validResults = allResults.filter(r => r.exam);
    if (!validResults.length) return null;

    // Strategy 1: Published results within session date range (strictest)
    // Strategy 2: ALL results within session date range (if no published ones)
    // Strategy 3: Published results regardless of date range (if dates don't match)
    // Strategy 4: ALL results regardless of date range (most lenient)
    let filtered = [];

    const inDateRange = (r) => {
      const examDate = new Date(r.exam.date);
      return examDate >= session.startDate && examDate <= session.endDate;
    };

    // Try strict first: published + date range
    filtered = validResults.filter(r => r.isPublished && inDateRange(r));

    // Fallback: all results in date range (results may not be published yet)
    if (!filtered.length) {
      filtered = validResults.filter(r => inDateRange(r));
    }

    // Fallback: published results regardless of date range (session dates may be misconfigured)
    if (!filtered.length) {
      filtered = validResults.filter(r => r.isPublished);
    }

    // Final fallback: all results regardless of date range
    if (!filtered.length) {
      filtered = validResults;
    }

    // Exclude skipped subjects
    const studentDoc = validResults[0]?.student;
    const skippedSubjects = studentDoc?.skippedSubjects || [];
    if (skippedSubjects.length > 0) {
      filtered = filtered.filter(r => !skippedSubjects.includes(r.exam.subject));
    }

    if (!filtered.length) return null;

    const settings = await Settings.findOne({ tenantId });

    // Group by exam series, then by subject
    const examSeriesSet = [...new Set(filtered.map(r => r.exam.examSeries))];
    const subjectSet = [...new Set(filtered.map(r => r.exam.subject))];

    // Build per-subject, per-exam data
    const subjectRows = subjectSet.map(subject => {
      const row = { subject, exams: {}, totalMax: 0, totalObtained: 0 };

      for (const series of examSeriesSet) {
        const result = filtered.find(r => r.exam.subject === subject && r.exam.examSeries === series);
        if (result) {
          row.exams[series] = {
            totalMarks: result.exam.totalMarks,
            marksObtained: result.marksObtained,
            percentage: result.percentage,
            grade: result.grade,
            isPassed: result.isPassed
          };
          row.totalMax += result.exam.totalMarks;
          row.totalObtained += result.marksObtained;
        } else {
          row.exams[series] = null; // No exam for this subject in this series
        }
      }

      row.averagePercentage = row.totalMax > 0
        ? Math.round((row.totalObtained / row.totalMax) * 100 * 10) / 10
        : 0;
      row.finalGrade = calculateGrade(row.averagePercentage);
      row.isPassed = row.averagePercentage >= 40;

      return row;
    });

    // Overall summary
    const grandTotalMax = subjectRows.reduce((acc, r) => acc + r.totalMax, 0);
    const grandTotalObtained = subjectRows.reduce((acc, r) => acc + r.totalObtained, 0);
    const overallPercentage = grandTotalMax > 0
      ? Math.round((grandTotalObtained / grandTotalMax) * 100 * 10) / 10
      : 0;

    return {
      school: buildSchoolData(settings),
      student: buildStudentData(studentDoc, filtered[0]?.exam?.class, filtered[0]?.exam?.section),
      session: {
        name: session.name,
        startDate: session.startDate,
        endDate: session.endDate
      },
      examSeries: examSeriesSet,
      subjectRows,
      summary: {
        grandTotalMax,
        grandTotalObtained,
        overallPercentage,
        overallGrade: calculateGrade(overallPercentage),
        overallPassed: subjectRows.every(r => r.isPassed),
        passCount: subjectRows.filter(r => r.isPassed).length,
        totalSubjects: subjectRows.length
      },
      attendance: null,
      signatures: {
        principal: settings?.institution?.principalSignature || null,
        class_teacher: null
      }
    };
  },

  /**
   * Get two-term report card data for a student.
   * Groups exam results by Term 1 and Term 2 using the exam.term field.
   */
  async getTwoTermReportCardData(tenantId, studentId, sessionId) {
    const baseData = await this.getFinalReportCardData(tenantId, studentId, sessionId);
    if (!baseData) return null;

    // Re-fetch results to get term field
    const allResults = await Result.find({ tenantId, student: studentId })
      .populate({
        path: 'exam',
        select: 'name subject class section date totalMarks passingMarks examSeries examType term'
      })
      .populate('student', 'name fullName rollNumber admissionNumber class section dateOfBirth fatherOrHusbandName guardianName guardians skippedSubjects')
      .lean();

    const session = await AcademicSession.findOne({ _id: sessionId, tenantId }).lean();
    const validResults = allResults.filter(r => r.exam);

    // Filter by session date range or fallback
    const inDateRange = (r) => {
      const d = new Date(r.exam.date);
      return d >= session.startDate && d <= session.endDate;
    };
    let filtered = validResults.filter(r => r.isPublished && inDateRange(r));
    if (!filtered.length) filtered = validResults.filter(r => inDateRange(r));
    if (!filtered.length) filtered = validResults.filter(r => r.isPublished);
    if (!filtered.length) filtered = validResults;

    // Exclude skipped subjects
    const studentDoc = validResults[0]?.student;
    const skipped = studentDoc?.skippedSubjects || [];
    if (skipped.length) filtered = filtered.filter(r => !skipped.includes(r.exam.subject));
    if (!filtered.length) return null;

    // Group by term
    const term1Results = filtered.filter(r => (r.exam.term || 'Term 1') === 'Term 1');
    const term2Results = filtered.filter(r => r.exam.term === 'Term 2');

    // Get unique exam types per term
    const t1ExamTypes = [...new Set(term1Results.map(r => r.exam.examSeries))];
    const t2ExamTypes = [...new Set(term2Results.map(r => r.exam.examSeries))];

    // Build term exam definitions with max marks
    const buildExamDefs = (results, types) => types.map(type => {
      const sample = results.find(r => r.exam.examSeries === type);
      return { name: type, maxMarks: sample?.exam?.totalMarks || 100 };
    });

    const term1Exams = buildExamDefs(term1Results, t1ExamTypes);
    const term2Exams = buildExamDefs(term2Results, t2ExamTypes);

    // Build subject rows
    const subjectSet = [...new Set(filtered.map(r => r.exam.subject))];

    const subjectRows = subjectSet.map(subject => {
      const marks = {};
      let t1Total = 0, t1Max = 0, t2Total = 0, t2Max = 0;

      for (const r of filtered.filter(res => res.exam.subject === subject)) {
        const term = r.exam.term || 'Term 1';
        const series = r.exam.examSeries;
        marks[series] = r.marksObtained;

        if (term === 'Term 1') {
          t1Total += r.marksObtained; t1Max += r.exam.totalMarks;
        } else {
          t2Total += r.marksObtained; t2Max += r.exam.totalMarks;
        }
      }

      const t1Pct = t1Max > 0 ? Math.round((t1Total / t1Max) * 100 * 10) / 10 : 0;
      const t2Pct = t2Max > 0 ? Math.round((t2Total / t2Max) * 100 * 10) / 10 : 0;

      return {
        subject, marks,
        term1Total: t1Total, term1Max: t1Max, term1Pct: t1Pct, term1Grade: calculateGrade(t1Pct),
        term2Total: t2Total, term2Max: t2Max, term2Pct: t2Pct, term2Grade: calculateGrade(t2Pct),
        overallPct: (t1Max + t2Max) > 0 ? Math.round(((t1Total + t2Total) / (t1Max + t2Max)) * 100 * 10) / 10 : 0,
        isPassed: ((t1Max + t2Max) > 0 ? ((t1Total + t2Total) / (t1Max + t2Max)) * 100 : 0) >= 33
      };
    });

    // Grand totals
    const gT1Total = subjectRows.reduce((a, r) => a + r.term1Total, 0);
    const gT1Max = subjectRows.reduce((a, r) => a + r.term1Max, 0);
    const gT2Total = subjectRows.reduce((a, r) => a + r.term2Total, 0);
    const gT2Max = subjectRows.reduce((a, r) => a + r.term2Max, 0);
    const gT1Pct = gT1Max > 0 ? Math.round((gT1Total / gT1Max) * 100 * 10) / 10 : 0;
    const gT2Pct = gT2Max > 0 ? Math.round((gT2Total / gT2Max) * 100 * 10) / 10 : 0;
    const gOverallPct = (gT1Max + gT2Max) > 0 ? Math.round(((gT1Total + gT2Total) / (gT1Max + gT2Max)) * 100 * 10) / 10 : 0;
    const overallPassed = subjectRows.every(r => r.isPassed);

    const settings = await Settings.findOne({ tenantId });

    return {
      school: buildSchoolData(settings),
      student: {
        ...buildStudentData(studentDoc, filtered[0]?.exam?.class, filtered[0]?.exam?.section),
        fatherName: studentDoc?.fatherOrHusbandName
          || (studentDoc?.guardians || []).find(g => /father/i.test(g.relation))?.name
          || '',
        motherName: (studentDoc?.guardians || []).find(g => /mother/i.test(g.relation))?.name || ''
      },
      session: { name: session.name },
      term1: { exams: term1Exams },
      term2: { exams: term2Exams },
      subjectRows,
      coScholastic: (settings?.academic?.coScholasticAreas || [])
        .filter(a => a.isActive !== false && a.area)
        .map(a => ({ area: a.area, term1Grade: 'A', term2Grade: 'A' })),
      summary: {
        term1Total: gT1Total, term1Max: gT1Max, term1Percentage: gT1Pct, term1Grade: calculateGrade(gT1Pct),
        term2Total: gT2Total, term2Max: gT2Max, term2Percentage: gT2Pct, term2Grade: calculateGrade(gT2Pct),
        overallPercentage: gOverallPct, overallGrade: calculateGrade(gOverallPct),
        overallPassed
      },
      remarks: '',
      result: overallPassed ? 'Promoted' : 'Not Promoted',
      signatures: {
        principal: settings?.institution?.principalSignature || null,
        class_teacher: null
      }
    };
  },

  /**
   * Get all students in a section (for bulk operations).
   */
  async getStudentsInSection(tenantId, sectionId) {
    const section = await Section.findOne({ _id: sectionId, tenantId }).populate('classId', 'name grade');
    if (!section) return { students: [], section: null };

    // Try finding by sectionId first (modern enrollment)
    let students = await User.find({
      tenantId,
      role: 'student',
      sectionId,
      isActive: true
    })
      .select('_id name fullName rollNumber admissionNumber class section')
      .sort({ rollNumber: 1, name: 1 })
      .lean();

    // Fallback: find by string class + section name (legacy/imported students)
    if (!students.length && section.classId) {
      const className = section.classId.name || section.classId.grade;
      students = await User.find({
        tenantId,
        role: 'student',
        isActive: true,
        section: section.name,
        $or: [
          { classId: section.classId._id },
          { class: className }
        ]
      })
        .select('_id name fullName rollNumber admissionNumber class section')
        .sort({ rollNumber: 1, name: 1 })
        .lean();
    }

    return { students, section };
  }
};

module.exports = reportCardService;
