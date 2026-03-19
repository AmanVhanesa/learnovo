const router = require('express').Router();
const { protect } = require('../middleware/auth');

// All timetable routes require authentication
router.use(protect);

router.use('/templates', require('./timetableTemplates'));
router.use('/rooms', require('./timetableRooms'));
router.use('/substitutions', require('./timetableSubstitutions'));
router.use('/overrides', require('./timetableOverrides'));
router.use('/view', require('./timetableViews'));

module.exports = router;
