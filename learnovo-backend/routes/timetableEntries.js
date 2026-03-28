const router = require('express').Router({ mergeParams: true });
const { body } = require('express-validator');
const TimetableEntry = require('../models/TimetableEntry');
const TimetableTemplate = require('../models/TimetableTemplate');
const { authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const timetableService = require('../services/timetableService');
const timetableGeneratorService = require('../services/timetableGeneratorService');

const DAY_ORDER = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6 };

// ─── Capture templateId from parent router's :id param ──────────────────────
// Express resets req.params per route, so we store templateId on req directly
router.use((req, res, next) => {
  req._templateId = req.params.id;
  next();
});

// ─── Shared validation rules ────────────────────────────────────────────────
const validateEntry = [
  body('dayOfWeek')
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('dayOfWeek must be a valid day'),
  body('timingSlotId').isMongoId().withMessage('Valid timingSlotId is required'),
  body('classId').isMongoId().withMessage('Valid classId is required'),
  body('sectionId').optional({ nullable: true }).isMongoId().withMessage('sectionId must be a valid ID'),
  body('subjectId').isMongoId().withMessage('Valid subjectId is required'),
  body('teacherId').isMongoId().withMessage('Valid teacherId is required'),
  body('roomId').optional({ nullable: true }).isMongoId().withMessage('roomId must be a valid ID')
];

// ─── Helper: load and validate template ─────────────────────────────────────
async function loadTemplate(req, res) {
  const tenantId = req.user.tenantId;
  const templateId = req.params.templateId || req._templateId || req.params.id;

  const template = await TimetableTemplate.findOne({ _id: templateId, tenantId }).lean();
  if (!template) {
    res.status(404).json({ success: false, message: 'Template not found' });
    return null;
  }
  return template;
}

// ─── Helper: ensure template is draft ───────────────────────────────────────
function requireDraft(template, res) {
  if (template.status !== 'draft') {
    res.status(400).json({
      success: false,
      message: `Cannot modify entries for a ${template.status} template`
    });
    return false;
  }
  return true;
}

