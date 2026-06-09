const mongoose = require('mongoose');
const User = require('../models/User');
const Class = require('../models/Class');
const Section = require('../models/Section');
const Settings = require('../models/Settings');
const StudentClassHistory = require('../models/StudentClassHistory');
const TransitionLog = require('../models/TransitionLog');
const AcademicSession = require('../models/AcademicSession');
const Result = require('../models/Result');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../middleware/errorHandler');
const { applyDateRange } = require('../utils/dateRange');

// Default class sequence fallback when no hierarchy configured
const DEFAULT_CLASS_SEQUENCE = [
  'Pre-Nursery', 'Nursery', 'LKG', 'UKG',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'
];

/**
 * Get the class hierarchy for a tenant.
 * Uses Settings.academic.classHierarchy if configured, otherwise falls back to defaults.
 */
async function getClassHierarchy(tenantId) {
  const settings = await Settings.getSettings(tenantId);
  if (settings.academic.classHierarchy && settings.academic.classHierarchy.length > 0) {
    return settings.academic.classHierarchy.sort((a, b) => a.order - b.order);
  }
  // Fallback: build from existing classes in DB
  const classes = await Class.find({ tenantId, isActive: true }).distinct('grade');
  if (classes.length > 0) {
    return buildHierarchyFromGrades(classes);
  }
  // Ultimate fallback
  return DEFAULT_CLASS_SEQUENCE.map((name, i) => ({
    name,
    order: i,
    isPrePrimary: i < 4,
    isTerminal: i === DEFAULT_CLASS_SEQUENCE.length - 1
  }));
}

/**
 * Build a hierarchy from grade strings using smart ordering.
 */
function buildHierarchyFromGrades(grades) {
  const prePrimary = { 'pre-nursery': 0, 'nursery': 1, 'lkg': 2, 'ukg': 3, 'jr. kg': 2, 'sr. kg': 3, 'playgroup': 0 };
  const sorted = grades.slice().sort((a, b) => {
    const aLower = a.toLowerCase().trim();
    const bLower = b.toLowerCase().trim();
    const aPrePri = prePrimary[aLower];
    const bPrePri = prePrimary[bLower];
    const aNum = parseInt(aLower.replace(/^class\s*/i, ''), 10);
    const bNum = parseInt(bLower.replace(/^class\s*/i, ''), 10);

    if (aPrePri !== undefined && bPrePri !== undefined) return aPrePri - bPrePri;
    if (aPrePri !== undefined) return -1;
    if (bPrePri !== undefined) return 1;
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    if (!isNaN(aNum)) return 1;
    if (!isNaN(bNum)) return -1;
    return aLower.localeCompare(bLower);
  });

  return sorted.map((name, i) => ({
    name,
    order: i,
    isPrePrimary: prePrimary[name.toLowerCase().trim()] !== undefined,
    isTerminal: i === sorted.length - 1
  }));
}

/**
 * Get the next class in the hierarchy.
 * Returns null if student is in terminal (highest) class.
 */
async function getNextClass(tenantId, currentClass) {
  const hierarchy = await getClassHierarchy(tenantId);
  const normalizedCurrent = normalizeClassName(currentClass);
  const idx = hierarchy.findIndex(h => normalizeClassName(h.name) === normalizedCurrent);
  if (idx === -1 || idx === hierarchy.length - 1) return null;
  return hierarchy[idx + 1].name;
}

/**
 * Check if a class is the terminal (highest) class.
 */
async function isTerminalClass(tenantId, className) {
  const hierarchy = await getClassHierarchy(tenantId);
  const normalizedName = normalizeClassName(className);
  const entry = hierarchy.find(h => normalizeClassName(h.name) === normalizedName);
  if (!entry) return false;
  return entry.isTerminal || entry.order === Math.max(...hierarchy.map(h => h.order));
}

function normalizeClassName(name) {
  if (!name) return '';
  return name.toString().trim().toLowerCase().replace(/^class\s+/i, '');
}

/**
 * Validate a student is eligible for transition.
 */
async function validateStudentForTransition(student, tenantId, actionType, academicYear, forceOverride = false) {
  const errors = [];

  if (!student) {
    errors.push('Student not found');
    return errors;
  }

  if (student.tenantId.toString() !== tenantId.toString()) {
    errors.push('Student does not belong to this tenant');
    return errors;
  }

  if (!student.isActive) {
    const reason = student.removalReason || 'inactive';
    errors.push(`Student is ${reason} and cannot be ${actionType}`);
  }

  if (student.role !== 'student') {
    errors.push('User is not a student');
  }

  // Check for duplicate action in same academic year (unless force override)
  if (!forceOverride && academicYear) {
    const existing = await StudentClassHistory.findOne({
      tenantId,
      studentId: student._id,
      academicYear,
      actionType: actionType === 'promotion' ? 'promoted' : actionType === 'demotion' ? 'demoted' : actionType
    });
    if (existing) {
      const displayName = student.name || student.firstName || student.admissionNumber || student._id;
      errors.push(`Student ${displayName} has already been ${actionType === 'promotion' ? 'promoted' : 'demoted'} for academic year ${academicYear}`);
    }
  }

  return errors;
}

/**
 * Resolve class and section ObjectIds from string names.
 */
async function resolveClassAndSection(tenantId, className, sectionName) {
  const classDoc = await Class.findOne({ grade: className, tenantId, isActive: true });
  let sectionDoc = null;
  if (classDoc && sectionName) {
    sectionDoc = await Section.findOne({
      tenantId,
      classId: classDoc._id,
      name: sectionName.toUpperCase(),
      isActive: true
    });
  }
  return { classDoc, sectionDoc };
}

// ─── SINGLE STUDENT PROMOTION ────────────────────────────────────────────────

