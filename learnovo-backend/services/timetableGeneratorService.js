const { performance } = require('perf_hooks');
const TimetableTemplate = require('../models/TimetableTemplate');
const TimetableEntry = require('../models/TimetableEntry');
const SchoolTiming = require('../models/SchoolTiming');
const SubjectAllocation = require('../models/SubjectAllocation');
const TeacherConstraint = require('../models/TeacherConstraint');
const Room = require('../models/Room');

const DAY_ORDER = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };
const TIMEOUT_MS = 30000;
const MAX_BACKTRACKS = 50000;

/**
 * Timetable Auto-Generator using CSP with Backtracking
 *
 * Solves the school timetable as a Constraint Satisfaction Problem.
 * Uses MRV (Minimum Remaining Values) heuristic for variable ordering.
 */
async function generateTimetable(tenantId, templateId, options = {}) {
  const startTime = performance.now();
  const { keepLocked = true, classId = null } = options;

  // ── 1. Load all required data ──────────────────────────────────────────────

  const [template, timings, allAllocations, constraints, rooms, existingEntries] = await Promise.all([
    TimetableTemplate.findOne({ _id: templateId, tenantId }).lean(),
    SchoolTiming.find({ tenantId, templateId, type: 'period', isActive: true }).sort({ slotNumber: 1 }).lean(),
    SubjectAllocation.find({
      tenantId,
      templateId,
      isActive: true,
      ...(classId ? { classId } : {}),
    }).lean(),
    TeacherConstraint.find({ tenantId, templateId }).lean(),
    Room.find({ tenantId, isActive: true }).lean(),
    TimetableEntry.find({ tenantId, templateId }).lean(),
  ]);

  if (!template) {
    throw new Error('Template not found');
  }

  const workingDays = template.workingDays || [];
  if (workingDays.length === 0 || timings.length === 0 || allAllocations.length === 0) {
    return {
      entriesCreated: 0,
      unassigned: [],
      softViolations: [],
      generationTimeMs: Math.round(performance.now() - startTime),
    };
  }

  // ── 2. Clear existing non-locked entries ───────────────────────────────────

  const clearFilter = { tenantId, templateId };
  if (!keepLocked) {
    // Clear everything (or for specific class)
    if (classId) clearFilter.classId = classId;
  } else {
    // Keep locked entries
    clearFilter.lockedByUser = { $ne: true };
    if (classId) clearFilter.classId = classId;
  }
  await TimetableEntry.deleteMany(clearFilter);

  // Reload locked entries that survive the clear
  const lockedEntries = keepLocked
    ? await TimetableEntry.find({ tenantId, templateId, lockedByUser: true }).lean()
    : [];

  // ── 3. Build the problem ───────────────────────────────────────────────────

  // Build slot list: every (day, timingSlot) pair
  const slots = [];
  for (const day of workingDays) {
    for (const timing of timings) {
      slots.push({ day, slotId: timing._id.toString(), slotNumber: timing.slotNumber });
    }
  }

  // Index constraints by teacher for fast lookup
  const constraintsByTeacher = new Map();
  for (const c of constraints) {
    const tid = c.teacherId.toString();
    if (!constraintsByTeacher.has(tid)) constraintsByTeacher.set(tid, []);
    constraintsByTeacher.get(tid).push(c);
  }

  // Index rooms by type for room assignment
  const roomsByType = new Map();
  for (const room of rooms) {
    if (!roomsByType.has(room.type)) roomsByType.set(room.type, []);
    roomsByType.get(room.type).push(room);
  }

  // Expand allocations into individual tasks
  // Each allocation with periodsPerWeek=N becomes N tasks (or grouped for consecutive)
  const tasks = [];
  for (const alloc of allAllocations) {
    const allocId = alloc._id.toString();
    const teacherId = alloc.teacherId.toString();
    const classIdStr = alloc.classId.toString();
    const sectionIdStr = alloc.sectionId ? alloc.sectionId.toString() : null;
    const subjectId = alloc.subjectId.toString();

    // Count how many periods are already placed (locked) for this allocation
    const lockedCount = lockedEntries.filter(e =>
      e.classId.toString() === classIdStr &&
      e.subjectId.toString() === subjectId &&
      ((!e.sectionId && !sectionIdStr) || (e.sectionId && sectionIdStr && e.sectionId.toString() === sectionIdStr))
    ).length;

    const remaining = Math.max(0, alloc.periodsPerWeek - lockedCount);

    if (alloc.preferConsecutive && alloc.consecutiveCount > 1) {
      // Group into consecutive blocks
      const blockSize = alloc.consecutiveCount;
      const fullBlocks = Math.floor(remaining / blockSize);
      const leftover = remaining % blockSize;

      for (let i = 0; i < fullBlocks; i++) {
        tasks.push({
          allocId, teacherId, classId: classIdStr, sectionId: sectionIdStr,
          subjectId, preferredRoomType: alloc.preferredRoomType || null,
          consecutiveCount: blockSize, isConsecutive: true,
        });
      }
      // Leftover singles
      for (let i = 0; i < leftover; i++) {
        tasks.push({
          allocId, teacherId, classId: classIdStr, sectionId: sectionIdStr,
          subjectId, preferredRoomType: alloc.preferredRoomType || null,
          consecutiveCount: 1, isConsecutive: false,
        });
      }
    } else {
      // Individual periods
      for (let i = 0; i < remaining; i++) {
        tasks.push({
          allocId, teacherId, classId: classIdStr, sectionId: sectionIdStr,
          subjectId, preferredRoomType: alloc.preferredRoomType || null,
          consecutiveCount: 1, isConsecutive: false,
        });
      }
    }
  }

  // ── 4. Initialize occupied state from locked entries ───────────────────────

  // teacherSlots: `${day}-${slotId}` -> Set of teacherIds
  const teacherSlots = new Map();
  // classSlots: `${day}-${slotId}-${classId}-${sectionId}` -> true
  const classSlots = new Map();
  // roomSlots: `${day}-${slotId}` -> Set of roomIds
  const roomSlots = new Map();
  // teacherDayCounts: `${teacherId}-${day}` -> count
  const teacherDayCounts = new Map();
  // classDaySubjects: `${classId}-${sectionId}-${day}` -> [subjectIds]
  const classDaySubjects = new Map();

  function tsKey(day, slotId) { return `${day}-${slotId}`; }
  function csKey(day, slotId, cid, sid) { return `${day}-${slotId}-${cid}-${sid || 'none'}`; }
  function tdKey(tid, day) { return `${tid}-${day}`; }
  function cdKey(cid, sid, day) { return `${cid}-${sid || 'none'}-${day}`; }

  function addToSetMap(map, key, value) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  }

  function removeFromSetMap(map, key, value) {
    const s = map.get(key);
    if (s) { s.delete(value); if (s.size === 0) map.delete(key); }
  }

  // Seed state from locked entries
  for (const entry of lockedEntries) {
    const day = entry.dayOfWeek;
    const slotId = entry.timingSlotId.toString();
    const tid = entry.teacherId.toString();
    const cid = entry.classId.toString();
    const sid = entry.sectionId ? entry.sectionId.toString() : null;

    addToSetMap(teacherSlots, tsKey(day, slotId), tid);
    classSlots.set(csKey(day, slotId, cid, sid), true);
    if (entry.roomId) addToSetMap(roomSlots, tsKey(day, slotId), entry.roomId.toString());
    teacherDayCounts.set(tdKey(tid, day), (teacherDayCounts.get(tdKey(tid, day)) || 0) + 1);

    const cdKeyStr = cdKey(cid, sid, day);
    if (!classDaySubjects.has(cdKeyStr)) classDaySubjects.set(cdKeyStr, []);
    classDaySubjects.get(cdKeyStr).push(entry.subjectId.toString());
  }

  // ── 5. Sort tasks by MRV (most constrained first) ─────────────────────────

  function countValidSlots(task) {
    let count = 0;
    for (const slot of slots) {
      if (isValidPlacement(task, slot)) count++;
    }
    return count;
  }

  function getTeacherConstraintCount(teacherId) {
    return (constraintsByTeacher.get(teacherId) || []).length;
  }

  // Score tasks for ordering: lower = more constrained = process first
  tasks.sort((a, b) => {
    // Consecutive blocks are more constrained
    if (a.isConsecutive !== b.isConsecutive) return a.isConsecutive ? -1 : 1;
    // Tasks requiring specific room types (non-classroom) first
    const aHasRoom = a.preferredRoomType && a.preferredRoomType !== 'classroom' ? 1 : 0;
    const bHasRoom = b.preferredRoomType && b.preferredRoomType !== 'classroom' ? 1 : 0;
    if (aHasRoom !== bHasRoom) return bHasRoom - aHasRoom;
    // Teachers with more constraints first
    const aCon = getTeacherConstraintCount(a.teacherId);
    const bCon = getTeacherConstraintCount(b.teacherId);
    if (aCon !== bCon) return bCon - aCon;
    return 0;
  });

  // ── 6. Hard constraint checks ─────────────────────────────────────────────

  function isTeacherUnavailable(teacherId, day, slotId) {
    const tc = constraintsByTeacher.get(teacherId);
    if (!tc) return false;
    for (const c of tc) {
      if (c.type === 'unavailable') {
        // Unavailable for specific day+slot, or whole day (no slot), or specific slot any day
        const dayMatch = !c.dayOfWeek || c.dayOfWeek === day;
        const slotMatch = !c.timingSlotId || c.timingSlotId.toString() === slotId;
        if (dayMatch && slotMatch) return true;
      }
    }
    return false;
  }

  function getMaxPeriodsPerDay(teacherId) {
    const tc = constraintsByTeacher.get(teacherId);
    if (!tc) return Infinity;
    for (const c of tc) {
      if (c.type === 'maxPeriodsPerDay' && c.value) return c.value;
    }
    return Infinity;
  }

  // Pre-compute max periods per day for each teacher
  const teacherMaxPerDay = new Map();
  for (const [tid, tcs] of constraintsByTeacher) {
    for (const c of tcs) {
      if (c.type === 'maxPeriodsPerDay' && c.value) {
        teacherMaxPerDay.set(tid, c.value);
        break;
      }
    }
  }

  function getSlotBySlotNumber(slotNum) {
    return timings.find(t => t.slotNumber === slotNum);
  }

  function isNoFirstPeriod(teacherId) {
    const tc = constraintsByTeacher.get(teacherId);
    if (!tc) return false;
    return tc.some(c => c.type === 'noFirstPeriod');
  }

  function isNoLastPeriod(teacherId) {
    const tc = constraintsByTeacher.get(teacherId);
    if (!tc) return false;
    return tc.some(c => c.type === 'noLastPeriod');
  }

  const firstSlotNumber = Math.min(...timings.map(t => t.slotNumber));
  const lastSlotNumber = Math.max(...timings.map(t => t.slotNumber));

  function isValidPlacement(task, slot) {
    const { teacherId, classId: cid, sectionId: sid } = task;
    const { day, slotId } = slot;

    // Teacher not already teaching at this slot
    const tsSet = teacherSlots.get(tsKey(day, slotId));
    if (tsSet && tsSet.has(teacherId)) return false;

    // Class+section not already booked at this slot
    if (classSlots.has(csKey(day, slotId, cid, sid))) return false;

    // Teacher not unavailable
    if (isTeacherUnavailable(teacherId, day, slotId)) return false;

    // Teacher max periods per day
    const maxPerDay = teacherMaxPerDay.get(teacherId) || Infinity;
    const currentCount = teacherDayCounts.get(tdKey(teacherId, day)) || 0;
    if (currentCount >= maxPerDay) return false;

    // noFirstPeriod / noLastPeriod constraints
    if (slot.slotNumber === firstSlotNumber && isNoFirstPeriod(teacherId)) return false;
    if (slot.slotNumber === lastSlotNumber && isNoLastPeriod(teacherId)) return false;

    return true;
  }

  // Check validity for consecutive block: task needs `consecutiveCount` adjacent slots on the same day
  function isValidConsecutivePlacement(task, day, startSlotIdx) {
    const count = task.consecutiveCount;
    // All consecutive slots on the same day must be available
    const daySlots = slots.filter(s => s.day === day);
    daySlots.sort((a, b) => a.slotNumber - b.slotNumber);

    if (startSlotIdx + count > daySlots.length) return false;

    for (let i = 0; i < count; i++) {
      const slot = daySlots[startSlotIdx + i];
      // Verify they are actually consecutive slot numbers
      if (i > 0 && daySlots[startSlotIdx + i].slotNumber !== daySlots[startSlotIdx + i - 1].slotNumber + 1) {
        return false;
      }
      if (!isValidPlacement(task, slot)) return false;
    }
    return true;
  }

  // ── 7. Soft constraint scoring ─────────────────────────────────────────────

  function scorePlacement(task, slot) {
    let score = 0;
    const { teacherId, classId: cid, sectionId: sid, subjectId } = task;
    const { day, slotNumber } = slot;

    // Spread subjects across the week: penalize if this subject already appears on this day
    const cdKeyStr = cdKey(cid, sid, day);
    const daySubjects = classDaySubjects.get(cdKeyStr) || [];
    const subjectCountToday = daySubjects.filter(s => s === subjectId).length;
    score -= subjectCountToday * 10;

    // Avoid same subject on consecutive periods for this class
    const prevSlotNum = slotNumber - 1;
    const nextSlotNum = slotNumber + 1;
    for (const s of daySubjects) {
      // Check if the subject is in an adjacent slot (approximate check via count)
    }
    // More precise: check if this subject is placed in adjacent slot
    const adjacentSlots = slots.filter(s =>
      s.day === day && (s.slotNumber === prevSlotNum || s.slotNumber === nextSlotNum)
    );
    for (const adj of adjacentSlots) {
      const adjCSKey = csKey(day, adj.slotId, cid, sid);
      if (classSlots.has(adjCSKey)) {
        // Find what subject is there - check classDaySubjects
        // Approximate: penalize if same subject count is high
        score -= subjectCountToday * 3;
      }
    }

    // Balance teacher workload across days
    const currentDayCount = teacherDayCounts.get(tdKey(teacherId, day)) || 0;
    score -= currentDayCount * 2; // Prefer days where teacher has fewer periods

    // Prefer morning slots slightly (lower slot numbers)
    if (slotNumber <= Math.ceil(timings.length / 2)) {
      score += 1; // Small preference for earlier slots
    }

    // Respect teacher preferred slots
    const tc = constraintsByTeacher.get(teacherId) || [];
    for (const c of tc) {
      if (c.type === 'preferred') {
        const dayMatch = !c.dayOfWeek || c.dayOfWeek === day;
        const slotMatch = !c.timingSlotId || c.timingSlotId.toString() === slot.slotId;
        if (dayMatch && slotMatch) score += 5 * (c.priority || 5);
      }
    }

    return score;
  }

  // ── 8. Placement helpers ───────────────────────────────────────────────────

  function placeTask(task, slot) {
    const { teacherId, classId: cid, sectionId: sid, subjectId } = task;
    const { day, slotId } = slot;

    addToSetMap(teacherSlots, tsKey(day, slotId), teacherId);
    classSlots.set(csKey(day, slotId, cid, sid), true);
    teacherDayCounts.set(tdKey(teacherId, day), (teacherDayCounts.get(tdKey(teacherId, day)) || 0) + 1);

    const cdKeyStr = cdKey(cid, sid, day);
    if (!classDaySubjects.has(cdKeyStr)) classDaySubjects.set(cdKeyStr, []);
    classDaySubjects.get(cdKeyStr).push(subjectId);
  }

  function unplaceTask(task, slot) {
    const { teacherId, classId: cid, sectionId: sid, subjectId } = task;
    const { day, slotId } = slot;

    removeFromSetMap(teacherSlots, tsKey(day, slotId), teacherId);
    classSlots.delete(csKey(day, slotId, cid, sid));
    const tdKeyStr = tdKey(teacherId, day);
    const count = teacherDayCounts.get(tdKeyStr) || 0;
    if (count <= 1) teacherDayCounts.delete(tdKeyStr);
    else teacherDayCounts.set(tdKeyStr, count - 1);

    const cdKeyStr = cdKey(cid, sid, day);
    const arr = classDaySubjects.get(cdKeyStr);
    if (arr) {
      const idx = arr.lastIndexOf(subjectId);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) classDaySubjects.delete(cdKeyStr);
    }
  }

  // ── 9. Backtracking solver ─────────────────────────────────────────────────

  // Track the assignment for each task: taskIndex -> slot(s)
  const assignments = new Array(tasks.length).fill(null);
  let backtracks = 0;
  let timedOut = false;

  // Fisher-Yates shuffle
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function solve(taskIndex) {
    // Check timeout and backtrack limit
    if (performance.now() - startTime > TIMEOUT_MS) { timedOut = true; return false; }
    if (backtracks > MAX_BACKTRACKS) { timedOut = true; return false; }

    if (taskIndex >= tasks.length) return true; // All placed

    const task = tasks[taskIndex];

    if (task.isConsecutive && task.consecutiveCount > 1) {
      // Handle consecutive period blocks
      return solveConsecutive(taskIndex, task);
    }

    // Get valid slots
    const candidates = [];
    for (const slot of slots) {
      if (isValidPlacement(task, slot)) {
        candidates.push({ slot, score: scorePlacement(task, slot) });
      }
    }

    // Shuffle for variety, then sort by score descending
    shuffle(candidates);
    candidates.sort((a, b) => b.score - a.score);

    for (const { slot } of candidates) {
      placeTask(task, slot);
      assignments[taskIndex] = [slot];

      if (solve(taskIndex + 1)) return true;

      // Backtrack
      unplaceTask(task, slot);
      assignments[taskIndex] = null;
      backtracks++;

      if (timedOut) return false;
    }

    return false;
  }

  function solveConsecutive(taskIndex, task) {
    const count = task.consecutiveCount;
    const candidateBlocks = [];

    for (const day of workingDays) {
      const daySlots = slots.filter(s => s.day === day);
      daySlots.sort((a, b) => a.slotNumber - b.slotNumber);

      for (let startIdx = 0; startIdx <= daySlots.length - count; startIdx++) {
        // Check consecutive slot numbers
        let consecutive = true;
        for (let i = 1; i < count; i++) {
          if (daySlots[startIdx + i].slotNumber !== daySlots[startIdx + i - 1].slotNumber + 1) {
            consecutive = false;
            break;
          }
        }
        if (!consecutive) continue;

        // Check all slots are valid
        let allValid = true;
        let totalScore = 0;
        for (let i = 0; i < count; i++) {
          if (!isValidPlacement(task, daySlots[startIdx + i])) {
            allValid = false;
            break;
          }
          totalScore += scorePlacement(task, daySlots[startIdx + i]);
        }

        if (allValid) {
          const blockSlots = [];
          for (let i = 0; i < count; i++) blockSlots.push(daySlots[startIdx + i]);
          candidateBlocks.push({ blockSlots, score: totalScore });
        }
      }
    }

    shuffle(candidateBlocks);
    candidateBlocks.sort((a, b) => b.score - a.score);

    for (const { blockSlots } of candidateBlocks) {
      // Place all slots in the block
      for (const slot of blockSlots) placeTask(task, slot);
      assignments[taskIndex] = blockSlots;

      if (solve(taskIndex + 1)) return true;

      // Backtrack all
      for (const slot of blockSlots) unplaceTask(task, slot);
      assignments[taskIndex] = null;
      backtracks++;

      if (timedOut) return false;
    }

    return false;
  }

  // ── 10. Run the solver ─────────────────────────────────────────────────────

  const solved = solve(0);

  // ── 11. Post-processing: assign rooms ──────────────────────────────────────

  // Build room assignment tracking
  // roomOccupied: `${day}-${slotId}` -> Set of roomIds (from locked entries)
  const roomOccupied = new Map();
  for (const entry of lockedEntries) {
    if (entry.roomId) {
      addToSetMap(roomOccupied, tsKey(entry.dayOfWeek, entry.timingSlotId.toString()), entry.roomId.toString());
    }
  }

  function assignRoom(preferredType, day, slotId) {
    const type = preferredType || 'classroom';
    const available = roomsByType.get(type) || roomsByType.get('classroom') || [];
    const slotKey = tsKey(day, slotId);
    const occupied = roomOccupied.get(slotKey) || new Set();

    for (const room of available) {
      if (!occupied.has(room._id.toString())) {
        addToSetMap(roomOccupied, slotKey, room._id.toString());
        return room._id;
      }
    }

    // Fallback: try any classroom
    if (type !== 'classroom') {
      const classrooms = roomsByType.get('classroom') || [];
      for (const room of classrooms) {
        if (!occupied.has(room._id.toString())) {
          addToSetMap(roomOccupied, slotKey, room._id.toString());
          return room._id;
        }
      }
    }

    return null; // No room available
  }

  // ── 12. Save generated entries ─────────────────────────────────────────────

  const entriesToInsert = [];
  const unassigned = [];
  const softViolations = [];

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const assignedSlots = assignments[i];

    if (!assignedSlots) {
      unassigned.push({
        subject: task.subjectId,
        class: task.classId,
        section: task.sectionId,
        teacher: task.teacherId,
        consecutiveCount: task.consecutiveCount,
        reason: timedOut ? 'Generation timed out before placement' : 'No valid slot found (hard constraint violation)',
      });
      continue;
    }

    for (const slot of assignedSlots) {
      const roomId = assignRoom(task.preferredRoomType, slot.day, slot.slotId);

      entriesToInsert.push({
        tenantId,
        templateId,
        dayOfWeek: slot.day,
        timingSlotId: slot.slotId,
        classId: task.classId,
        sectionId: task.sectionId || null,
        subjectId: task.subjectId,
        teacherId: task.teacherId,
        roomId: roomId || null,
        isManual: false,
        lockedByUser: false,
      });
    }
  }

  // Check for soft violations in the final schedule
  checkSoftViolations(tasks, assignments, softViolations, workingDays);

  // Bulk insert all entries
  let entriesCreated = 0;
  if (entriesToInsert.length > 0) {
    const result = await TimetableEntry.insertMany(entriesToInsert, { ordered: false });
    entriesCreated = result.length;
  }

  const generationTimeMs = Math.round(performance.now() - startTime);

  return {
    entriesCreated,
    unassigned,
    softViolations,
    generationTimeMs,
    backtracks,
    timedOut,
    totalTasks: tasks.length,
    lockedEntries: lockedEntries.length,
  };
}