// ════════════════════════════════════════════════════════════════════════════
//  GET / — List entries for a template
// ════════════════════════════════════════════════════════════════════════════
router.get('/', async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const templateId = req.params.templateId || req._templateId || req.params.id;

    const template = await loadTemplate(req, res);
    if (!template) return;

    const filter = { tenantId, templateId };

    if (req.query.classId) filter.classId = req.query.classId;
    if (req.query.sectionId) filter.sectionId = req.query.sectionId;
    if (req.query.teacherId) filter.teacherId = req.query.teacherId;
    if (req.query.roomId) filter.roomId = req.query.roomId;
    if (req.query.dayOfWeek) filter.dayOfWeek = req.query.dayOfWeek;

    const entries = await TimetableEntry.find(filter)
      .populate('subjectId', 'name subjectCode')
      .populate('teacherId', 'name')
      .populate('classId', 'name grade')
      .populate('sectionId', 'name')
      .populate('roomId', 'name type')
      .populate('timingSlotId', 'label startTime endTime slotNumber type')
      .lean();

    // Sort by day order then slot number
    entries.sort((a, b) => {
      const dayDiff = (DAY_ORDER[a.dayOfWeek] || 0) - (DAY_ORDER[b.dayOfWeek] || 0);
      if (dayDiff !== 0) return dayDiff;
      const slotA = a.timingSlotId?.slotNumber || 0;
      const slotB = b.timingSlotId?.slotNumber || 0;
      return slotA - slotB;
    });

    return res.status(200).json({
      success: true,
      data: entries,
      message: `Found ${entries.length} entry(ies)`
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST / — Create single entry (admin only)
// ════════════════════════════════════════════════════════════════════════════
router.post('/', authorize('admin'), validateEntry, handleValidationErrors, async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const templateId = req.params.templateId || req._templateId || req.params.id;

    const template = await loadTemplate(req, res);
    if (!template) return;
    if (!requireDraft(template, res)) return;

    const { dayOfWeek, timingSlotId, classId, sectionId, subjectId, teacherId, roomId } = req.body;

    // Check for conflicts
    const conflicts = await timetableService.checkConflicts(
      tenantId, templateId,
      { dayOfWeek, timingSlotId, classId, sectionId: sectionId || null, teacherId, roomId: roomId || null }
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Scheduling conflict detected',
        conflicts
      });
    }

    const entry = await TimetableEntry.create({
      tenantId,
      templateId,
      dayOfWeek,
      timingSlotId,
      classId,
      sectionId: sectionId || null,
      subjectId,
      teacherId,
      roomId: roomId || null,
      isManual: true
    });

    const populated = await TimetableEntry.findById(entry._id)
      .populate('subjectId', 'name subjectCode')
      .populate('teacherId', 'name')
      .populate('classId', 'name grade')
      .populate('sectionId', 'name')
      .populate('roomId', 'name type')
      .populate('timingSlotId', 'label startTime endTime slotNumber type')
      .lean();

    return res.status(201).json({
      success: true,
      data: populated,
      message: 'Entry created successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  PUT /:entryId — Update entry (admin only)
// ════════════════════════════════════════════════════════════════════════════
router.put('/:entryId', authorize('admin'), validateEntry, handleValidationErrors, async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const templateId = req.params.templateId || req._templateId || req.params.id;
    const { entryId } = req.params;

    const template = await loadTemplate(req, res);
    if (!template) return;
    if (!requireDraft(template, res)) return;

    const entry = await TimetableEntry.findOne({ _id: entryId, tenantId, templateId });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    const { dayOfWeek, timingSlotId, classId, sectionId, subjectId, teacherId, roomId } = req.body;

    // Check for conflicts excluding this entry
    const conflicts = await timetableService.checkConflicts(
      tenantId, templateId,
      { dayOfWeek, timingSlotId, classId, sectionId: sectionId || null, teacherId, roomId: roomId || null },
      entryId
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Scheduling conflict detected',
        conflicts
      });
    }

    entry.dayOfWeek = dayOfWeek;
    entry.timingSlotId = timingSlotId;
    entry.classId = classId;
    entry.sectionId = sectionId || null;
    entry.subjectId = subjectId;
    entry.teacherId = teacherId;
    entry.roomId = roomId || null;
    entry.isManual = true;

    await entry.save();

    const populated = await TimetableEntry.findById(entry._id)
      .populate('subjectId', 'name subjectCode')
      .populate('teacherId', 'name')
      .populate('classId', 'name grade')
      .populate('sectionId', 'name')
      .populate('roomId', 'name type')
      .populate('timingSlotId', 'label startTime endTime slotNumber type')
      .lean();

    return res.status(200).json({
      success: true,
      data: populated,
      message: 'Entry updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  DELETE /:entryId — Delete entry (admin only)
// ════════════════════════════════════════════════════════════════════════════
router.delete('/:entryId', authorize('admin'), async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const templateId = req.params.templateId || req._templateId || req.params.id;
    const { entryId } = req.params;

    const template = await loadTemplate(req, res);
    if (!template) return;
    if (!requireDraft(template, res)) return;

    const entry = await TimetableEntry.findOneAndDelete({ _id: entryId, tenantId, templateId });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    return res.status(200).json({
      success: true,
      data: null,
      message: 'Entry deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /bulk — Bulk create entries (admin only)
// ════════════════════════════════════════════════════════════════════════════
router.post('/bulk', authorize('admin'), [
  body('entries').isArray({ min: 1 }).withMessage('entries must be a non-empty array'),
  body('entries.*.dayOfWeek')
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('Each entry must have a valid dayOfWeek'),
  body('entries.*.timingSlotId').isMongoId().withMessage('Each entry must have a valid timingSlotId'),
  body('entries.*.classId').isMongoId().withMessage('Each entry must have a valid classId'),
  body('entries.*.sectionId').optional({ nullable: true }).isMongoId(),
  body('entries.*.subjectId').isMongoId().withMessage('Each entry must have a valid subjectId'),
  body('entries.*.teacherId').isMongoId().withMessage('Each entry must have a valid teacherId'),
  body('entries.*.roomId').optional({ nullable: true }).isMongoId()
], handleValidationErrors, async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const templateId = req.params.templateId || req._templateId || req.params.id;

    const template = await loadTemplate(req, res);
    if (!template) return;
    if (!requireDraft(template, res)) return;

    const { entries } = req.body;
    const created = [];
    const skipped = [];

    for (const item of entries) {
      const conflicts = await timetableService.checkConflicts(
        tenantId, templateId,
        {
          dayOfWeek: item.dayOfWeek,
          timingSlotId: item.timingSlotId,
          classId: item.classId,
          sectionId: item.sectionId || null,
          teacherId: item.teacherId,
          roomId: item.roomId || null
        }
      );

      if (conflicts.length > 0) {
        skipped.push({ entry: item, conflicts });
        continue;
      }

      const entry = await TimetableEntry.create({
        tenantId,
        templateId,
        dayOfWeek: item.dayOfWeek,
        timingSlotId: item.timingSlotId,
        classId: item.classId,
        sectionId: item.sectionId || null,
        subjectId: item.subjectId,
        teacherId: item.teacherId,
        roomId: item.roomId || null,
        isManual: true
      });
      created.push(entry);
    }

    return res.status(201).json({
      success: true,
      data: {
        createdCount: created.length,
        skippedCount: skipped.length,
        created,
        skipped
      },
      message: `${created.length} entry(ies) created, ${skipped.length} skipped due to conflicts`
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /generate — Trigger auto-generation (admin only)
// ════════════════════════════════════════════════════════════════════════════
router.post('/generate', authorize('admin'), async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const templateId = req.params.templateId || req._templateId || req.params.id;

    const template = await loadTemplate(req, res);
    if (!template) return;
    if (!requireDraft(template, res)) return;

    const { keepLocked = true, classId = null } = req.body || {};

    const result = await timetableGeneratorService.generateTimetable(tenantId, templateId, {
      keepLocked,
      classId
    });

    return res.status(200).json({
      success: true,
      data: result,
      message: `Timetable generated: ${result.entriesCreated} entries created in ${result.generationTimeMs}ms`
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  DELETE /clear — Clear all non-locked entries (admin only)
// ════════════════════════════════════════════════════════════════════════════
router.delete('/clear', authorize('admin'), async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const templateId = req.params.templateId || req._templateId || req.params.id;

    const template = await loadTemplate(req, res);
    if (!template) return;
    if (!requireDraft(template, res)) return;

    const result = await TimetableEntry.deleteMany({
      tenantId,
      templateId,
      lockedByUser: { $ne: true }
    });

    return res.status(200).json({
      success: true,
      data: { deletedCount: result.deletedCount },
      message: `${result.deletedCount} non-locked entry(ies) cleared`
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /:entryId/lock — Lock an entry (admin only)
// ════════════════════════════════════════════════════════════════════════════
router.post('/:entryId/lock', authorize('admin'), async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const templateId = req.params.templateId || req._templateId || req.params.id;
    const { entryId } = req.params;

    const entry = await TimetableEntry.findOne({ _id: entryId, tenantId, templateId });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    entry.lockedByUser = true;
    await entry.save();

    return res.status(200).json({
      success: true,
      data: entry,
      message: 'Entry locked successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  POST /:entryId/unlock — Unlock an entry (admin only)
// ════════════════════════════════════════════════════════════════════════════
router.post('/:entryId/unlock', authorize('admin'), async(req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const templateId = req.params.templateId || req._templateId || req.params.id;
    const { entryId } = req.params;

    const entry = await TimetableEntry.findOne({ _id: entryId, tenantId, templateId });
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' });
    }

    entry.lockedByUser = false;
    await entry.save();

    return res.status(200).json({
      success: true,
      data: entry,
      message: 'Entry unlocked successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