async function promoteStudent({ tenantId, studentId, toClass, toSection, academicYear, remarks, forceOverride, performedBy }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const student = await User.findOne({ _id: studentId, tenantId, role: 'student' }).session(session);
    const errors = await validateStudentForTransition(student, tenantId, 'promotion', academicYear, forceOverride);
    if (errors.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors };
    }

    // Determine target class
    let targetClass = toClass;
    if (!targetClass) {
      targetClass = await getNextClass(tenantId, student.class);
      if (!targetClass) {
        // Student is in terminal class — graduate
        return await graduateStudent({ tenantId, studentId, academicYear, remarks, performedBy, session });
      }
    }

    // Validate target class exists
    const { classDoc: targetClassDoc, sectionDoc: targetSectionDoc } = await resolveClassAndSection(tenantId, targetClass, toSection || student.section);
    if (!targetClassDoc) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: [`Target class "${targetClass}" does not exist for this school`] };
    }

    // Check section capacity if section resolved
    if (targetSectionDoc && targetSectionDoc.currentStrength >= targetSectionDoc.capacity) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: [`Section ${toSection || student.section} in ${targetClass} is at full capacity (${targetSectionDoc.capacity})`] };
    }

    const fromClass = student.class;
    const fromSection = student.section;

    // Set admissionClass on first move
    if (!student.admissionClass) {
      student.admissionClass = student.class;
      student.admissionSection = student.section;
    }

    // Update student record
    student.class = targetClass;
    student.section = toSection || student.section;
    student.academicYear = academicYear;
    student.classId = targetClassDoc._id;
    if (targetSectionDoc) {
      student.sectionId = targetSectionDoc._id;
    }
    await student.save({ session });

    // Update section strengths
    await updateSectionStrength(tenantId, fromClass, fromSection, -1, session);
    await updateSectionStrength(tenantId, targetClass, student.section, 1, session);

    // Create history record
    await StudentClassHistory.create([{
      tenantId,
      studentId: student._id,
      fromClass,
      fromSection,
      toClass: targetClass,
      toSection: student.section,
      academicYear,
      actionType: 'promoted',
      performedBy,
      remarks: remarks || ''
    }], { session });

    // Create transition log
    await TransitionLog.create([{
      tenantId,
      type: 'promotion',
      studentId: student._id,
      performedBy,
      fromClass,
      fromSection,
      toClass: targetClass,
      toSection: student.section,
      fromAcademicYear: student.academicYear,
      toAcademicYear: academicYear,
      reason: remarks || ''
    }], { session });

    await session.commitTransaction();
    session.endSession();

    const displayName = student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.admissionNumber;
    logger.info(`Student promoted: ${displayName} from ${fromClass}-${fromSection} to ${targetClass}-${student.section}`, {
      tenantId, studentId: student._id, performedBy
    });

    return {
      success: true,
      data: {
        studentId: student._id,
        studentName: displayName,
        admissionNumber: student.admissionNumber,
        fromClass,
        fromSection,
        toClass: targetClass,
        toSection: student.section,
        academicYear
      }
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

// ─── SINGLE STUDENT DEMOTION ─────────────────────────────────────────────────

async function demoteStudent({ tenantId, studentId, toClass, toSection, academicYear, reason, forceOverride, performedBy }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const student = await User.findOne({ _id: studentId, tenantId, role: 'student' }).session(session);
    const errors = await validateStudentForTransition(student, tenantId, 'demotion', academicYear, forceOverride);
    if (errors.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors };
    }

    if (!toClass) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: ['Target class is required for demotion'] };
    }

    if (!reason) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: ['Reason is required for demotion'] };
    }

    const { classDoc: targetClassDoc, sectionDoc: targetSectionDoc } = await resolveClassAndSection(tenantId, toClass, toSection || student.section);
    if (!targetClassDoc) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: [`Target class "${toClass}" does not exist`] };
    }

    if (targetSectionDoc && targetSectionDoc.currentStrength >= targetSectionDoc.capacity) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: [`Section ${toSection || student.section} in ${toClass} is at full capacity`] };
    }

    const fromClass = student.class;
    const fromSection = student.section;

    if (!student.admissionClass) {
      student.admissionClass = student.class;
      student.admissionSection = student.section;
    }

    student.class = toClass;
    student.section = toSection || student.section;
    student.academicYear = academicYear;
    student.classId = targetClassDoc._id;
    if (targetSectionDoc) {
      student.sectionId = targetSectionDoc._id;
    }
    await student.save({ session });

    await updateSectionStrength(tenantId, fromClass, fromSection, -1, session);
    await updateSectionStrength(tenantId, toClass, student.section, 1, session);

    await StudentClassHistory.create([{
      tenantId,
      studentId: student._id,
      fromClass,
      fromSection,
      toClass,
      toSection: student.section,
      academicYear,
      actionType: 'demoted',
      performedBy,
      remarks: reason
    }], { session });

    await TransitionLog.create([{
      tenantId,
      type: 'demotion',
      studentId: student._id,
      performedBy,
      fromClass,
      fromSection,
      toClass,
      toSection: student.section,
      fromAcademicYear: student.academicYear,
      toAcademicYear: academicYear,
      reason
    }], { session });

    await session.commitTransaction();
    session.endSession();

    const displayName = student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.admissionNumber;
    return {
      success: true,
      data: {
        studentId: student._id,
        studentName: displayName,
        admissionNumber: student.admissionNumber,
        fromClass,
        fromSection,
        toClass,
        toSection: student.section,
        academicYear,
        reason
      }
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

// ─── GRADUATE STUDENT ────────────────────────────────────────────────────────

async function graduateStudent({ tenantId, studentId, academicYear, remarks, performedBy, session: existingSession }) {
  const ownSession = !existingSession;
  const session = existingSession || await mongoose.startSession();
  if (ownSession) session.startTransaction();

  try {
    const student = await User.findOne({ _id: studentId, tenantId, role: 'student' }).session(session);
    if (!student || !student.isActive) {
      if (ownSession) {
        await session.abortTransaction(); session.endSession();
      }
      return { success: false, errors: ['Student not found or already inactive'] };
    }

    const fromClass = student.class;
    const fromSection = student.section;

    student.isActive = false;
    student.removalDate = new Date();
    student.removalReason = 'Graduated';
    student.removalNotes = remarks || `Graduated from ${fromClass} in academic year ${academicYear}`;
    await student.save({ session });

    await updateSectionStrength(tenantId, fromClass, fromSection, -1, session);

    await StudentClassHistory.create([{
      tenantId,
      studentId: student._id,
      fromClass,
      fromSection,
      toClass: 'GRADUATED',
      toSection: '',
      academicYear,
      actionType: 'promoted',
      performedBy,
      remarks: remarks || 'Graduated — terminal class'
    }], { session });

    await TransitionLog.create([{
      tenantId,
      type: 'graduation',
      studentId: student._id,
      performedBy,
      fromClass,
      fromSection,
      toClass: 'GRADUATED',
      toSection: '',
      toAcademicYear: academicYear,
      reason: remarks || 'Graduated — terminal class'
    }], { session });

    if (ownSession) {
      await session.commitTransaction();
      session.endSession();
    }

    const displayName = student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.admissionNumber;
    return {
      success: true,
      data: {
        studentId: student._id,
        studentName: displayName,
        admissionNumber: student.admissionNumber,
        fromClass,
        fromSection,
        status: 'graduated',
        academicYear
      }
    };
  } catch (error) {
    if (ownSession) {
      await session.abortTransaction(); session.endSession();
    }
    throw error;
  }
}

// ─── BULK PROMOTION ──────────────────────────────────────────────────────────

async function bulkPromote({
  tenantId, fromClass, fromSection, toClass, toSection, academicYear,
  excludeStudentIds = [], forceOverride = false,
  remarks, performedBy
}) {
  const batchId = uuidv4();
  const results = { promoted: 0, graduated: 0, skipped: 0, failed: 0, details: [] };

  // Build query for students
  const query = {
    tenantId,
    role: 'student',
    class: fromClass,
    isActive: true
  };
  if (fromSection) query.section = fromSection;

  const students = await User.find(query).lean();
  if (students.length === 0) {
    return { success: true, data: { ...results, message: 'No students found in the specified class/section' } };
  }

  // Determine target class
  let targetClass = toClass;
  if (!targetClass) {
    targetClass = await getNextClass(tenantId, fromClass);
  }

  const isGraduation = !targetClass || await isTerminalClass(tenantId, fromClass);

  // Filter out excluded and already-processed students
  const excludeSet = new Set(excludeStudentIds.map(id => id.toString()));
  const eligibleStudents = [];

  for (const student of students) {
    const sid = student._id.toString();
    if (excludeSet.has(sid)) {
      results.skipped++;
      results.details.push({ studentId: sid, name: student.name || student.admissionNumber, status: 'skipped', reason: 'Excluded by admin' });
      continue;
    }
    if (student.removalReason === 'Transferred' || student.removalReason === 'Withdrawn' || student.removalReason === 'Expelled') {
      results.skipped++;
      results.details.push({ studentId: sid, name: student.name || student.admissionNumber, status: 'skipped', reason: student.removalReason });
      continue;
    }
    eligibleStudents.push(student);
  }

  // Process in chunks of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < eligibleStudents.length; i += CHUNK_SIZE) {
    const chunk = eligibleStudents.slice(i, i + CHUNK_SIZE);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const studentData of chunk) {
        const student = await User.findById(studentData._id).session(session);
        if (!student) continue;

        // Check for duplicate promotion
        if (!forceOverride) {
          const existing = await StudentClassHistory.findOne({
            tenantId,
            studentId: student._id,
            academicYear,
            actionType: 'promoted'
          }).session(session);
          if (existing) {
            results.skipped++;
            results.details.push({
              studentId: student._id.toString(),
              name: student.name || student.admissionNumber,
              status: 'skipped',
              reason: `Already promoted for ${academicYear}`
            });
            continue;
          }
        }

        const fromSec = student.section;

        if (isGraduation) {
          // Graduate the student
          student.isActive = false;
          student.removalDate = new Date();
          student.removalReason = 'Graduated';
          student.removalNotes = remarks || `Graduated from ${fromClass} in ${academicYear}`;
          await student.save({ session });

          await updateSectionStrength(tenantId, fromClass, fromSec, -1, session);

          await StudentClassHistory.create([{
            tenantId, studentId: student._id,
            fromClass, fromSection: fromSec,
            toClass: 'GRADUATED', toSection: '',
            academicYear, actionType: 'promoted',
            performedBy, remarks: remarks || 'Bulk graduation'
          }], { session });

          await TransitionLog.create([{
            tenantId, type: 'graduation',
            studentId: student._id, performedBy,
            fromClass, fromSection: fromSec,
            toClass: 'GRADUATED', toSection: '',
            toAcademicYear: academicYear,
            reason: remarks || 'Bulk graduation',
            batchId
          }], { session });

          results.graduated++;
          results.details.push({
            studentId: student._id.toString(),
            name: student.name || student.admissionNumber,
            status: 'graduated',
            fromClass, fromSection: fromSec
          });
        } else {
          // Promote to next class
          if (!student.admissionClass) {
            student.admissionClass = student.class;
            student.admissionSection = student.section;
          }

          const actualToSection = toSection || student.section;
          const { classDoc, sectionDoc } = await resolveClassAndSection(tenantId, targetClass, actualToSection);

          student.class = targetClass;
          student.section = actualToSection;
          student.academicYear = academicYear;
          if (classDoc) student.classId = classDoc._id;
          if (sectionDoc) student.sectionId = sectionDoc._id;
          await student.save({ session });

          await updateSectionStrength(tenantId, fromClass, fromSec, -1, session);
          await updateSectionStrength(tenantId, targetClass, actualToSection, 1, session);

          await StudentClassHistory.create([{
            tenantId, studentId: student._id,
            fromClass, fromSection: fromSec,
            toClass: targetClass, toSection: actualToSection,
            academicYear, actionType: 'promoted',
            performedBy, remarks: remarks || 'Bulk promotion'
          }], { session });

          await TransitionLog.create([{
            tenantId, type: 'promotion',
            studentId: student._id, performedBy,
            fromClass, fromSection: fromSec,
            toClass: targetClass, toSection: actualToSection,
            toAcademicYear: academicYear,
            reason: remarks || 'Bulk promotion',
            batchId
          }], { session });

          results.promoted++;
          results.details.push({
            studentId: student._id.toString(),
            name: student.name || student.admissionNumber,
            status: 'promoted',
            fromClass, fromSection: fromSec,
            toClass: targetClass, toSection: actualToSection
          });
        }
      }

      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      // Mark remaining students in this chunk as failed
      for (const s of chunk) {
        if (!results.details.find(d => d.studentId === s._id.toString())) {
          results.failed++;
          results.details.push({
            studentId: s._id.toString(),
            name: s.name || s.admissionNumber,
            status: 'failed',
            reason: error.message
          });
        }
      }
      logger.error('Bulk promotion chunk failed', error, { tenantId, batchId, chunkStart: i });
    }
  }

  logger.info(`Bulk promotion complete: ${results.promoted} promoted, ${results.graduated} graduated, ${results.skipped} skipped, ${results.failed} failed`, {
    tenantId, batchId, performedBy
  });

  return { success: true, data: { ...results, batchId } };
}

