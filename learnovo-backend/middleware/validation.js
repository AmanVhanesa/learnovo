const { body, validationResult } = require('express-validator');

// Handle validation errors
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// User validation rules
exports.validateUser = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  body('role')
    .isIn(['admin', 'teacher', 'student', 'parent'])
    .withMessage('Role must be admin, teacher, student, or parent'),

  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
];

// Student validation rules
exports.validateStudent = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  body('phone')
    .optional()
    .trim()
    .matches(/^[\+]?([1-9]{1})([\d]{5,15})$/)
    .withMessage('Please provide a valid phone number (e.g., +919876543210 or 9876543210)'),

  body('class')
    .trim()
    .notEmpty()
    .withMessage('Class is required'),

  body('rollNumber')
    .trim()
    .notEmpty()
    .withMessage('Roll number is required'),

  body('admissionDate')
    .isISO8601()
    .withMessage('Please provide a valid admission date'),

  body('guardianName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Guardian name must be between 2 and 50 characters'),

  body('guardianPhone')
    .optional()
    .trim()
    .matches(/^[\+]?([1-9]{1})([\d]{5,15})$/)
    .withMessage('Please provide a valid guardian phone number')
];

// Fee validation rules
exports.validateFee = [
  body('student')
    .isMongoId()
    .withMessage('Please provide a valid student ID'),

  body('amount')
    .isNumeric()
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),

  body('description')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Description must be between 5 and 200 characters'),

  body('dueDate')
    .isISO8601()
    .withMessage('Please provide a valid due date'),

  body('feeType')
    .optional()
    .isIn(['tuition', 'transport', 'library', 'sports', 'exam', 'other'])
    .withMessage('Invalid fee type'),

  body('academicYear')
    .trim()
    .notEmpty()
    .withMessage('Academic year is required')
];

// Admission validation rules
exports.validateAdmission = [
  body('personalInfo.firstName')
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('First name must be between 2 and 30 characters'),

  body('personalInfo.lastName')
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Last name must be between 2 and 30 characters'),

  body('personalInfo.dateOfBirth')
    .isISO8601()
    .withMessage('Please provide a valid date of birth'),

  body('personalInfo.gender')
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),

  body('contactInfo.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),

  body('contactInfo.phone')
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),

  body('contactInfo.address.street')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Street address must be between 5 and 100 characters'),

  body('contactInfo.address.city')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters'),

  body('contactInfo.address.state')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('State must be between 2 and 50 characters'),

  body('contactInfo.address.pincode')
    .isPostalCode('IN')
    .withMessage('Please provide a valid pincode'),

  body('guardianInfo.fatherName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Father name must be between 2 and 50 characters'),

  body('guardianInfo.motherName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Mother name must be between 2 and 50 characters'),

  body('academicInfo.classApplied')
    .trim()
    .notEmpty()
    .withMessage('Class applied for is required')
];

// Settings validation rules
exports.validateSettings = [
  body('institution.name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Institution name must be between 2 and 100 characters'),

  body('currency.default')
    .isLength({ min: 3, max: 3 })
    .isUppercase()
    .withMessage('Currency must be a 3-letter uppercase code (e.g., INR, USD)'),

  body('currency.symbol')
    .trim()
    .isLength({ min: 1, max: 5 })
    .withMessage('Currency symbol must be between 1 and 5 characters'),

  body('currency.position')
    .isIn(['before', 'after'])
    .withMessage('Currency position must be before or after'),

  body('academic.currentYear')
    .trim()
    .matches(/^\d{4}-\d{4}$/)
    .withMessage('Academic year must be in format YYYY-YYYY'),

  body('fees.lateFeePercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Late fee percentage must be between 0 and 100'),

  body('fees.lateFeeGracePeriod')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Late fee grace period must be a positive integer')
];

// File upload validation
exports.validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only JPEG, PNG, and PDF files are allowed.'
    });
  }

  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum size is 5MB.'
    });
  }

  next();
};

// Pagination validation
exports.validatePagination = [
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Search validation
exports.validateSearch = [
  body('query')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),

  body('filters')
    .optional()
    .isObject()
    .withMessage('Filters must be an object')
];
