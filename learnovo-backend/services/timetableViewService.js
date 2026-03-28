const TimetableTemplate = require('../models/TimetableTemplate');
const TimetableEntry = require('../models/TimetableEntry');
const SchoolTiming = require('../models/SchoolTiming');
const Substitution = require('../models/Substitution');
const TimetableOverride = require('../models/TimetableOverride');
const User = require('../models/User');

/**
 * Find the published template for a tenant.
 */
async function getPublishedTemplate(tenantId, templateId) {
  if (templateId) {
    return TimetableTemplate.findOne({ _id: templateId, tenantId }).lean();
  }
  return TimetableTemplate.findOne({ tenantId, status: 'published' })
    .sort({ publishedAt: -1 })
    .lean();
}

/**
 * Get the effective schedule for a specific date.
 * Returns the day's timetable with substitutions applied and overrides respected.
 */
async function getEffectiveSchedule(tenantId, date, filters = {}) {
  // filters: { classId, sectionId, teacherId, roomId, templateId }
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // 1. Find the published template for this tenant
  const template = await getPublishedTemplate(tenantId, filters.templateId);
  if (!template) {
    return { error: 'No published timetable template found' };
  }

  // 2. Check for overrides on this date
  const override = await TimetableOverride.findOne({
    tenantId,
    templateId: template._id,
    date: targetDate
  }).lean();

  if (override) {
    // Check if override applies to the filtered class
    if (override.appliesTo === 'specific_classes' && filters.classId) {
      const classIdStr = filters.classId.toString();
      const applies = override.specificClasses.some(c => c.toString() === classIdStr);
      if (!applies) {
        // Override does not apply to this class — continue with normal schedule
      } else {
        return handleOverride(override, tenantId, template, targetDate, filters);
      }
    } else {
      return handleOverride(override, tenantId, template, targetDate, filters);
    }
  }

  return buildDaySchedule(tenantId, template, targetDate, filters);
}

/**
 * Handle an override scenario (holiday, half_day, special_schedule, etc.)
 */
async function handleOverride(override, tenantId, template, targetDate, filters) {
  if (override.type === 'holiday' || override.type === 'cancelled') {
    return {
      date: targetDate,
      dayOfWeek: getDayOfWeek(targetDate),
      isOff: true,
      reason: override.title,
      overrideType: override.type,
      entries: [],
      template: { _id: template._id, name: template.name }
    };
  }

  if (override.type === 'half_day') {
    // Build normal schedule but filter to only active slots
    const schedule = await buildDaySchedule(tenantId, template, targetDate, filters);
    if (override.activeSlots && override.activeSlots.length > 0) {
      const activeSlotIds = override.activeSlots.map(s => s.toString());
      schedule.entries = schedule.entries.filter(e => {
        const slotId = e.timingSlot?._id?.toString() || e.timingSlotId?.toString();
        return activeSlotIds.includes(slotId);
      });
    }
    schedule.isHalfDay = true;
    schedule.overrideTitle = override.title;
    schedule.overrideType = override.type;
    return schedule;
  }

  if (override.type === 'special_schedule' && override.overrideEntries && override.overrideEntries.length > 0) {
    // Use override entries instead of regular entries
    const timings = await SchoolTiming.find({
      tenantId,
      templateId: template._id
    }).sort({ slotNumber: 1 }).lean();

    const timingMap = {};
    timings.forEach(t => {
      timingMap[t._id.toString()] = t;
    });

    const entries = override.overrideEntries.map(oe => ({
      ...oe,
      timingSlot: timingMap[oe.timingSlotId?.toString()] || null,
      isOverride: true
    }));

    return {
      date: targetDate,
      dayOfWeek: getDayOfWeek(targetDate),
      isOff: false,
      overrideType: override.type,
      overrideTitle: override.title,
      entries,
      timings,
      template: { _id: template._id, name: template.name }
    };
  }

  // exam_day or other — show normal schedule with override info
  const schedule = await buildDaySchedule(tenantId, template, targetDate, filters);
  schedule.overrideType = override.type;
  schedule.overrideTitle = override.title;
  return schedule;
}

/**
 * Build the normal day schedule with substitutions merged.
 */