// ─── SECTION SHIFT ───────────────────────────────────────────────────────────

async function shiftSection({ tenantId, studentId, toSection, reason, performedBy }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const student = await User.findOne({ _id: studentId, tenantId, role: 'student', isActive: true }).session(session);
    if (!student) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: ['Student not found or is inactive'] };
    }

    if (!toSection) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: ['Target section is required'] };
    }

    const upperSection = toSection.toUpperCase();
    if (student.section === upperSection) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: ['Student is already in the target section'] };
    }

    // Validate target section exists
    const { sectionDoc: targetSectionDoc } = await resolveClassAndSection(tenantId, student.class, upperSection);
    if (!targetSectionDoc) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: [`Section "${upperSection}" does not exist for class ${student.class}`] };
    }

    if (targetSectionDoc.currentStrength >= targetSectionDoc.capacity) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: [`Section ${upperSection} is at full capacity (${targetSectionDoc.capacity})`] };
    }

    const fromSection = student.section;
    student.section = upperSection;
    student.sectionId = targetSectionDoc._id;
    await student.save({ session });

    await updateSectionStrength(tenantId, student.class, fromSection, -1, session);
    await updateSectionStrength(tenantId, student.class, upperSection, 1, session);

    await TransitionLog.create([{
      tenantId,
      type: 'section_shift',
      studentId: student._id,
      performedBy,
      fromClass: student.class,
      fromSection,
      toClass: student.class,
      toSection: upperSection,
      reason: reason || ''
    }], { session });

    await session.commitTransaction();
    session.endSession();

    const displayName = student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.admissionNumber;
    return {
      success: true,
      data: {
        studentId: student._id,
        studentName: displayName,
        class: student.class,
        fromSection,
        toSection: upperSection
      }
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

// ─── BULK SECTION SHIFT ─────────────────────────────────────────────────────

async function bulkShiftSection({ tenantId, className, fromSection, toSection, studentIds, performedBy }) {
  const batchId = uuidv4();
  const results = { shifted: 0, skipped: 0, failed: 0, details: [] };

  if (!toSection) return { success: false, errors: ['Target section is required'] };

  const upperTo = toSection.toUpperCase();
  const upperFrom = fromSection ? fromSection.toUpperCase() : null;

  // Validate target section
  const { sectionDoc } = await resolveClassAndSection(tenantId, className, upperTo);
  if (!sectionDoc) return { success: false, errors: [`Section "${upperTo}" does not exist for class ${className}`] };

  // Get students to shift
  const query = { tenantId, role: 'student', class: className, isActive: true };
  if (studentIds && studentIds.length > 0) {
    query._id = { $in: studentIds };
  } else if (upperFrom) {
    query.section = upperFrom;
  } else {
    return { success: false, errors: ['Either studentIds or fromSection is required'] };
  }

  const students = await User.find(query);

  const CHUNK_SIZE = 50;
  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const student of chunk) {
        if (student.section === upperTo) {
          results.skipped++;
          results.details.push({ studentId: student._id.toString(), name: student.name || student.admissionNumber, status: 'skipped', reason: 'Already in target section' });
          continue;
        }

        const oldSection = student.section;
        student.section = upperTo;
        student.sectionId = sectionDoc._id;
        await student.save({ session });

        await updateSectionStrength(tenantId, className, oldSection, -1, session);
        await updateSectionStrength(tenantId, className, upperTo, 1, session);

        await TransitionLog.create([{
          tenantId, type: 'section_shift',
          studentId: student._id, performedBy,
          fromClass: className, fromSection: oldSection,
          toClass: className, toSection: upperTo,
          batchId
        }], { session });

        results.shifted++;
        results.details.push({ studentId: student._id.toString(), name: student.name || student.admissionNumber, status: 'shifted', fromSection: oldSection, toSection: upperTo });
      }

      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      for (const s of chunk) {
        if (!results.details.find(d => d.studentId === s._id.toString())) {
          results.failed++;
          results.details.push({ studentId: s._id.toString(), name: s.name || s.admissionNumber, status: 'failed', reason: error.message });
        }
      }
    }
  }

  return { success: true, data: { ...results, batchId } };
}