/**
 * Analyze the final schedule for soft constraint violations.
 */
function checkSoftViolations(tasks, assignments, violations, workingDays) {
  // Track subject distribution per class per day
  const classDayMap = new Map(); // `${classId}-${sectionId}-${day}` -> { subjectId: count }

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const assignedSlots = assignments[i];
    if (!assignedSlots) continue;

    for (const slot of assignedSlots) {
      const key = `${task.classId}-${task.sectionId || 'none'}-${slot.day}`;
      if (!classDayMap.has(key)) classDayMap.set(key, {});
      const counts = classDayMap.get(key);
      counts[task.subjectId] = (counts[task.subjectId] || 0) + 1;
    }
  }

  // Check for subject clustering (same non-consecutive subject > 1 per day)
  for (const [key, counts] of classDayMap) {
    for (const [subjectId, count] of Object.entries(counts)) {
      if (count > 1) {
        // Check if these are from a consecutive block (allowed)
        const task = tasks.find(t =>
          t.subjectId === subjectId && t.isConsecutive && t.consecutiveCount >= count
        );
        if (!task) {
          violations.push({
            type: 'subject_clustering',
            description: `Subject ${subjectId} appears ${count} times on ${key.split('-').pop()} for class ${key.split('-')[0]}`,
          });
        }
      }
    }
  }

  // Check teacher workload balance across days
  const teacherDayLoads = new Map(); // teacherId -> { day: count }
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const assignedSlots = assignments[i];
    if (!assignedSlots) continue;

    if (!teacherDayLoads.has(task.teacherId)) teacherDayLoads.set(task.teacherId, {});
    const loads = teacherDayLoads.get(task.teacherId);

    for (const slot of assignedSlots) {
      loads[slot.day] = (loads[slot.day] || 0) + 1;
    }
  }

  for (const [teacherId, loads] of teacherDayLoads) {
    const counts = Object.values(loads);
    if (counts.length === 0) continue;
    const max = Math.max(...counts);
    const min = Math.min(...counts);
    if (max - min > 3) {
      violations.push({
        type: 'teacher_imbalance',
        description: `Teacher ${teacherId} has unbalanced workload: max ${max} periods/day, min ${min} periods/day`,
      });
    }
  }
}

module.exports = { generateTimetable };
