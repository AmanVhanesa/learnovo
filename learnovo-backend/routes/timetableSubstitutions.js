const router = require('express').Router();
const { authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateSubstitution } = require('../middleware/timetableValidation');
const { body } = require('express-validator');
const Substitution = require('../models/Substitution');
const TimetableEntry = require('../models/TimetableEntry');
const TimetableTemplate = require('../models/TimetableTemplate');
const SubjectAllocation = require('../models/SubjectAllocation');
const User = require('../models/User');

// ─── GET / — List substitutions ─────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { date, startDate, endDate, status, absentTeacherId, substituteTeacherId, page = 1, limit = 50 } = req.query;

    const filter = { tenantId };

    // Date filtering (validate before using)
    if (date) {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date parameter' });
      }
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.date = { $gte: d, $lt: nextDay };
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid startDate or endDate parameter' });
      }
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    if (status) filter.status = status;
    if (absentTeacherId) filter.absentTeacherId = absentTeacherId;
    if (substituteTeacherId) filter.substituteTeacherId = substituteTeacherId;

    // Teachers can only see substitutions involving them
    if (req.user.role === 'teacher') {
      filter.$or = [
        { absentTeacherId: req.user._id },
        { substituteTeacherId: req.user._id }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [substitutions, total] = await Promise.all([
      Substitution.find(filter)
        .populate({
          path: 'originalEntryId',
          populate: [
            { path: 'subjectId', select: 'name code' },
            { path: 'classId', select: 'grade name' },
            { path: 'sectionId', select: 'name' },
            { path: 'timingSlotId', select: 'slotNumber label startTime endTime' }
          ]
        })
        .populate('absentTeacherId', 'name fullName')
        .populate('substituteTeacherId', 'name fullName')
        .populate('substituteSubjectId', 'name code')
        .populate('createdBy', 'name')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Substitution.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        substitutions,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      },
      message: 'Substitutions retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST / — Create substitution (admin only) ──────────────────────────────
router.post('/', authorize('admin'), validateSubstitution, handleValidationErrors, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { date, originalEntryId, absentTeacherId, substituteTeacherId, reason, reasonNote } = req.body;

    // Validate that the entry exists
    const entry = await TimetableEntry.findOne({ _id: originalEntryId, tenantId }).lean();
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Timetable entry not found'
      });
    }

    // Check for existing substitution on this entry + date
    const subDate = new Date(date);
    subDate.setHours(0, 0, 0, 0);

    const existing = await Substitution.findOne({
      tenantId,
      originalEntryId,
      date: subDate,
      status: { $ne: 'cancelled' }
    }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A substitution already exists for this entry on this date'
      });
    }

    const substitution = await Substitution.create({
      tenantId,
      date: subDate,
      originalEntryId,
      absentTeacherId,
      substituteTeacherId: substituteTeacherId || null,
      reason: reason || 'other',
      reasonNote,
      status: substituteTeacherId ? 'assigned' : 'pending',
      createdBy: req.user._id
    });

    // Populate for response
    const populated = await Substitution.findById(substitution._id)
      .populate({
        path: 'originalEntryId',
        populate: [
          { path: 'subjectId', select: 'name code' },
          { path: 'classId', select: 'grade name' },
          { path: 'sectionId', select: 'name' },
          { path: 'timingSlotId', select: 'slotNumber label startTime endTime' }
        ]
      })
      .populate('absentTeacherId', 'name fullName')
      .populate('substituteTeacherId', 'name fullName')
      .lean();

    return res.status(201).json({
      success: true,
      data: populated,
      message: 'Substitution created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /:id — Update substitution (admin only) ────────────────────────────
router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const { substituteTeacherId, substituteSubjectId, status, reasonNote } = req.body;

    const substitution = await Substitution.findOne({ _id: id, tenantId });
    if (!substitution) {
      return res.status(404).json({
        success: false,
        message: 'Substitution not found'
      });
    }

    if (substituteTeacherId !== undefined) {
      substitution.substituteTeacherId = substituteTeacherId;
      // Auto-transition: assigning a teacher to a pending substitution marks it as assigned
      if (substituteTeacherId && substitution.status === 'pending') {
        substitution.status = 'assigned';
      }
      // Auto-transition: removing a teacher from an assigned substitution marks it as pending
      if (!substituteTeacherId && substitution.status === 'assigned') {
        substitution.status = 'pending';
      }
    }
    if (substituteSubjectId !== undefined) substitution.substituteSubjectId = substituteSubjectId;
    // Explicit status overrides auto-transition (e.g. marking as completed)
    if (status && status !== substitution.status) substitution.status = status;
    if (reasonNote !== undefined) substitution.reasonNote = reasonNote;

    await substitution.save();

    const populated = await Substitution.findById(substitution._id)
      .populate({
        path: 'originalEntryId',
        populate: [
          { path: 'subjectId', select: 'name code' },
          { path: 'classId', select: 'grade name' },
          { path: 'sectionId', select: 'name' },
          { path: 'timingSlotId', select: 'slotNumber label startTime endTime' }
        ]
      })
      .populate('absentTeacherId', 'name fullName')
      .populate('substituteTeacherId', 'name fullName')
      .populate('substituteSubjectId', 'name code')
      .lean();

    return res.status(200).json({
      success: true,
      data: populated,
      message: 'Substitution updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /:id — Cancel substitution (admin only) ──────────────────────────
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const substitution = await Substitution.findOne({ _id: id, tenantId });
    if (!substitution) {
      return res.status(404).json({
        success: false,
        message: 'Substitution not found'
      });
    }

    substitution.status = 'cancelled';
    await substitution.save();

    return res.status(200).json({
      success: true,
      data: substitution,
      message: 'Substitution cancelled successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /suggestions/:entryId — Suggest substitute teachers ─────────────────
router.get('/suggestions/:entryId', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { entryId } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date query parameter is required'
      });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Get the entry to know the slot and subject
    const entry = await TimetableEntry.findOne({ _id: entryId, tenantId })
      .populate('subjectId', 'name code')
      .lean();

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Timetable entry not found'
      });
    }

    const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Find all teachers who are busy in this slot on this day
    const busyEntries = await TimetableEntry.find({
      tenantId,
      templateId: entry.templateId,
      dayOfWeek,
      timingSlotId: entry.timingSlotId
    }).select('teacherId').lean();

    const busyTeacherIds = busyEntries.map(e => e.teacherId.toString());

    // Also check for teachers already assigned as substitutes in this slot on this date
    const existingSubstitutions = await Substitution.find({
      tenantId,
      date: targetDate,
      status: { $in: ['pending', 'assigned'] }
    }).populate({
      path: 'originalEntryId',
      select: 'timingSlotId'
    }).lean();

    const subBusyIds = existingSubstitutions
      .filter(s => s.substituteTeacherId && s.originalEntryId?.timingSlotId?.toString() === entry.timingSlotId.toString())
      .map(s => s.substituteTeacherId.toString());

    const allBusyIds = [...new Set([...busyTeacherIds, ...subBusyIds])];

    // Get all active teachers (excluding the absent teacher)
    const availableTeachers = await User.find({
      tenantId,
      role: 'teacher',
      isActive: true,
      _id: { $nin: [...allBusyIds, entry.teacherId] }
    }).select('name fullName subjects').lean();

    // Find teachers who teach the same subject (via SubjectAllocation)
    const subjectAllocations = await SubjectAllocation.find({
      tenantId,
      templateId: entry.templateId,
      subjectId: entry.subjectId._id || entry.subjectId,
      isActive: true
    }).select('teacherId').lean();

    const sameSubjectTeacherIds = new Set(subjectAllocations.map(a => a.teacherId.toString()));

    // Count substitutions this week for each teacher (for fairness sorting)
    const weekStart = new Date(targetDate);
    const dayIndex = weekStart.getDay();
    const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;
    weekStart.setDate(weekStart.getDate() + mondayOffset);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekSubstitutions = await Substitution.find({
      tenantId,
      date: { $gte: weekStart, $lte: weekEnd },
      status: { $in: ['assigned', 'completed'] }
    }).select('substituteTeacherId').lean();

    const subCountMap = {};
    weekSubstitutions.forEach(s => {
      if (s.substituteTeacherId) {
        const id = s.substituteTeacherId.toString();
        subCountMap[id] = (subCountMap[id] || 0) + 1;
      }
    });

    // Sort: same-subject teachers first, then by fewest substitutions this week
    const suggestions = availableTeachers.map(teacher => ({
      _id: teacher._id,
      name: teacher.name || teacher.fullName,
      teachesSameSubject: sameSubjectTeacherIds.has(teacher._id.toString()),
      substitutionsThisWeek: subCountMap[teacher._id.toString()] || 0
    }));

    suggestions.sort((a, b) => {
      if (a.teachesSameSubject !== b.teachesSameSubject) {
        return a.teachesSameSubject ? -1 : 1;
      }
      return a.substitutionsThisWeek - b.substitutionsThisWeek;
    });

    return res.status(200).json({
      success: true,
      data: {
        entry: {
          _id: entry._id,
          dayOfWeek: entry.dayOfWeek,
          subject: entry.subjectId
        },
        suggestions
      },
      message: 'Substitute suggestions retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /bulk — Bulk create substitutions for an absent teacher ────────────
router.post('/bulk', authorize('admin'), [
  body('date').isISO8601().withMessage('Valid date is required'),
  body('absentTeacherId').isMongoId().withMessage('Valid absent teacher ID is required'),
  body('reason').optional().isIn(['sick', 'personal', 'official', 'training', 'other']).withMessage('Invalid reason')
], handleValidationErrors, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { date, absentTeacherId, reason, reasonNote } = req.body;

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Find the published template
    const template = await TimetableTemplate.findOne({ tenantId, status: 'published' })
      .sort({ publishedAt: -1 })
      .lean();

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'No published timetable template found'
      });
    }

    // Find all entries for the absent teacher on that day
    const entries = await TimetableEntry.find({
      tenantId,
      templateId: template._id,
      teacherId: absentTeacherId,
      dayOfWeek
    }).lean();

    if (entries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No timetable entries found for this teacher on this day'
      });
    }

    // Check for existing substitutions and filter them out
    const existingSubstitutions = await Substitution.find({
      tenantId,
      date: targetDate,
      originalEntryId: { $in: entries.map(e => e._id) },
      status: { $ne: 'cancelled' }
    }).lean();

    const existingEntryIds = new Set(existingSubstitutions.map(s => s.originalEntryId.toString()));

    const newEntries = entries.filter(e => !existingEntryIds.has(e._id.toString()));

    if (newEntries.length === 0) {
      return res.status(409).json({
        success: false,
        message: 'Substitutions already exist for all entries on this date'
      });
    }

    // Create substitutions in bulk
    const substitutionDocs = newEntries.map(entry => ({
      tenantId,
      date: targetDate,
      originalEntryId: entry._id,
      absentTeacherId,
      reason: reason || 'other',
      reasonNote,
      status: 'pending',
      createdBy: req.user._id
    }));

    const created = await Substitution.insertMany(substitutionDocs);

    // Populate for response
    const populated = await Substitution.find({
      _id: { $in: created.map(s => s._id) }
    })
      .populate({
        path: 'originalEntryId',
        populate: [
          { path: 'subjectId', select: 'name code' },
          { path: 'classId', select: 'grade name' },
          { path: 'sectionId', select: 'name' },
          { path: 'timingSlotId', select: 'slotNumber label startTime endTime' }
        ]
      })
      .populate('absentTeacherId', 'name fullName')
      .lean();

    return res.status(201).json({
      success: true,
      data: {
        created: populated,
        count: populated.length,
        skipped: existingSubstitutions.length
      },
      message: `${populated.length} substitution(s) created successfully${existingSubstitutions.length > 0 ? ` (${existingSubstitutions.length} already existed)` : ''}`
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