// ─── SECTION MERGE ───────────────────────────────────────────────────────────

async function mergeSections({ tenantId, className, sourceSections, targetSections, distribution, manualAssignments, performedBy }) {
  const batchId = uuidv4();

  // Validate
  if (!sourceSections || sourceSections.length === 0) return { success: false, errors: ['Source sections are required'] };
  if (!targetSections || targetSections.length === 0) return { success: false, errors: ['Target sections are required'] };

  const upperSources = sourceSections.map(s => s.toUpperCase());
  const upperTargets = targetSections.map(s => s.toUpperCase());

  // Get all students from source sections
  const students = await User.find({
    tenantId, role: 'student', class: className,
    section: { $in: upperSources }, isActive: true
  });

  if (students.length === 0) {
    return { success: true, data: { merged: 0, distribution: {}, sourceSectionsRemoved: [], message: 'No students found in source sections' } };
  }

  // Build assignment map
  let assignments; // studentId -> targetSection
  if (distribution === 'manual') {
    if (!manualAssignments || Object.keys(manualAssignments).length === 0) {
      return { success: false, errors: ['Manual assignments are required when distribution is "manual"'] };
    }
    assignments = manualAssignments;
    // Validate every student has an assignment
    for (const student of students) {
      if (!assignments[student._id.toString()]) {
        return { success: false, errors: [`Student ${student.name || student.admissionNumber} is not assigned to a target section`] };
      }
    }
  } else {
    // Even distribution
    assignments = {};
    let targetIdx = 0;
    for (const student of students) {
      assignments[student._id.toString()] = upperTargets[targetIdx % upperTargets.length];
      targetIdx++;
    }
  }

  // Validate target sections exist
  for (const ts of upperTargets) {
    const { sectionDoc } = await resolveClassAndSection(tenantId, className, ts);
    if (!sectionDoc) return { success: false, errors: [`Target section "${ts}" does not exist for class ${className}`] };
  }

  // Execute in transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const distributionCount = {};
    upperTargets.forEach(t => {
      distributionCount[t] = 0;
    });

    for (const student of students) {
      const targetSec = assignments[student._id.toString()].toUpperCase();
      const fromSection = student.section;
      const { sectionDoc } = await resolveClassAndSection(tenantId, className, targetSec);

      student.section = targetSec;
      if (sectionDoc) student.sectionId = sectionDoc._id;
      await student.save({ session });

      await updateSectionStrength(tenantId, className, fromSection, -1, session);
      await updateSectionStrength(tenantId, className, targetSec, 1, session);

      await TransitionLog.create([{
        tenantId, type: 'section_merge',
        studentId: student._id, performedBy,
        fromClass: className, fromSection,
        toClass: className, toSection: targetSec,
        batchId,
        metadata: { sourceSections: upperSources, targetSections: upperTargets }
      }], { session });

      distributionCount[targetSec] = (distributionCount[targetSec] || 0) + 1;
    }

    // Deactivate empty source sections (that are not also targets)
    const sectionsToDeactivate = upperSources.filter(s => !upperTargets.includes(s));
    for (const secName of sectionsToDeactivate) {
      await Section.updateMany(
        { tenantId, name: secName, classId: { $in: await Class.find({ tenantId, grade: className }).distinct('_id') } },
        { $set: { isActive: false, currentStrength: 0 } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      data: {
        merged: students.length,
        distribution: distributionCount,
        sourceSectionsRemoved: sectionsToDeactivate,
        batchId
      }
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

// ─── SECTION SPLIT ───────────────────────────────────────────────────────────

async function splitSection({ tenantId, className, sourceSection, targetSections, distribution, manualAssignments, performedBy }) {
  // Reuse merge logic with single source
  return await mergeSections({
    tenantId, className,
    sourceSections: [sourceSection],
    targetSections,
    distribution,
    manualAssignments,
    performedBy
  });
}

// ─── ACADEMIC YEAR ROLLOVER ──────────────────────────────────────────────────

async function yearRollover({ tenantId, currentYear, newYear, promotionRules, highestClass, dryRun, performedBy }) {
  const batchId = uuidv4();
  const settings = await Settings.getSettings(tenantId);
  const hierarchy = await getClassHierarchy(tenantId);
  const rules = { ...settings.academic.promotionRules, ...promotionRules };

  // Determine terminal class
  let terminalClassName = highestClass;
  if (!terminalClassName) {
    const terminal = hierarchy.find(h => h.isTerminal);
    terminalClassName = terminal ? terminal.name : hierarchy[hierarchy.length - 1]?.name;
  }

  // Get all active students
  const allStudents = await User.find({ tenantId, role: 'student', isActive: true }).lean();

  // Group by class
  const studentsByClass = {};
  for (const s of allStudents) {
    const cls = s.class || 'Unknown';
    if (!studentsByClass[cls]) studentsByClass[cls] = [];
    studentsByClass[cls].push(s);
  }

  const summary = { totalStudents: allStudents.length, promoted: 0, detained: 0, graduated: 0, skipped: 0 };
  const byClass = {};
  const allDetails = [];

  // Process from highest class downward to avoid conflicts
  const sortedClasses = hierarchy.slice().reverse();

  for (const classEntry of sortedClasses) {
    const className = classEntry.name;
    const classStudents = studentsByClass[className] || [];
    if (classStudents.length === 0) continue;

    const classResult = { promoted: 0, detained: 0, graduated: 0, skipped: 0, details: [] };
    const isTerminal = normalizeClassName(className) === normalizeClassName(terminalClassName);
    const nextClass = isTerminal ? null : await getNextClass(tenantId, className);

    for (const studentData of classStudents) {
      // Skip TC-issued students
      if (rules.excludeTCIssued && (studentData.removalReason === 'Transferred' || !studentData.isActive)) {
        classResult.skipped++;
        summary.skipped++;
        classResult.details.push({ studentId: studentData._id, name: studentData.name || studentData.admissionNumber, status: 'skipped', reason: 'TC issued / inactive' });
        continue;
      }

      // Check pass/fail
      let passed = true;
      if (rules.autoPromotePassingStudents && rules.passThreshold > 0) {
        const results = await Result.find({ student: studentData._id, isPublished: true }).lean();
        if (results.length > 0) {
          const avgPercentage = results.reduce((sum, r) => sum + (r.percentage || 0), 0) / results.length;
          passed = avgPercentage >= rules.passThreshold;
        }
        // If no results, default to pass (teacher hasn't entered marks)
      }

      if (isTerminal && passed) {
        classResult.graduated++;
        summary.graduated++;
        classResult.details.push({
          studentId: studentData._id, name: studentData.name || studentData.admissionNumber,
          status: 'graduated', fromClass: className
        });
      } else if (passed && nextClass) {
        classResult.promoted++;
        summary.promoted++;
        classResult.details.push({
          studentId: studentData._id, name: studentData.name || studentData.admissionNumber,
          status: 'promoted', fromClass: className, toClass: nextClass
        });
      } else {
        classResult.detained++;
        summary.detained++;
        classResult.details.push({
          studentId: studentData._id, name: studentData.name || studentData.admissionNumber,
          status: 'detained', fromClass: className, reason: !passed ? 'Below pass threshold' : 'No higher class'
        });
      }
    }

    byClass[className] = classResult;
    allDetails.push(...classResult.details);
  }

  // If dry run, return preview without making changes
  if (dryRun) {
    return { success: true, data: { dryRun: true, summary, byClass, batchId } };
  }

  // Execute the actual rollover
  const CHUNK_SIZE = 50;
  for (let i = 0; i < allDetails.length; i += CHUNK_SIZE) {
    const chunk = allDetails.slice(i, i + CHUNK_SIZE);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const detail of chunk) {
        const student = await User.findById(detail.studentId).session(session);
        if (!student) continue;

        if (detail.status === 'graduated') {
          student.isActive = false;
          student.removalDate = new Date();
          student.removalReason = 'Graduated';
          student.removalNotes = `Graduated during year rollover ${currentYear} → ${newYear}`;
          await student.save({ session });

          await updateSectionStrength(tenantId, detail.fromClass, student.section, -1, session);

          await StudentClassHistory.create([{
            tenantId, studentId: student._id,
            fromClass: detail.fromClass, fromSection: student.section,
            toClass: 'GRADUATED', toSection: '',
            academicYear: newYear, actionType: 'promoted',
            performedBy, remarks: 'Year-end rollover graduation'
          }], { session });

          await TransitionLog.create([{
            tenantId, type: 'graduation',
            studentId: student._id, performedBy,
            fromClass: detail.fromClass, fromSection: student.section,
            toClass: 'GRADUATED', toSection: '',
            fromAcademicYear: currentYear, toAcademicYear: newYear,
            reason: 'Year-end rollover', batchId
          }], { session });

        } else if (detail.status === 'promoted') {
          const fromClass = student.class;
          const fromSection = student.section;

          if (!student.admissionClass) {
            student.admissionClass = student.class;
            student.admissionSection = student.section;
          }

          const { classDoc, sectionDoc } = await resolveClassAndSection(tenantId, detail.toClass, student.section);
          student.class = detail.toClass;
          student.academicYear = newYear;
          if (classDoc) student.classId = classDoc._id;
          if (sectionDoc) student.sectionId = sectionDoc._id;
          await student.save({ session });

          await updateSectionStrength(tenantId, fromClass, fromSection, -1, session);
          await updateSectionStrength(tenantId, detail.toClass, student.section, 1, session);

          await StudentClassHistory.create([{
            tenantId, studentId: student._id,
            fromClass, fromSection,
            toClass: detail.toClass, toSection: student.section,
            academicYear: newYear, actionType: 'promoted',
            performedBy, remarks: 'Year-end rollover promotion'
          }], { session });

          await TransitionLog.create([{
            tenantId, type: 'year_rollover',
            studentId: student._id, performedBy,
            fromClass, fromSection,
            toClass: detail.toClass, toSection: student.section,
            fromAcademicYear: currentYear, toAcademicYear: newYear,
            reason: 'Year-end rollover', batchId
          }], { session });

        } else if (detail.status === 'detained') {
          student.academicYear = newYear;
          await student.save({ session });

          await TransitionLog.create([{
            tenantId, type: 'year_rollover',
            studentId: student._id, performedBy,
            fromClass: student.class, fromSection: student.section,
            toClass: student.class, toSection: student.section,
            fromAcademicYear: currentYear, toAcademicYear: newYear,
            reason: 'Detained — year-end rollover', batchId
          }], { session });
        }
      }

      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      logger.error('Year rollover chunk failed', error, { tenantId, batchId, chunkStart: i });
    }
  }

  // Update academic year in settings
  settings.academic.currentYear = newYear;
  await settings.save();

  // Activate new academic session if it exists
  const newSession = await AcademicSession.findOne({ tenantId, name: newYear });
  if (newSession && !newSession.isActive) {
    await AcademicSession.updateMany({ tenantId }, { $set: { isActive: false } });
    newSession.isActive = true;
    await newSession.save();
  }

  logger.info(`Year rollover complete: ${currentYear} → ${newYear}`, {
    tenantId, batchId, performedBy, summary
  });

  return { success: true, data: { dryRun: false, summary, byClass, batchId } };
}

// ─── UNDO/ROLLBACK ──────────────────────────────────────────────────────────

async function undoTransition({ tenantId, transitionLogId, performedBy }) {
  const log = await TransitionLog.findOne({ _id: transitionLogId, tenantId });
  if (!log) return { success: false, errors: ['Transition log not found'] };
  if (log.reversedAt) return { success: false, errors: ['This transition has already been reversed'] };

  // Only allow undo within 7 days
  const daysSince = (Date.now() - log.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 7) return { success: false, errors: ['Cannot undo transitions older than 7 days'] };

  if (log.type === 'year_rollover') return { success: false, errors: ['Year rollover cannot be undone individually. Use batch undo.'] };

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const student = await User.findById(log.studentId).session(session);
    if (!student) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, errors: ['Student not found'] };
    }

    if (log.type === 'graduation') {
      student.isActive = true;
      student.removalDate = null;
      student.removalReason = '';
      student.removalNotes = '';
      student.class = log.fromClass;
      student.section = log.fromSection;

      const { classDoc, sectionDoc } = await resolveClassAndSection(tenantId, log.fromClass, log.fromSection);
      if (classDoc) student.classId = classDoc._id;
      if (sectionDoc) student.sectionId = sectionDoc._id;

      await student.save({ session });
      await updateSectionStrength(tenantId, log.fromClass, log.fromSection, 1, session);
    } else {
      // Reverse promotion/demotion/shift
      student.class = log.fromClass;
      student.section = log.fromSection;
      if (log.fromAcademicYear) student.academicYear = log.fromAcademicYear;

      const { classDoc, sectionDoc } = await resolveClassAndSection(tenantId, log.fromClass, log.fromSection);
      if (classDoc) student.classId = classDoc._id;
      if (sectionDoc) student.sectionId = sectionDoc._id;

      await student.save({ session });

      await updateSectionStrength(tenantId, log.toClass, log.toSection, -1, session);
      await updateSectionStrength(tenantId, log.fromClass, log.fromSection, 1, session);
    }

    log.reversedAt = new Date();
    log.reversedBy = performedBy;
    await log.save({ session });

    await session.commitTransaction();
    session.endSession();

    return { success: true, data: { message: 'Transition reversed successfully' } };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
}