async function buildDaySchedule(tenantId, template, targetDate, filters) {
  const dayOfWeek = getDayOfWeek(targetDate);

  // Check if this day is a working day
  if (!template.workingDays.includes(dayOfWeek)) {
    return {
      date: targetDate,
      dayOfWeek,
      isOff: true,
      reason: 'Non-working day',
      entries: [],
      template: { _id: template._id, name: template.name }
    };
  }

  // Build entry filter
  const entryFilter = {
    tenantId,
    templateId: template._id,
    dayOfWeek
  };
  if (filters.classId) entryFilter.classId = filters.classId;
  if (filters.sectionId) entryFilter.sectionId = filters.sectionId;
  if (filters.teacherId) entryFilter.teacherId = filters.teacherId;
  if (filters.roomId) entryFilter.roomId = filters.roomId;

  // Load entries, timings, and substitutions in parallel
  const [entries, timings, substitutions] = await Promise.all([
    TimetableEntry.find(entryFilter)
      .populate('subjectId', 'name code color')
      .populate('teacherId', 'name fullName')
      .populate('classId', 'grade name')
      .populate('sectionId', 'name')
      .populate('roomId', 'name code')
      .populate('timingSlotId', 'slotNumber label startTime endTime type')
      .lean(),
    SchoolTiming.find({ tenantId, templateId: template._id })
      .sort({ slotNumber: 1 })
      .lean(),
    Substitution.find({
      tenantId,
      date: targetDate,
      status: { $in: ['pending', 'assigned'] }
    })
      .populate('substituteTeacherId', 'name fullName')
      .populate('substituteSubjectId', 'name code')
      .lean()
  ]);

  // Build substitution lookup: originalEntryId -> substitution
  const subMap = {};
  substitutions.forEach(sub => {
    subMap[sub.originalEntryId.toString()] = sub;
  });

  // Merge substitutions into entries
  const mergedEntries = entries.map(entry => {
    const sub = subMap[entry._id.toString()];
    if (sub) {
      return {
        ...entry,
        isSubstituted: true,
        originalTeacher: entry.teacherId,
        teacherId: sub.substituteTeacherId || entry.teacherId,
        substitution: {
          _id: sub._id,
          status: sub.status,
          reason: sub.reason,
          reasonNote: sub.reasonNote,
          substituteTeacher: sub.substituteTeacherId,
          substituteSubject: sub.substituteSubjectId
        }
      };
    }
    return { ...entry, isSubstituted: false };
  });

  // Sort entries by slot order
  mergedEntries.sort((a, b) => {
    const slotA = a.timingSlotId?.slotNumber || 0;
    const slotB = b.timingSlotId?.slotNumber || 0;
    return slotA - slotB;
  });

  // Determine current period (if today)
  const now = new Date();
  let currentPeriodSlotId = null;
  if (isSameDay(targetDate, now)) {
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    for (const timing of timings) {
      if (timing.startTime <= currentTime && timing.endTime > currentTime) {
        currentPeriodSlotId = timing._id.toString();
        break;
      }
    }
  }

  return {
    date: targetDate,
    dayOfWeek,
    isOff: false,
    currentPeriodSlotId,
    entries: mergedEntries,
    timings,
    template: { _id: template._id, name: template.name }
  };
}

/**
 * Get the effective schedule for a full week starting from a given date.
 */
async function getWeekSchedule(tenantId, startDate, filters = {}) {
  const template = await getPublishedTemplate(tenantId, filters.templateId);
  if (!template) {
    return { error: 'No published timetable template found' };
  }

  // Compute the Monday of the week containing startDate
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const dayIndex = start.getDay(); // 0=Sunday, 1=Monday...
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
  const monday = new Date(start);
  monday.setDate(monday.getDate() + mondayOffset);

  const days = [];
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(monday);
    currentDate.setDate(monday.getDate() + i);

    // Only include working days from the template
    if (template.workingDays.includes(dayNames[i])) {
      const daySchedule = await getEffectiveSchedule(tenantId, currentDate, {
        ...filters,
        templateId: template._id
      });
      days.push(daySchedule);
    } else {
      days.push({
        date: currentDate,
        dayOfWeek: dayNames[i],
        isOff: true,
        reason: 'Non-working day',
        entries: []
      });
    }
  }

  return {
    weekStart: monday,
    weekEnd: new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000),
    template: { _id: template._id, name: template.name },
    days
  };
}

/**
 * Get today's schedule for a specific user based on their role.
 * - Student: auto-filter by their classId + sectionId
 * - Teacher: auto-filter by their userId as teacherId
 * - Parent: get schedules for all children
 * - Admin: requires explicit filters
 */
async function getTodayForUser(tenantId, user) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (user.role) {
  case 'student': {
    if (!user.classId) {
      return { error: 'Student has no class assigned' };
    }
    const filters = { classId: user.classId };
    if (user.sectionId) filters.sectionId = user.sectionId;
    return getEffectiveSchedule(tenantId, today, filters);
  }

  case 'teacher': {
    return getEffectiveSchedule(tenantId, today, { teacherId: user._id });
  }

  case 'parent': {
    if (!user.children || user.children.length === 0) {
      return { error: 'No children linked to this parent' };
    }
    // Fetch children to get their class/section info
    const children = await User.find({
      _id: { $in: user.children },
      tenantId
    }).select('name fullName classId sectionId').lean();

    const schedules = [];
    for (const child of children) {
      if (!child.classId) continue;
      const filters = { classId: child.classId };
      if (child.sectionId) filters.sectionId = child.sectionId;
      const schedule = await getEffectiveSchedule(tenantId, today, filters);
      schedules.push({
        child: { _id: child._id, name: child.name || child.fullName },
        schedule
      });
    }
    return { children: schedules };
  }

  case 'admin':
  default:
    return getEffectiveSchedule(tenantId, today, {});
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDayOfWeek(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

module.exports = { getEffectiveSchedule, getWeekSchedule, getTodayForUser };
