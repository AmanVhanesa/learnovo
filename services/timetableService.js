const TimetableTemplate = require('../models/TimetableTemplate');
const TimetableEntry = require('../models/TimetableEntry');
const SchoolTiming = require('../models/SchoolTiming');
const SubjectAllocation = require('../models/SubjectAllocation');
const TeacherConstraint = require('../models/TeacherConstraint');

/**
 * Check for conflicts when placing an entry at a specific slot.
 * Returns an array of conflict objects.
 */
async function checkConflicts(tenantId, templateId, { dayOfWeek, timingSlotId, classId, sectionId, teacherId, roomId }, excludeEntryId = null) {
  const conflicts = [];

  const baseFilter = {
    tenantId,
    templateId,
    dayOfWeek,
    timingSlotId,
  };

  // Exclude an existing entry (for update operations)
  if (excludeEntryId) {
    baseFilter._id = { $ne: excludeEntryId };
  }

  // 1. Teacher double-booking: same teacher, same day, same slot
  if (teacherId) {
    const teacherConflict = await TimetableEntry.findOne({
      ...baseFilter,
      teacherId,
    }).populate('classId', 'grade').populate('subjectId', 'name').lean();

    if (teacherConflict) {
      conflicts.push({
        type: 'teacher',
        message: `Teacher is already assigned to ${teacherConflict.subjectId?.name || 'a subject'} for class ${teacherConflict.classId?.grade || 'unknown'} at this slot`,
        conflictingEntry: teacherConflict,
      });
    }
  }

  // 2. Class double-booking: same class+section, same day, same slot
  if (classId) {
    const classFilter = { ...baseFilter, classId };
    // When sectionId is provided, match that section; otherwise match entries with no section
    classFilter.sectionId = sectionId || null;
    const classConflict = await TimetableEntry.findOne(classFilter)
      .populate('subjectId', 'name')
      .populate('teacherId', 'name')
      .lean();

    if (classConflict) {
      conflicts.push({
        type: 'class',
        message: `This class/section already has ${classConflict.subjectId?.name || 'a subject'} with ${classConflict.teacherId?.name || 'a teacher'} at this slot`,
        conflictingEntry: classConflict,
      });
    }
  }

  // 3. Room double-booking: same room, same day, same slot
  if (roomId) {
    const roomConflict = await TimetableEntry.findOne({
      ...baseFilter,
      roomId,
    }).populate('classId', 'grade').populate('subjectId', 'name').lean();

    if (roomConflict) {
      conflicts.push({
        type: 'room',
        message: `Room is already booked for ${roomConflict.subjectId?.name || 'a subject'} (class ${roomConflict.classId?.grade || 'unknown'}) at this slot`,
        conflictingEntry: roomConflict,
      });
    }
  }

  return conflicts;
}

/**
 * Get summary statistics for a template.
 */
async function getTemplateStats(tenantId, templateId) {
  const [
    timingCount,
    periodCount,
    allocationCount,
    entryCount,
    constraintCount,
    teacherIds,
  ] = await Promise.all([
    SchoolTiming.countDocuments({ tenantId, templateId }),
    SchoolTiming.countDocuments({ tenantId, templateId, type: 'period' }),
    SubjectAllocation.countDocuments({ tenantId, templateId, isActive: true }),
    TimetableEntry.countDocuments({ tenantId, templateId }),
    TeacherConstraint.countDocuments({ tenantId, templateId }),
    TimetableEntry.distinct('teacherId', { tenantId, templateId }),
  ]);

  // Calculate total available slots from template working days
  const template = await TimetableTemplate.findOne({ _id: templateId, tenantId }).lean();
  const workingDayCount = template ? template.workingDays.length : 0;
  const totalSlots = periodCount * workingDayCount;

  // Check for conflicts across all entries
  const entries = await TimetableEntry.find({ tenantId, templateId }).lean();
  let conflictCount = 0;

  // Detect teacher double-bookings
  const slotMap = new Map();
  for (const entry of entries) {
    const teacherKey = `teacher-${entry.dayOfWeek}-${entry.timingSlotId}-${entry.teacherId}`;
    if (slotMap.has(teacherKey)) {
      conflictCount++;
    } else {
      slotMap.set(teacherKey, entry._id);
    }

    const classKey = `class-${entry.dayOfWeek}-${entry.timingSlotId}-${entry.classId}-${entry.sectionId || 'none'}`;
    if (slotMap.has(classKey)) {
      conflictCount++;
    } else {
      slotMap.set(classKey, entry._id);
    }
  }

  return {
    timingCount,
    periodCount,
    allocationCount,
    entryCount,
    constraintCount,
    teacherCount: teacherIds.length,
    totalSlots,
    conflictCount,
    fillPercentage: totalSlots > 0 ? Math.round((entryCount / totalSlots) * 100) : 0,
  };
}

/**
 * Validate that a template is ready for publishing.
 * Returns { valid: boolean, errors: string[] }
 */