// ─── GET TRANSITION HISTORY ──────────────────────────────────────────────────

async function getTransitionHistory({ tenantId, studentId, type, batchId, fromDate, toDate, page = 1, limit = 20 }) {
  const query = { tenantId };
  if (studentId) query.studentId = studentId;
  if (type) query.type = type;
  if (batchId) query.batchId = batchId;
  applyDateRange(query, 'createdAt', fromDate, toDate);

  const total = await TransitionLog.countDocuments(query);
  const logs = await TransitionLog.find(query)
    .populate('studentId', 'name firstName lastName admissionNumber')
    .populate('performedBy', 'name email')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return {
    success: true,
    data: logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

// ─── HELPER: UPDATE SECTION STRENGTH ─────────────────────────────────────────

async function updateSectionStrength(tenantId, className, sectionName, delta, session) {
  if (!className || !sectionName) return;

  const classDoc = await Class.findOne({ tenantId, grade: className }).session(session);
  if (!classDoc) return;

  const section = await Section.findOne({
    tenantId, classId: classDoc._id, name: sectionName.toUpperCase()
  }).session(session);
  if (!section) return;

  section.currentStrength = Math.max(0, (section.currentStrength || 0) + delta);
  await section.save({ session });
}

// ─── RECALCULATE SECTION STRENGTHS ──────────────────────────────────────────

async function recalculateSectionStrengths(tenantId) {
  const sections = await Section.find({ tenantId, isActive: true }).populate('classId');
  let updated = 0;
  const details = [];

  for (const section of sections) {
    if (!section.classId) continue;
    const count = await User.countDocuments({
      tenantId,
      role: 'student',
      isActive: true,
      classId: section.classId._id,
      sectionId: section._id
    });

    // Also count by string match for legacy data
    const countByString = await User.countDocuments({
      tenantId,
      role: 'student',
      isActive: true,
      class: section.classId.grade,
      section: section.name
    });

    const actualCount = Math.max(count, countByString);
    if (section.currentStrength !== actualCount) {
      // Use updateOne to bypass pre-validate hook (strength may exceed capacity for existing data)
      await Section.updateOne(
        { _id: section._id },
        { $set: { currentStrength: actualCount } }
      );
      updated++;
      details.push({
        class: section.classId.grade,
        section: section.name,
        oldStrength: section.currentStrength,
        newStrength: actualCount
      });
    }
  }

  return { updated, total: sections.length, details };
}

/**
 * Get sections for a specific class with student counts.
 * Returns only sections that belong to this tenant's class.
 */
async function getSectionsForClass(tenantId, className) {
  // The frontend dropdown sends the canonical Class.name (e.g. "NURSERY"), which
  // may differ from Class.grade — so resolve the class by either field. Matching
  // grade alone silently misses classes whose name !== grade, which dropped the
  // feature into the (count-less) fallback branch below.
  const classDocs = await Class.find({
    tenantId,
    isActive: true,
    $or: [{ name: className }, { grade: className }]
  });

  // Class-string variants a student record may carry (legacy string-based data).
  const classStrings = [...new Set(
    classDocs.flatMap(c => [c.name, c.grade]).concat(className).filter(Boolean)
  )];

  if (classDocs.length === 0) {
    // Fallback: no Class doc — derive sections from student records and count them.
    const studentSections = await User.distinct('section', {
      tenantId,
      role: 'student',
      class: className,
      isActive: true
    });
    const names = studentSections.filter(Boolean).sort();
    const result = [];
    for (const name of names) {
      const studentCount = await User.countDocuments({
        tenantId,
        role: 'student',
        isActive: true,
        class: className,
        section: name
      });
      result.push({ _id: null, name, capacity: 40, currentStrength: studentCount, studentCount });
    }
    return result;
  }

  const classIds = classDocs.map(c => c._id);
  const sections = await Section.find({
    tenantId,
    classId: { $in: classIds },
    isActive: true
  }).sort({ name: 1 });

  // Get student counts per section — match by sectionId (source of truth) first,
  // then fall back to classId/class-string + section name for legacy records.
  const result = [];
  for (const section of sections) {
    const studentCount = await User.countDocuments({
      tenantId,
      role: 'student',
      isActive: true,
      $or: [
        { sectionId: section._id },
        { classId: { $in: classIds }, section: section.name },
        { class: { $in: classStrings }, section: section.name }
      ]
    });

    result.push({
      _id: section._id,
      name: section.name,
      capacity: section.capacity,
      currentStrength: section.currentStrength,
      studentCount
    });
  }

  // Also check for sections that exist only in student records (legacy data)
  const sectionNames = new Set(sections.map(s => (s.name || '').toUpperCase()));
  const studentSections = await User.distinct('section', {
    tenantId,
    role: 'student',
    class: { $in: classStrings },
    isActive: true
  });
  for (const secName of studentSections) {
    if (secName && !sectionNames.has(secName.toUpperCase())) {
      const count = await User.countDocuments({
        tenantId,
        role: 'student',
        class: { $in: classStrings },
        section: secName,
        isActive: true
      });
      result.push({
        _id: null,
        name: secName,
        capacity: 40,
        currentStrength: count,
        studentCount: count
      });
    }
  }

  return result;
}

// ─── BULK SHIFT STUDENTS (by admission numbers or IDs) ─────────────────────

/**
 * Shift students to a target class + section by admission numbers or student IDs.
 * Unlike promote/demote, this is a direct placement — no hierarchy logic.
 */
async function bulkShiftStudents({
  tenantId, admissionNumbers = [], studentIds = [],
  toClass, toSection, academicYear, remarks, forceOverride = false, performedBy
}) {
  const batchId = uuidv4();
  const results = { shifted: 0, skipped: 0, failed: 0, notFound: [], details: [] };

  if (!toClass) return { success: false, errors: ['Target class is required'] };
  if (!academicYear) return { success: false, errors: ['Academic year is required'] };

  // Validate target class + section exist
  const { classDoc: targetClassDoc, sectionDoc: targetSectionDoc } = await resolveClassAndSection(tenantId, toClass, toSection);
  if (!targetClassDoc) {
    return { success: false, errors: [`Target class "${toClass}" does not exist for this school`] };
  }
  if (toSection && !targetSectionDoc) {
    return { success: false, errors: [`Section "${toSection}" does not exist for class ${toClass}`] };
  }

  // Resolve students from admission numbers and/or IDs
  const orConditions = [];
  if (admissionNumbers.length > 0) {
    // Normalize: trim whitespace, remove empty
    const cleaned = admissionNumbers
      .map(a => a.toString().trim())
      .filter(a => a.length > 0);
    if (cleaned.length > 0) {
      orConditions.push({ admissionNumber: { $in: cleaned } });
    }
  }
  if (studentIds.length > 0) {
    const validIds = studentIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length > 0) {
      orConditions.push({ _id: { $in: validIds } });
    }
  }

  if (orConditions.length === 0) {
    return { success: false, errors: ['Provide at least one admission number or student ID'] };
  }

  const students = await User.find({
    tenantId,
    role: 'student',
    $or: orConditions
  });

  if (students.length === 0) {
    return { success: false, errors: ['No students found matching the provided admission numbers or IDs'] };
  }

  // Track which admission numbers were not found
  if (admissionNumbers.length > 0) {
    const cleanedNums = admissionNumbers.map(a => a.toString().trim().toLowerCase()).filter(a => a.length > 0);
    const foundNums = new Set(students.map(s => (s.admissionNumber || '').toLowerCase()));
    results.notFound = cleanedNums.filter(n => !foundNums.has(n));
  }

  // Process in chunks
  const CHUNK_SIZE = 50;
  for (let i = 0; i < students.length; i += CHUNK_SIZE) {
    const chunk = students.slice(i, i + CHUNK_SIZE);
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const studentRef of chunk) {
        const student = await User.findById(studentRef._id).session(session);
        if (!student) {
          results.failed++;
          results.details.push({ admissionNumber: studentRef.admissionNumber, status: 'failed', reason: 'Student disappeared during processing' });
          continue;
        }

        // Skip inactive students
        if (!student.isActive) {
          results.skipped++;
          results.details.push({
            admissionNumber: student.admissionNumber,
            name: student.name || student.fullName,
            status: 'skipped',
            reason: `Student is ${student.removalReason || 'inactive'}`
          });
          continue;
        }

        // Skip if already in target class + section
        if (student.class === toClass && (!toSection || student.section === toSection.toUpperCase())) {
          results.skipped++;
          results.details.push({
            admissionNumber: student.admissionNumber,
            name: student.name || student.fullName,
            status: 'skipped',
            reason: 'Already in target class/section'
          });
          continue;
        }

        // Check for duplicate transition this year (unless force override)
        if (!forceOverride) {
          const existing = await StudentClassHistory.findOne({
            tenantId,
            studentId: student._id,
            academicYear,
            actionType: 'transferred'
          }).session(session);
          if (existing) {
            results.skipped++;
            results.details.push({
              admissionNumber: student.admissionNumber,
              name: student.name || student.fullName,
              status: 'skipped',
              reason: `Already shifted for ${academicYear}`
            });
            continue;
          }
        }

        const fromClass = student.class;
        const fromSection = student.section;

        // Preserve admission class on first move
        if (!student.admissionClass) {
          student.admissionClass = student.class;
          student.admissionSection = student.section;
        }

        // Update student
        student.class = toClass;
        student.section = toSection ? toSection.toUpperCase() : student.section;
        student.academicYear = academicYear;
        student.classId = targetClassDoc._id;
        if (targetSectionDoc) {
          student.sectionId = targetSectionDoc._id;
        }
        await student.save({ session });

        // Update section strengths
        await updateSectionStrength(tenantId, fromClass, fromSection, -1, session);
        await updateSectionStrength(tenantId, toClass, student.section, 1, session);

        // Create history
        await StudentClassHistory.create([{
          tenantId,
          studentId: student._id,
          fromClass,
          fromSection,
          toClass,
          toSection: student.section,
          academicYear,
          actionType: 'transferred',
          performedBy,
          remarks: remarks || `Bulk shift to ${toClass}-${student.section}`
        }], { session });

        // Create transition log
        await TransitionLog.create([{
          tenantId,
          type: 'section_shift',
          studentId: student._id,
          performedBy,
          fromClass,
          fromSection,
          toClass,
          toSection: student.section,
          fromAcademicYear: student.academicYear,
          toAcademicYear: academicYear,
          reason: remarks || `Bulk shift to ${toClass}-${student.section}`,
          batchId
        }], { session });

        results.shifted++;
        results.details.push({
          studentId: student._id.toString(),
          admissionNumber: student.admissionNumber,
          name: student.name || student.fullName,
          status: 'shifted',
          fromClass,
          fromSection,
          toClass,
          toSection: student.section
        });
      }

      await session.commitTransaction();
      session.endSession();
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      for (const s of chunk) {
        if (!results.details.find(d => d.studentId === s._id.toString() || d.admissionNumber === s.admissionNumber)) {
          results.failed++;
          results.details.push({
            admissionNumber: s.admissionNumber,
            name: s.name || s.fullName,
            status: 'failed',
            reason: error.message
          });
        }
      }
      logger.error('Bulk shift chunk failed', error, { tenantId, batchId, chunkStart: i });
    }
  }

  logger.info(`Bulk student shift complete: ${results.shifted} shifted, ${results.skipped} skipped, ${results.failed} failed`, {
    tenantId, batchId, performedBy
  });

  return { success: true, data: { ...results, batchId } };
}

