const { body } = require('express-validator');

// ─── Template validation ────────────────────────────────────────────────────
exports.validateTemplate = [
  body('name')
    .notEmpty()
    .withMessage('Template name is required')
    .trim(),
  body('workingDays')
    .optional()
    .isArray()
    .withMessage('Working days must be an array'),
  body('workingDays.*')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('Invalid day of week'),
  body('effectiveFrom')
    .optional()
    .isISO8601()
    .withMessage('effectiveFrom must be a valid date'),
  body('effectiveTo')
    .optional()
    .isISO8601()
    .withMessage('effectiveTo must be a valid date')
];

// ─── Timing slot validation ─────────────────────────────────────────────────
exports.validateTiming = [
  body('slotNumber')
    .isInt({ min: 1 })
    .withMessage('Slot number must be a positive integer'),
  body('label')
    .notEmpty()
    .withMessage('Slot label is required')
    .trim(),
  body('startTime')
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('startTime must be HH:mm'),
  body('endTime')
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('endTime must be HH:mm'),
  body('type')
    .isIn(['period', 'break', 'lunch', 'assembly', 'activity'])
    .withMessage('Type must be one of: period, break, lunch, assembly, activity')
];

// ─── Bulk timings validation ────────────────────────────────────────────────
exports.validateBulkTimings = [
  body('timings')
    .isArray({ min: 1 })
    .withMessage('Timings must be a non-empty array'),
  body('timings.*.slotNumber')
    .isInt({ min: 1 })
    .withMessage('Each slot must have a positive slot number'),
  body('timings.*.label')
    .notEmpty()
    .withMessage('Each slot must have a label')
    .trim(),
  body('timings.*.startTime')
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('startTime must be HH:mm'),
  body('timings.*.endTime')
    .matches(/^\d{2}:\d{2}$/)
    .withMessage('endTime must be HH:mm'),
  body('timings.*.type')
    .isIn(['period', 'break', 'lunch', 'assembly', 'activity'])
    .withMessage('Type must be one of: period, break, lunch, assembly, activity')
];

// ─── Subject allocation validation ──────────────────────────────────────────
exports.validateAllocation = [
  body('classId')
    .isMongoId()
    .withMessage('Valid class ID is required'),
  body('subjectId')
    .isMongoId()
    .withMessage('Valid subject ID is required'),
  body('teacherId')
    .isMongoId()
    .withMessage('Valid teacher ID is required'),
  body('periodsPerWeek')
    .isInt({ min: 1, max: 15 })
    .withMessage('Periods per week must be between 1 and 15'),
  body('sectionId')
    .optional()
    .isMongoId()
    .withMessage('Section ID must be a valid Mongo ID'),
  body('preferConsecutive')
    .optional()
    .isBoolean()
    .withMessage('preferConsecutive must be a boolean'),
  body('consecutiveCount')
    .optional()
    .isInt({ min: 1, max: 3 })
    .withMessage('consecutiveCount must be between 1 and 3'),
  body('preferredRoomType')
    .optional()
    .isIn(['classroom', 'lab', 'auditorium', 'library', 'sports', 'other'])
    .withMessage('Invalid room type')
];

// ─── Timetable entry validation ─────────────────────────────────────────────
exports.validateEntry = [
  body('dayOfWeek')
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('Invalid day of week'),
  body('timingSlotId')
    .isMongoId()
    .withMessage('Valid timing slot ID is required'),
  body('classId')
    .isMongoId()
    .withMessage('Valid class ID is required'),
  body('subjectId')
    .isMongoId()
    .withMessage('Valid subject ID is required'),
  body('teacherId')
    .isMongoId()
    .withMessage('Valid teacher ID is required'),
  body('sectionId')
    .optional()
    .isMongoId()
    .withMessage('Section ID must be a valid Mongo ID'),
  body('roomId')
    .optional()
    .isMongoId()
    .withMessage('Room ID must be a valid Mongo ID')
];

// ─── Room validation ────────────────────────────────────────────────────────
exports.validateRoom = [
  body('name')
    .notEmpty()
    .withMessage('Room name is required')
    .trim(),
  body('type')
    .optional()
    .isIn(['classroom', 'lab', 'auditorium', 'library', 'sports', 'other'])
    .withMessage('Invalid room type'),
  body('capacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Capacity must be at least 1'),
  body('building')
    .optional()
    .trim(),
  body('floor')
    .optional()
    .isInt()
    .withMessage('Floor must be an integer'),
  body('code')
    .optional()
    .trim()
];

// ─── Substitution validation ────────────────────────────────────────────────
exports.validateSubstitution = [
  body('date')
    .isISO8601()
    .withMessage('Valid date is required'),
  body('originalEntryId')
    .isMongoId()
    .withMessage('Valid original entry ID is required'),
  body('absentTeacherId')
    .isMongoId()
    .withMessage('Valid absent teacher ID is required'),
  body('substituteTeacherId')
    .optional()
    .isMongoId()
    .withMessage('Substitute teacher ID must be a valid Mongo ID'),
  body('reason')
    .optional()
    .isIn(['sick', 'personal', 'official', 'training', 'other'])
    .withMessage('Reason must be one of: sick, personal, official, training, other'),
  body('notes')
    .optional()
    .trim()
];

// ─── Override validation ────────────────────────────────────────────────────
exports.validateOverride = [
  body('date')
    .isISO8601()
    .withMessage('Valid date is required'),
  body('type')
    .isIn(['holiday', 'half_day', 'exam_day', 'special_schedule', 'cancelled'])
    .withMessage('Type must be one of: holiday, half_day, exam_day, special_schedule, cancelled'),
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .trim(),
  body('description')
    .optional()
    .trim(),
  body('affectedClasses')
    .optional()
    .isArray()
    .withMessage('affectedClasses must be an array'),
  body('affectedClasses.*')
    .optional()
    .isMongoId()
    .withMessage('Each affected class must be a valid Mongo ID')
];

// ─── Constraint validation ──────────────────────────────────────────────────
exports.validateConstraint = [
  body('teacherId')
    .isMongoId()
    .withMessage('Valid teacher ID is required'),
  body('type')
    .isIn(['unavailable', 'preferred', 'maxPeriodsPerDay', 'maxConsecutive', 'noFirstPeriod', 'noLastPeriod'])
    .withMessage('Invalid constraint type'),
  body('dayOfWeek')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
    .withMessage('Invalid day of week'),
  body('timingSlotId')
    .optional()
    .isMongoId()
    .withMessage('Timing slot ID must be a valid Mongo ID'),
  body('value')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Value must be a positive integer'),
  body('reason')
    .optional()
    .trim(),
  body('priority')
    .optional()
    .isInt({ min: 1, max: 10 })
    .withMessage('Priority must be between 1 and 10')
];
