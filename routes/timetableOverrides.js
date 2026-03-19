const router = require('express').Router();
const { authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { validateOverride } = require('../middleware/timetableValidation');
const TimetableOverride = require('../models/TimetableOverride');
const TimetableTemplate = require('../models/TimetableTemplate');

/**
 * Helper: get the published template for a tenant.
 */
async function getPublishedTemplate(tenantId, templateId) {
  if (templateId) {
    return TimetableTemplate.findOne({ _id: templateId, tenantId }).lean();
  }
  return TimetableTemplate.findOne({ tenantId, status: 'published' })
    .sort({ publishedAt: -1 })
    .lean();
}

// ─── GET / — List overrides ─────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { month, startDate, endDate, type, templateId, page = 1, limit = 50 } = req.query;

    // Resolve template
    const template = await getPublishedTemplate(tenantId, templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'No published timetable template found'
      });
    }

    const filter = { tenantId, templateId: template._id };

    // Month filtering (YYYY-MM)
    if (month) {
      const [year, mon] = month.split('-').map(Number);
      const monthStart = new Date(year, mon - 1, 1);
      const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);
      filter.date = { $gte: monthStart, $lte: monthEnd };
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

    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [overrides, total] = await Promise.all([
      TimetableOverride.find(filter)
        .populate('activeSlots', 'slotNumber label startTime endTime')
        .populate('specificClasses', 'grade name')
        .populate('createdBy', 'name')
        .sort({ date: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      TimetableOverride.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: {
        overrides,
        template: { _id: template._id, name: template.name },
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      },
      message: 'Overrides retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST / — Create override (admin only) ──────────────────────────────────
router.post('/', authorize('admin'), validateOverride, handleValidationErrors, async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      date, type, title, description, templateId,
      activeSlots, overrideEntries, appliesTo, specificClasses
    } = req.body;

    // Resolve template
    const template = await getPublishedTemplate(tenantId, templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'No published timetable template found'
      });
    }

    const overrideDate = new Date(date);
    overrideDate.setHours(0, 0, 0, 0);

    // Check for existing override on this template + date
    const existing = await TimetableOverride.findOne({
      tenantId,
      templateId: template._id,
      date: overrideDate
    }).lean();

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An override already exists for this template on this date'
      });
    }

    const override = await TimetableOverride.create({
      tenantId,
      templateId: template._id,
      date: overrideDate,
      type,
      title,
      description,
      activeSlots: activeSlots || [],
      overrideEntries: overrideEntries || [],
      appliesTo: appliesTo || 'all',
      specificClasses: specificClasses || [],
      createdBy: req.user._id
    });

    const populated = await TimetableOverride.findById(override._id)
      .populate('activeSlots', 'slotNumber label startTime endTime')
      .populate('specificClasses', 'grade name')
      .populate('createdBy', 'name')
      .lean();

    return res.status(201).json({
      success: true,
      data: populated,
      message: 'Override created successfully'
    });
  } catch (error) {
    // Handle MongoDB duplicate key error from unique compound index
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An override already exists for this template on this date'
      });
    }
    next(error);
  }
});

// ─── PUT /:id — Update override (admin only) ────────────────────────────────
router.put('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const {
      date, type, title, description,
      activeSlots, overrideEntries, appliesTo, specificClasses
    } = req.body;

    const override = await TimetableOverride.findOne({ _id: id, tenantId });
    if (!override) {
      return res.status(404).json({
        success: false,
        message: 'Override not found'
      });
    }

    // If date is changing, check for conflicts
    if (date) {
      const newDate = new Date(date);
      newDate.setHours(0, 0, 0, 0);

      if (newDate.getTime() !== override.date.getTime()) {
        const existing = await TimetableOverride.findOne({
          tenantId,
          templateId: override.templateId,
          date: newDate,
          _id: { $ne: id }
        }).lean();

        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'An override already exists for this template on the new date'
          });
        }
        override.date = newDate;
      }
    }

    if (type !== undefined) override.type = type;
    if (title !== undefined) override.title = title;
    if (description !== undefined) override.description = description;
    if (activeSlots !== undefined) override.activeSlots = activeSlots;
    if (overrideEntries !== undefined) override.overrideEntries = overrideEntries;
    if (appliesTo !== undefined) override.appliesTo = appliesTo;
    if (specificClasses !== undefined) override.specificClasses = specificClasses;

    await override.save();

    const populated = await TimetableOverride.findById(override._id)
      .populate('activeSlots', 'slotNumber label startTime endTime')
      .populate('specificClasses', 'grade name')
      .populate('createdBy', 'name')
      .lean();

    return res.status(200).json({
      success: true,
      data: populated,
      message: 'Override updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /:id — Delete override (admin only) ─────────────────────────────
router.delete('/:id', authorize('admin'), async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const override = await TimetableOverride.findOneAndDelete({ _id: id, tenantId }).lean();
    if (!override) {
      return res.status(404).json({
        success: false,
        message: 'Override not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: override,
      message: 'Override deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /calendar — Calendar view for a month ──────────────────────────────
router.get('/calendar', async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { month, templateId } = req.query;

    if (!month) {
      return res.status(400).json({
        success: false,
        message: 'Month query parameter is required (format: YYYY-MM)'
      });
    }

    // Resolve template
    const template = await getPublishedTemplate(tenantId, templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'No published timetable template found'
      });
    }

    const [year, mon] = month.split('-').map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd = new Date(year, mon, 0, 23, 59, 59, 999);
    const daysInMonth = new Date(year, mon, 0).getDate();

    // Get overrides for this month
    const overrides = await TimetableOverride.find({
      tenantId,
      templateId: template._id,
      date: { $gte: monthStart, $lte: monthEnd }
    })
      .select('date type title appliesTo')
      .sort({ date: 1 })
      .lean();

    // Build override lookup by date
    const overrideMap = {};
    overrides.forEach(o => {
      const key = o.date.toISOString().split('T')[0];
      overrideMap[key] = {
        type: o.type,
        title: o.title,
        appliesTo: o.appliesTo
      };
    });

    // Build calendar array
    const calendar = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, mon - 1, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const isWorkingDay = template.workingDays.includes(dayOfWeek);

      calendar.push({
        date: dateStr,
        dayOfWeek,
        isWorkingDay,
        override: overrideMap[dateStr] || null
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        month,
        template: { _id: template._id, name: template.name },
        calendar
      },
      message: 'Calendar retrieved successfully'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