// ─── RESOLVE STUDENTS BY ADMISSION NUMBERS ─────────────────────────────────

/**
 * Lookup students by admission numbers (for preview before shift).
 */
async function resolveStudentsByAdmissionNumbers(tenantId, admissionNumbers) {
  const cleaned = admissionNumbers
    .map(a => a.toString().trim())
    .filter(a => a.length > 0);

  if (cleaned.length === 0) return { success: false, errors: ['No admission numbers provided'] };

  const students = await User.find({
    tenantId,
    role: 'student',
    admissionNumber: { $in: cleaned }
  }).select('_id name fullName firstName lastName admissionNumber class section academicYear isActive removalReason').lean();

  const foundNums = new Set(students.map(s => (s.admissionNumber || '').toLowerCase()));
  const notFound = cleaned.filter(n => !foundNums.has(n.toLowerCase()));

  return {
    success: true,
    data: {
      students: students.map(s => ({
        _id: s._id,
        name: s.name || s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        admissionNumber: s.admissionNumber,
        class: s.class,
        section: s.section,
        academicYear: s.academicYear,
        isActive: s.isActive,
        removalReason: s.removalReason
      })),
      notFound
    }
  };
}

module.exports = {
  getClassHierarchy,
  getNextClass,
  isTerminalClass,
  promoteStudent,
  demoteStudent,
  graduateStudent,
  bulkPromote,
  shiftSection,
  bulkShiftSection,
  mergeSections,
  splitSection,
  yearRollover,
  undoTransition,
  getTransitionHistory,
  recalculateSectionStrengths,
  getSectionsForClass,
  bulkShiftStudents,
  resolveStudentsByAdmissionNumbers
};