async function validateForPublish(tenantId, templateId) {
  const errors = [];

  // 1. Template must exist and be in draft
  const template = await TimetableTemplate.findOne({ _id: templateId, tenantId }).lean();
  if (!template) {
    return { valid: false, errors: ['Template not found'] };
  }
  if (template.status !== 'draft') {
    return { valid: false, errors: [`Template is already ${template.status}`] };
  }

  // 2. Must have timing slots
  const timings = await SchoolTiming.find({ tenantId, templateId }).lean();
  if (timings.length === 0) {
    errors.push('Template has no timing slots defined');
  }

  const periodSlots = timings.filter(t => t.type === 'period');
  if (periodSlots.length === 0 && timings.length > 0) {
    errors.push('Template has no period-type timing slots');
  }

  // 3. Must have allocations
  const allocations = await SubjectAllocation.find({ tenantId, templateId, isActive: true }).lean();
  if (allocations.length === 0) {
    errors.push('Template has no subject allocations');
  }

  // 4. Check that allocations have enough entries scheduled
  const entries = await TimetableEntry.find({ tenantId, templateId }).lean();
  for (const alloc of allocations) {
    const allocEntries = entries.filter(e =>
      e.classId.toString() === alloc.classId.toString() &&
      e.subjectId.toString() === alloc.subjectId.toString() &&
      ((!e.sectionId && !alloc.sectionId) || (e.sectionId && alloc.sectionId && e.sectionId.toString() === alloc.sectionId.toString()))
    );
    if (allocEntries.length < alloc.periodsPerWeek) {
      errors.push(
        `Allocation for subject ${alloc.subjectId} in class ${alloc.classId} has ${allocEntries.length}/${alloc.periodsPerWeek} periods scheduled`
      );
    }
  }

  // 5. Check for conflicts
  const slotMap = new Map();
  for (const entry of entries) {
    const teacherKey = `teacher-${entry.dayOfWeek}-${entry.timingSlotId}-${entry.teacherId}`;
    if (slotMap.has(teacherKey)) {
      errors.push(
        `Teacher conflict: teacher ${entry.teacherId} has overlapping entries on ${entry.dayOfWeek}`
      );
    }
    slotMap.set(teacherKey, true);

    const classKey = `class-${entry.dayOfWeek}-${entry.timingSlotId}-${entry.classId}-${entry.sectionId || 'none'}`;
    if (slotMap.has(classKey)) {
      errors.push(
        `Class conflict: class ${entry.classId} has overlapping entries on ${entry.dayOfWeek}`
      );
    }
    slotMap.set(classKey, true);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Duplicate a template with all related data (timings, allocations, constraints).
 * Does NOT copy timetable entries -- user generates those fresh.
 */
async function duplicateTemplate(tenantId, sourceTemplateId, newName, userId) {
  // 1. Get the source template
  const source = await TimetableTemplate.findOne({ _id: sourceTemplateId, tenantId }).lean();
  if (!source) {
    throw new Error('Source template not found');
  }

  // 2. Create the new template
  const newTemplate = await TimetableTemplate.create({
    tenantId,
    name: newName || `${source.name} (Copy)`,
    description: source.description,
    academicSessionId: source.academicSessionId,
    status: 'draft',
    workingDays: source.workingDays,
    createdBy: userId,
    duplicatedFrom: sourceTemplateId,
    version: 1,
  });

  // 3. Copy timing slots
  const timings = await SchoolTiming.find({ tenantId, templateId: sourceTemplateId }).lean();
  const timingIdMap = new Map(); // old ID -> new ID
  if (timings.length > 0) {
    const newTimings = await SchoolTiming.insertMany(
      timings.map(t => ({
        tenantId,
        templateId: newTemplate._id,
        slotNumber: t.slotNumber,
        label: t.label,
        startTime: t.startTime,
        endTime: t.endTime,
        type: t.type,
        isActive: t.isActive,
      }))
    );
    // Build mapping for constraints that reference timing slots
    timings.forEach((oldT, i) => {
      timingIdMap.set(oldT._id.toString(), newTimings[i]._id);
    });
  }

  // 4. Copy allocations
  const allocations = await SubjectAllocation.find({ tenantId, templateId: sourceTemplateId }).lean();
  if (allocations.length > 0) {
    await SubjectAllocation.insertMany(
      allocations.map(a => ({
        tenantId,
        templateId: newTemplate._id,
        classId: a.classId,
        sectionId: a.sectionId,
        subjectId: a.subjectId,
        teacherId: a.teacherId,
        periodsPerWeek: a.periodsPerWeek,
        preferConsecutive: a.preferConsecutive,
        consecutiveCount: a.consecutiveCount,
        preferredRoomType: a.preferredRoomType,
        isActive: a.isActive,
      }))
    );
  }

  // 5. Copy constraints
  const constraints = await TeacherConstraint.find({ tenantId, templateId: sourceTemplateId }).lean();
  if (constraints.length > 0) {
    await TeacherConstraint.insertMany(
      constraints.map(c => ({
        tenantId,
        templateId: newTemplate._id,
        teacherId: c.teacherId,
        type: c.type,
        dayOfWeek: c.dayOfWeek,
        timingSlotId: c.timingSlotId ? timingIdMap.get(c.timingSlotId.toString()) || c.timingSlotId : null,
        value: c.value,
        reason: c.reason,
        priority: c.priority,
        createdBy: userId,
      }))
    );
  }

  return newTemplate;
}

module.exports = {
  checkConflicts,
  getTemplateStats,
  validateForPublish,
  duplicateTemplate,
};
