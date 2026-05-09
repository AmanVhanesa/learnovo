const express = require('express');
const { body, query } = require('express-validator');
const User = require('../models/User');
const Fee = require('../models/Fee');
const { protect, authorize, canAccessStudent } = require('../middleware/auth');
const { handleValidationErrors, validateStudent } = require('../middleware/validation');
const Settings = require('../models/Settings'); // Import Settings model
const SubDepartment = require('../models/SubDepartment');
const { formatCurrencyWithSettings } = require('../utils/currency');
const upload = require('../middleware/upload');
const { parseCSV } = require('../utils/csvHandler');
const { generateAdmissionNumber } = require('../utils/admissionUtils');
const bcrypt = require('bcryptjs');
const TeacherSubjectAssignment = require('../models/TeacherSubjectAssignment');
const Class = require('../models/Class');
const Section = require('../models/Section');
const Driver = require('../models/Driver');
const { logger } = require('../middleware/errorHandler');
const planGate = require('../middleware/planGate');
const { getPlanConfig } = require('../utils/planConfig');
const FeeInvoice = require('../models/FeeInvoice');
const AcademicSession = require('../models/AcademicSession');

const router = express.Router();

// @desc    Search guardian info from existing students (for sibling quick-fill)
// @route   GET /api/students/guardian-search
// @access  Private (Admin)
router.get('/guardian-search', protect, authorize('admin'), [
  query('q').trim().notEmpty().withMessage('Search query is required'),
  handleValidationErrors
], async(req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const searchTerm = req.query.q.trim();

    if (searchTerm.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const regex = new RegExp(searchTerm, 'i');

    // Search students whose guardians match or whose address matches
    const students = await User.find({
      tenantId,
      role: 'student',
      isActive: true,
      $or: [
        { 'guardians.name': regex },
        { 'guardians.phone': regex },
        { name: regex },
        { fullName: regex }
      ]
    })
      .select('name fullName guardians address admissionNumber class section')
      .sort({ name: 1 })
      .limit(10)
      .lean();

    // Deduplicate by primary guardian phone to avoid showing same family multiple times
    const seen = new Set();
    const results = [];
    for (const s of students) {
      const primaryGuardian = s.guardians?.find(g => g.isPrimary) || s.guardians?.[0];
      const key = primaryGuardian?.phone || s._id.toString();
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          studentId: s._id,
          studentName: s.fullName || s.name,
          admissionNumber: s.admissionNumber,
          class: s.class,
          section: s.section,
          guardians: s.guardians || [],
          address: s.address || ''
        });
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    logger.error('GET /students/guardian-search error', error, { requestId: req.requestId });
    res.status(500).json({ success: false, message: 'Failed to search guardians', requestId: req.requestId });
  }
});

// @desc    Get all students
// @route   GET /api/students
// @access  Private (Admin, Teacher)
router.get('/', protect, authorize('admin', 'teacher'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500'),
  query('class').optional().trim().notEmpty().withMessage('Class filter cannot be empty'),
  query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { parsePagination, paginatedResponse } = require('../utils/pagination');
    const { page, limit, skip } = parsePagination(req.query);

    // Build filter
    const filter = { role: 'student' };

    // Add tenant filtering
    if (req.user && req.user.tenantId) {
      filter.tenantId = req.user.tenantId;
    }

    // Add class filter for teachers
    // Add class filter for teachers
    if (req.user.role === 'teacher') {
      try {
        const legacyClasses = Array.isArray(req.user.assignedClasses) ? req.user.assignedClasses : [];
        const assignmentQuery = { teacherId: req.user._id, tenantId: req.user.tenantId, isActive: true };

        // 1. Fetch TeacherSubjectAssignment (New Relation)
        const assignments = await TeacherSubjectAssignment.find(assignmentQuery);

        // 2. Fetch Class Model Assignments (Embedded Teacher)
        const classAssignments = await Class.find({
          tenantId: req.user.tenantId,
          $or: [
            { classTeacher: req.user._id },
            { 'subjects.teacher': req.user._id }
          ]
        }).select('name');

        // 3. Fetch Section Model Assignments (Section Teacher)
        const Section = require('../models/Section');
        const sectionAssignments = await Section.find({
          tenantId: req.user.tenantId,
          sectionTeacher: req.user._id,
          isActive: true
        }).select('name classId');

        const criteria = [];

        // Add legacy classes
        if (legacyClasses.length > 0) {
          criteria.push({ class: { $in: legacyClasses } });
        }

        // Add classes from Class model assignments
        if (classAssignments.length > 0) {
          const classNames = classAssignments.map(c => c.name);
          criteria.push({ class: { $in: classNames } });
          // Also try matching by ID if students have classId populated
          criteria.push({ classId: { $in: classAssignments.map(c => c._id) } });
        }

        // Add sections from Section model assignments
        if (sectionAssignments.length > 0) {
          const sectionNames = sectionAssignments.map(s => s.name);
          const sectionIds = sectionAssignments.map(s => s._id);
          const relatedClassIds = sectionAssignments.map(s => s.classId);

          criteria.push({
            $or: [
              { sectionId: { $in: sectionIds } },
              { section: { $in: sectionNames }, classId: { $in: relatedClassIds } }
            ]
          });
        }

        assignments.forEach(a => {
          const clause = { classId: a.classId };
          if (a.sectionId) clause.sectionId = a.sectionId;
          criteria.push(clause);
        });

        if (criteria.length > 0) {
          if (!filter.$and) filter.$and = [];
          filter.$and.push({ $or: criteria });
        } else {
          // No assignments
          if (!filter.$and) filter.$and = [];
          filter.$and.push({ _id: null }); // Force empty
        }
      } catch (err) {
        logger.error('Teacher filter error', err, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
        if (!filter.$and) filter.$and = [];
        filter.$and.push({ _id: null });
      }
    }

    // Add class filter from query — match by class string OR classId
    // Students may store class as name or grade, so we match both ways.
    // Always look up the Class document to match by all identifiers (classId, name, grade).
    if (req.query.classId || req.query.class) {
      let classDoc;
      try {
        if (req.query.classId) {
          classDoc = await Class.findById(req.query.classId).select('_id name grade').lean();
        }
        if (!classDoc && req.query.class) {
          classDoc = await Class.findOne({
            tenantId: req.user.tenantId,
            $or: [{ grade: req.query.class }, { name: req.query.class }]
          }).select('_id name grade').lean();
        }
      } catch (_) { /* ignore */ }

      if (classDoc) {
        if (!filter.$and) filter.$and = [];
        const classOr = [{ classId: classDoc._id }];
        if (classDoc.name) classOr.push({ class: classDoc.name });
        if (classDoc.grade && classDoc.grade !== classDoc.name) classOr.push({ class: classDoc.grade });
        // Also match the raw query value in case it differs from both name and grade
        if (req.query.class && req.query.class !== classDoc.name && req.query.class !== classDoc.grade) {
          classOr.push({ class: req.query.class });
        }
        filter.$and.push({ $or: classOr });
      } else if (req.query.classId) {
        // classDoc not found but we have a classId — try direct match
        if (!filter.$and) filter.$and = [];
        const classOr = [{ classId: req.query.classId }];
        if (req.query.class) classOr.push({ class: req.query.class });
        filter.$and.push({ $or: classOr });
      } else {
        filter.class = req.query.class;
      }
    }

    // Add section filter — exact match (sections are stored uppercase)
    if (req.query.section) {
      filter.section = req.query.section.trim().toUpperCase();
    }

    // Add academic year filter
    if (req.query.academicYear) {
      filter.academicYear = req.query.academicYear;
    }

    // Add status filter (active/inactive)
    if (req.query.status) {
      filter.isActive = req.query.status === 'active';
    }

    // Add driver filter
    if (req.query.driver) {
      filter.driverId = req.query.driver;
    }

    // Add student type filter (old / new)
    if (req.query.studentType === 'old') {
      filter.studentType = 'old';
    } else if (req.query.studentType === 'new') {
      filter.studentType = 'new';
    }

    // Add search filter
    const searchTerm = req.query.search;
    if (searchTerm) {
      filter.$or = [
        { name: { $regex: searchTerm, $options: 'i' } },
        { fullName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
        { admissionNumber: { $regex: searchTerm, $options: 'i' } },
        { rollNumber: { $regex: searchTerm, $options: 'i' } },
        { studentId: { $regex: searchTerm, $options: 'i' } },
        { phone: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Determine if this is a lightweight list request (e.g. for promotion/section pages)
    const isLightweight = req.query.lightweight === 'true';
    const selectFields = isLightweight
      ? '_id name firstName lastName fullName admissionNumber rollNumber class section classId sectionId academicYear isActive gender photo'
      : '-password';

    const defaultSort = { name: 1, admissionNumber: 1 };

    // Run count and find in parallel for speed
    const [students, total] = await Promise.all([
      User.find(filter)
        .select(selectFields)
        .populate(isLightweight ? [] : [
          { path: 'classId', select: 'name grade', strictPopulate: false },
          { path: 'subDepartment', select: 'name', strictPopulate: false },
          { path: 'driverId', select: 'name phone', strictPopulate: false }
        ])
        .sort(defaultSort)
        .collation({ locale: 'en', numericOrdering: true })
        .skip(skip)
        .limit(limit)
        .lean()
        .catch(async() => {
          // Populate failed — retry without
          return User.find(filter).select(selectFields).sort(defaultSort).skip(skip).limit(limit).lean();
        }),
      User.countDocuments(filter)
    ]);

    // When searching, sort results so exact admission number matches appear first
    if (searchTerm && students.length > 1) {
      const term = searchTerm.toLowerCase();
      students.sort((a, b) => {
        const aAdm = (a.admissionNumber || '').toLowerCase();
        const bAdm = (b.admissionNumber || '').toLowerCase();
        const aExact = aAdm === term;
        const bExact = bAdm === term;
        if (aExact !== bExact) return aExact ? -1 : 1;
        const aStarts = aAdm.startsWith(term);
        const bStarts = bAdm.startsWith(term);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return 0;
      });
    }

    // 30s private cache — safe for auth endpoints; avoids repeat fetches on quick back-nav
    res.set('Cache-Control', 'no-cache');
    res.json(paginatedResponse(students, total, page, limit));
  } catch (error) {
    logger.error('GET /students error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students',
      ...(process.env.NODE_ENV !== 'production' && {
        errorName: error.name,
        errorMessage: error.message
      })
    });
  }
});

// @desc    Download student import CSV template
// @route   GET /api/students/import/template
// @access  Private (Admin) — Basic+ plan required
router.get('/import/template', protect, authorize('admin'), planGate.requireActiveSubscription, planGate.checkCsvImport, (req, res) => {
  try {
    const fields = [
      'fullName', 'email', 'phone', 'dateOfBirth', 'gender',
      'admissionNumber', 'rollNumber', 'class', 'section', 'academicYear', 'admissionDate', 'admissionClass',
      'bloodGroup', 'category', 'religion',
      'fatherName', 'fatherPhone', 'fatherEmail',
      'motherName', 'motherPhone', 'motherEmail',
      'guardianName', 'guardianPhone',
      'address',
      'penNumber', 'subDepartment', 'driverName',
      'isActive', 'deactivatedAt', 'removalDate', 'removalReason', 'removalNotes',
      'studentType',
      // Optional: firstName, middleName, lastName for backward compatibility
      'firstName', 'middleName', 'lastName'
    ];

    // Create header row
    const csvContent = `${fields.join(',')  }\n` +
      // Add sample rows — one active, one inactive
      'John David Doe,john.doe@example.com,1234567890,2010-05-15,male,ADM001,1,10,A,2024-2025,2024-04-01,10,A+,General,Hindu,Father Name,9876543210,father@example.com,Mother Name,9876543211,mother@example.com,,,123 Main St,12345678901,27 LG SEC,Raju Singh,active,,,,,new,,,' + '\n' +
      'Jane Smith,jane@example.com,9876543210,2009-08-20,female,ADM002,2,9,B,2024-2025,2023-04-01,8,B+,General,,Father Name,9876543212,,Mother Name,9876543213,,,456 Oak Ave,,,inactive,2025-03-15,2025-03-15,Transferred,Moved to another city,old,,,';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=students_import_template.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    logger.error('Download template error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({ success: false, message: 'Server error generating template' });
  }
});

// @desc    Download student import Excel template
// @route   GET /api/students/import/template/excel
// @access  Private (Admin)
router.get('/import/template/excel', protect, authorize('admin'), (req, res) => {
  try {
    const XLSX = require('xlsx');

    const fields = [
      'fullName', 'email', 'phone', 'dateOfBirth', 'gender',
      'admissionNumber', 'rollNumber', 'class', 'section', 'academicYear', 'admissionDate', 'admissionClass',
      'bloodGroup', 'category', 'religion',
      'fatherName', 'fatherPhone', 'fatherEmail',
      'motherName', 'motherPhone', 'motherEmail',
      'guardianName', 'guardianPhone',
      'address',
      'penNumber', 'subDepartment', 'driverName',
      'isActive', 'deactivatedAt', 'removalDate', 'removalReason', 'removalNotes',
      'studentType',
      'firstName', 'middleName', 'lastName'
    ];

    // Sample data rows — one active, one inactive
    const sampleActive = {
      'fullName': 'John David Doe',
      'email': 'john.doe@example.com',
      'phone': '1234567890',
      'dateOfBirth': '2010-05-15',
      'gender': 'male',
      'admissionNumber': 'ADM001',
      'rollNumber': '1',
      'class': '10',
      'section': 'A',
      'academicYear': '2024-2025',
      'admissionDate': '2024-04-01',
      'admissionClass': '10',
      'bloodGroup': 'A+',
      'category': 'General',
      'religion': 'Hindu',
      'fatherName': 'Father Name',
      'fatherPhone': '9876543210',
      'fatherEmail': 'father@example.com',
      'motherName': 'Mother Name',
      'motherPhone': '9876543211',
      'motherEmail': 'mother@example.com',
      'guardianName': '',
      'guardianPhone': '',
      'address': '123 Main St',
      'penNumber': '12345678901',
      'subDepartment': '27 LG SEC',
      'driverName': 'Raju Singh',
      'isActive': 'active',
      'deactivatedAt': '',
      'removalDate': '',
      'removalReason': '',
      'removalNotes': '',
      'studentType': 'new',
      'firstName': '',
      'middleName': '',
      'lastName': ''
    };

    const sampleInactive = {
      'fullName': 'Jane Smith',
      'email': 'jane@example.com',
      'phone': '9876543210',
      'dateOfBirth': '2009-08-20',
      'gender': 'female',
      'admissionNumber': 'ADM002',
      'rollNumber': '2',
      'class': '9',
      'section': 'B',
      'academicYear': '2024-2025',
      'admissionDate': '2023-04-01',
      'admissionClass': '8',
      'bloodGroup': 'B+',
      'category': 'General',
      'religion': '',
      'fatherName': 'Father Name',
      'fatherPhone': '9876543212',
      'fatherEmail': '',
      'motherName': 'Mother Name',
      'motherPhone': '9876543213',
      'motherEmail': '',
      'guardianName': '',
      'guardianPhone': '',
      'address': '456 Oak Ave',
      'penNumber': '',
      'subDepartment': '',
      'driverName': '',
      'isActive': 'inactive',
      'deactivatedAt': '2025-03-15',
      'removalDate': '2025-03-15',
      'removalReason': 'Transferred',
      'removalNotes': 'Moved to another city',
      'studentType': 'old',
      'firstName': '',
      'middleName': '',
      'lastName': ''
    };

    // Create worksheet with headers and sample data
    const wsData = [fields, Object.values(sampleActive), Object.values(sampleInactive)];
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths for better readability
    const colWidths = fields.map(() => ({ wch: 15 }));
    worksheet['!cols'] = colWidths;

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=students_import_template.xlsx');
    res.status(200).send(excelBuffer);
  } catch (error) {
    logger.error('Download Excel template error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({ success: false, message: 'Server error generating Excel template' });
  }
});

// @desc    Preview student import from CSV
// @route   POST /api/students/import/preview
// @access  Private (Admin) — Basic+ plan required
router.post('/import/preview', protect, authorize('admin'), planGate.requireActiveSubscription, planGate.checkCsvImport, upload.single('file'), async(req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
    }

    const rows = await parseCSV(req.file);

    // No local file cleanup needed — file is in memory buffer only

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'CSV file is empty' });
    }

    // Normalize column names to handle different CSV formats
    const normalizeRow = (row) => {
      const normalized = {};

      // Column name mappings (lowercase key -> camelCase field name).
      // All keys must be lowercase. The fallback also uses lowerKey so
      // uppercase headers like CLASS, SECTION, FULLNAME are handled correctly.
      const columnMappings = {
        // Name variants
        'name': 'fullName',
        'fullname': 'fullName',
        'student_name': 'fullName',
        'studentname': 'fullName',
        'firstname': 'firstName',
        'first_name': 'firstName',
        'middlename': 'middleName',
        'middle_name': 'middleName',
        'lastname': 'lastName',
        'last_name': 'lastName',
        // Admission number
        'admno': 'admissionNumber',
        'admission_no': 'admissionNumber',
        'admission_number': 'admissionNumber',
        'admissionnumber': 'admissionNumber',
        // Roll number
        'rollno': 'rollNumber',
        'roll_no': 'rollNumber',
        'roll_number': 'rollNumber',
        'rollnumber': 'rollNumber',
        // Date of birth
        'dob': 'dateOfBirth',
        'date_of_birth': 'dateOfBirth',
        'dateofbirth': 'dateOfBirth',
        // Class & Section (all variants map to 'class' / 'section')
        'class': 'class',
        'currentclass': 'class',
        'current_class': 'class',
        'section': 'section',
        'currentsection': 'section',
        'current_section': 'section',
        // Admission class/section
        'admissionclass': 'admissionClass',
        'admission_class': 'admissionClass',
        'admissionsection': 'admissionSection',
        'admission_section': 'admissionSection',
        // Academic year & admission date
        'academic_year': 'academicYear',
        'academicyear': 'academicYear',
        'admission_date': 'admissionDate',
        'admissiondate': 'admissionDate',
        // Guardian / parent fields
        'father_name': 'fatherName',
        'fathername': 'fatherName',
        'father_phone': 'fatherPhone',
        'fatherphone': 'fatherPhone',
        'father_email': 'fatherEmail',
        'fatheremail': 'fatherEmail',
        'mother_name': 'motherName',
        'mothername': 'motherName',
        'mother_phone': 'motherPhone',
        'motherphone': 'motherPhone',
        'mother_email': 'motherEmail',
        'motheremail': 'motherEmail',
        'guardian_name': 'guardianName',
        'guardianname': 'guardianName',
        'guardian_phone': 'guardianPhone',
        'guardianphone': 'guardianPhone',
        // Other fields
        'blood_group': 'bloodGroup',
        'bloodgroup': 'bloodGroup',
        'sub_department': 'subDepartment',
        'subdepartment': 'subDepartment',
        'pen_number': 'penNumber',
        'pennumber': 'penNumber',
        'driver': 'driverName',
        'driver_name': 'driverName',
        'drivername': 'driverName',
        'isactive': 'isActive',
        'is_active': 'isActive',
        'status': 'isActive',
        'deactivatedat': 'deactivatedAt',
        'deactivated_at': 'deactivatedAt',
        'inactivatedat': 'deactivatedAt',
        'inactivated_at': 'deactivatedAt',
        'deactivation_date': 'deactivatedAt',
        'deactivationdate': 'deactivatedAt',
        'removaldate': 'removalDate',
        'removal_date': 'removalDate',
        'removalreason': 'removalReason',
        'removal_reason': 'removalReason',
        'removalnotes': 'removalNotes',
        'removal_notes': 'removalNotes',
        'udisecode': 'udiseCode',
        'udise_code': 'udiseCode',
        'dateofjoining': 'dateOfJoining',
        'date_of_joining': 'dateOfJoining',
        // Student type (old / new admission)
        'studenttype': 'studentType',
        'student_type': 'studentType',
        'type': 'studentType'
      };

      // Normalize each field
      for (const [key, value] of Object.entries(row)) {
        const lowerKey = String(key || '').toLowerCase().trim();
        const mappedKey = columnMappings[lowerKey] || lowerKey;
        normalized[mappedKey] = value;
      }

      return normalized;
    };

    // Normalize all rows
    const normalizedRows = rows.map(normalizeRow);

    const preview = [];
    const errors = [];
    const validData = [];
    const tenantId = req.user.tenantId;

    // Cache existing emails and admission numbers for duplicate checking
    const existingEmails = new Set();
    const existingAdmissionNumbers = new Set();
    const students = await User.find({ tenantId, role: 'student' }).select('email admissionNumber');
    students.forEach(s => {
      if (s.email && s.email.trim()) {
        existingEmails.add(s.email.toLowerCase());
      }
      if (s.admissionNumber && s.admissionNumber.trim()) {
        existingAdmissionNumbers.add(s.admissionNumber.toUpperCase());
      }
    });

    // Also check duplicates within the file itself
    const fileEmails = new Set();
    const fileAdmissionNumbers = new Set();
    const duplicates = []; // Track duplicate admission numbers separately

    // Process each row
    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      const rowNum = i + 2; // +1 for 0-index, +1 for header
      const rowErrors = [];
      const cleanRow = { ...row };
      let isDuplicate = false;

      // 1. Basic Validation
      if (!row.fullName && !row.firstName && !row.lastName) {
        rowErrors.push('Student name is required (fullName or firstName/lastName)');
      }

      // 2. Check for duplicate admission number (track separately, not as error)
      if (row.admissionNumber && row.admissionNumber.trim()) {
        const admNo = row.admissionNumber.toString().trim().toUpperCase();
        cleanRow.admissionNumber = admNo;

        // Check if admission number already exists in database
        if (existingAdmissionNumbers.has(admNo)) {
          isDuplicate = true;
          duplicates.push({
            row: rowNum,
            admissionNumber: admNo,
            name: row.fullName || `${row.firstName || ''} ${row.lastName || ''}`.trim(),
            data: cleanRow
          });
        }

        // Check duplicate admission number in file
        if (fileAdmissionNumbers.has(admNo)) {
          rowErrors.push(`Duplicate admission number ${admNo} in file`);
        } else {
          fileAdmissionNumbers.add(admNo);
        }
      }

      // 3. Email validation - email is optional but must be unique if provided
      if (row.email && row.email.trim()) {
        const email = String(row.email).toLowerCase().trim();
        cleanRow.email = email;

        // Validate email format
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
          rowErrors.push('Invalid email format');
        } else {
          // Check duplicate in DB
          if (existingEmails.has(email)) {
            rowErrors.push(`Email ${email} already exists in system`);
          }

          // Check duplicate in file
          if (fileEmails.has(email)) {
            rowErrors.push(`Duplicate email ${email} in file`);
          } else {
            fileEmails.add(email);
          }
        }
      }

      // Add row number for reference
      cleanRow._rowNumber = rowNum;

      // Categorize the row
      if (rowErrors.length > 0) {
        // Has validation errors - add to errors
        rowErrors.forEach(msg => {
          errors.push({
            row: rowNum,
            field: 'Validation',
            message: msg,
            value: ''
          });
        });
      } else if (!isDuplicate) {
        // Valid and not duplicate - add to valid data
        validData.push(cleanRow);
      }
      // Note: duplicates are tracked separately in the duplicates array

      // Add to preview (limit to first 10 for display)
      if (preview.length < 10) {
        preview.push(cleanRow);
      }
    }

    // Compute accurate counts
    const totalRows = normalizedRows.length;
    const validRows = validData.length;
    const duplicatesInDB = duplicates.length;
    // Unique rows that had validation errors (not counted as valid or duplicate)
    const errorRowNumbers = new Set(errors.map(e => e.row));
    const invalidRows = errorRowNumbers.size;

    // Aggregate error reasons so the user can see at a glance what's wrong
    const errorsByType = {};
    errors.forEach(e => {
      const key = e.message || 'Unknown error';
      errorsByType[key] = (errorsByType[key] || 0) + 1;
    });

    logger.info('Import preview summary', {
      requestId: req.requestId, tenantId: req.user?.tenantId,
      totalRows, validRows, invalidRows, duplicatesInDB,
      errorsByType,
      hint: duplicatesInDB > 0
        ? `${duplicatesInDB} students already exist by admission number. Select "Replace" to update them.`
        : undefined
    });

    res.json({
      success: true,
      preview,
      errors,
      duplicates, // Students that already exist in the system
      validData, // Send back valid data for the next step
      summary: {
        totalRows,
        validRows,
        invalidRows,
        duplicatesInFile: 0, // Handled in errors logic effectively
        duplicatesInDB, // Students that already exist
        // Extra context so the UI/user can understand the breakdown
        breakdown: `${totalRows} total = ${validRows} new + ${duplicatesInDB} already exist + ${invalidRows} invalid`,
        // Aggregated error reasons (e.g. { "Duplicate email x@y.com in file": 500, ... })
        errorsByType: Object.keys(errorsByType).length > 0 ? errorsByType : undefined
      }
    });

  } catch (error) {
    logger.error('Import preview error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    // No local file cleanup needed — file is in memory buffer only
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during preview',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @desc    Execute student import
// @route   POST /api/students/import/execute
// @access  Private (Admin) — Basic+ plan required
router.post('/import/execute', protect, authorize('admin'), planGate.requireActiveSubscription, planGate.checkCsvImport, async(req, res) => {
  // Extend timeout for large imports (5 minutes)
  req.setTimeout(300000);
  res.setTimeout(300000);

  try {
    const { validData, options } = req.body;

    logger.info('Import execute called', { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email, validDataLength: validData ? validData.length : 'undefined' });

    if (!validData || !Array.isArray(validData) || validData.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid data to import' });
    }

    const tenantId = req.user.tenantId;
    const mongoose = require('mongoose');

    // ── Subscription limit pre-check ────────────────────────────────────
    const Tenant = require('../models/Tenant');
    const tenant = await Tenant.findById(tenantId).lean();
    if (tenant) {
      const planConfig = getPlanConfig(tenant.subscription?.plan || 'free');
      const maxStudents = tenant.subscription?.customLimits?.students ?? planConfig.limits?.students ?? Infinity;
      if (maxStudents !== Infinity) {
        const currentStudentCount = await User.countDocuments({ tenantId, role: 'student', isActive: true });
        if (currentStudentCount + validData.length > maxStudents) {
          return res.status(400).json({
            success: false,
            message: `Import would exceed your plan's student limit (${currentStudentCount} existing + ${validData.length} new = ${currentStudentCount + validData.length}, limit: ${maxStudents}). Please upgrade your plan or reduce the import size.`
          });
        }
      }
    }

    // Get settings for UDISE Code
    const settings = await Settings.getSettings(tenantId);
    const defaultUdiseCode = settings.institution?.udiseCode;

    // Extract options
    const _skipDuplicates = options?.skipDuplicates || false;
    const replaceDuplicates = options?.replaceDuplicates || false;

    const results = { success: 0, failed: 0, skipped: 0, replaced: 0, errors: [] };
    // Accumulator arrays — filled during the row loop, flushed in one batch after
    const docsToInsert = [];
    const docsToReplace = []; // { id, updateFields }

    // ALWAYS pre-fetch existing admission numbers to prevent duplicates
    const existingStudentsMap = new Map();
    const existingStudents = await User.find({ tenantId, role: 'student' })
      .select('_id admissionNumber email')
      .lean();
    // Pre-build email set to avoid N+1 findOne queries during the row loop
    const existingEmailsSet = new Set();
    existingStudents.forEach(s => {
      if (s.email) existingEmailsSet.add(s.email.toLowerCase());
    });
    existingStudents.forEach(s => {
      if (s.admissionNumber) {
        existingStudentsMap.set(s.admissionNumber.trim().toUpperCase(), s._id);
      }
    });

    // Pre-cache all classes and drivers for this tenant to avoid N+1 queries in the loop
    const Class = require('../models/Class');
    const Section = require('../models/Section');

    // Resolve the tenant's active academic session so any auto-created classes
    // are stamped with the correct year. The active session may use a different
    // naming convention than Class.academicYear (e.g. "2026-2027" vs "2026"),
    // so we don't filter classes by it — that would risk matching nothing.
    const activeSession = await AcademicSession.findOne({ tenantId, isActive: true }).lean();
    const activeYear = activeSession?.name
      || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

    // Sort by createdAt DESC so when duplicate class names exist (e.g. an old
    // "1st" left behind from a prior academic year sitting next to the current
    // "1st"), the FIRST hit on a name lookup is the most recently created
    // class — i.e. the current year's class. Without this sort, prior-year
    // duplicates can shadow current-year classes and imported students end
    // up with a stale classId, invisible on the current Academics page.
    let allClasses = await Class.find({ tenantId })
      .select('_id name grade createdAt')
      .sort({ createdAt: -1 })
      .lean();
    const allDrivers = await Driver.find({ tenantId, isActive: true }).select('_id name').lean();
    const driverCache = new Map(allDrivers.map(d => [d.name.toLowerCase().trim(), d]));

    // ── Auto-create missing classes from import data ──────────────────────
    // Collect all unique class names from the import, resolve them to DB
    // names, and batch-create any that don't exist yet.
    const classNamesFromImport = new Set();
    for (const row of validData) {
      if (row.class && row.class.trim()) {
        classNamesFromImport.add(row.class.trim());
      }
    }

    // Build a lookup of existing classes (lowercase name/grade → doc).
    // allClasses is sorted createdAt DESC, so the first occurrence of any name
    // is the most recently created (current-year) class. Skip subsequent
    // duplicates so prior-year leftovers can't overwrite the current entry.
    const existingClassLookup = new Map();
    allClasses.forEach(c => {
      if (c.name) {
        const k = c.name.toLowerCase();
        if (!existingClassLookup.has(k)) existingClassLookup.set(k, c);
      }
      if (c.grade) {
        const k = c.grade.toLowerCase();
        if (!existingClassLookup.has(k)) existingClassLookup.set(k, c);
      }
    });

    const classesToCreate = [];
    for (const rawName of classNamesFromImport) {
      // Try exact and extracted match (same logic as per-row lookup)
      const candidates = [rawName];
      const classMatch = rawName.match(/class\s*(\d+|nursery|lkg|ukg)/i);
      if (classMatch) {
        const ext = classMatch[1].toLowerCase();
        const norm = ['nursery', 'lkg', 'ukg'].includes(ext)
          ? ext.charAt(0).toUpperCase() + ext.slice(1) : ext;
        if (norm !== rawName) candidates.push(norm);
      }
      // Strip ordinal suffix: "1ST" → "1" (and try "Class 1" too)
      const ordinalMatch = rawName.match(/^(\d+)\s*(st|nd|rd|th)$/i);
      if (ordinalMatch) {
        const numeric = ordinalMatch[1];
        candidates.push(numeric);
        candidates.push(`Class ${numeric}`);
      }
      const found = candidates.some(c => existingClassLookup.has(c.toLowerCase()));
      if (!found) {
        // Determine a display name & grade for the new class. academicYear is
        // required by the Class schema and must match the active session so
        // these auto-created classes show up in the current Academics view.
        classesToCreate.push({
          tenantId,
          name: rawName,
          grade: rawName,
          academicYear: activeYear,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    if (classesToCreate.length > 0) {
      try {
        const created = await Class.insertMany(classesToCreate, { ordered: false });
        logger.info(`Import: auto-created ${created.length} missing classes`, { requestId: req.requestId, tenantId: req.user?.tenantId });
        // Refresh, preserving createdAt-DESC ordering
        allClasses = await Class.find({ tenantId })
          .select('_id name grade createdAt')
          .sort({ createdAt: -1 })
          .lean();
      } catch (classErr) {
        // Partial success is fine — re-fetch everything
        logger.warn('Import: class auto-create partial error', { requestId: req.requestId, tenantId: req.user?.tenantId, error: classErr.message });
        allClasses = await Class.find({ tenantId })
          .select('_id name grade createdAt')
          .sort({ createdAt: -1 })
          .lean();
      }
    }

    // ── Auto-create missing sections from import data ─────────────────────
    // Build a classId lookup from the refreshed class list. Same first-wins
    // semantics as existingClassLookup so the most recently created class
    // wins on duplicate names.
    const classLookupByName = new Map();
    allClasses.forEach(c => {
      if (c.name) {
        const k = c.name.toLowerCase();
        if (!classLookupByName.has(k)) classLookupByName.set(k, c);
      }
      if (c.grade) {
        const k = c.grade.toLowerCase();
        if (!classLookupByName.has(k)) classLookupByName.set(k, c);
      }
    });

    // Pre-fetch all sections for this tenant (keyed by classId_sectionName).
    // Stale-year sections may sit in the cache, but the per-row lookup uses
    // the deduped class lookup so cacheKeys only ever resolve against current
    // classes — old sections in the map are inert.
    let allSections = await Section.find({ tenantId, isActive: true }).select('_id name classId').lean();
    const sectionCache = new Map();
    allSections.forEach(sec => {
      const key = `${sec.classId.toString()}_${sec.name.toUpperCase()}`;
      sectionCache.set(key, sec);
    });

    // Collect unique (class, section) pairs from the import data
    const sectionsToCreate = [];
    const seenSectionKeys = new Set();
    for (const row of validData) {
      if (row.class && row.class.trim() && row.section && row.section.trim()) {
        const rawClass = row.class.trim();
        const sectionName = row.section.trim().toUpperCase();
        // Find the class doc
        const candidates = [rawClass];
        const cm = rawClass.match(/class\s*(\d+|nursery|lkg|ukg)/i);
        if (cm) {
          const ext = cm[1].toLowerCase();
          const norm = ['nursery', 'lkg', 'ukg'].includes(ext)
            ? ext.charAt(0).toUpperCase() + ext.slice(1) : ext;
          if (norm !== rawClass) candidates.push(norm);
        }
        // Strip ordinal suffix: "1ST" → "1"
        const om = rawClass.match(/^(\d+)\s*(st|nd|rd|th)$/i);
        if (om) {
          candidates.push(om[1]);
          candidates.push(`Class ${om[1]}`);
        }
        let classDoc = null;
        for (const cand of candidates) {
          classDoc = classLookupByName.get(cand.toLowerCase());
          if (classDoc) break;
          // Partial match
          for (const [k, v] of classLookupByName) {
            if (k.includes(cand.toLowerCase())) {
              classDoc = v; break;
            }
          }
          if (classDoc) break;
        }
        if (classDoc) {
          const sKey = `${classDoc._id.toString()}_${sectionName}`;
          if (!sectionCache.has(sKey) && !seenSectionKeys.has(sKey)) {
            seenSectionKeys.add(sKey);
            sectionsToCreate.push({
              tenantId,
              classId: classDoc._id,
              name: sectionName,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }
      }
    }

    if (sectionsToCreate.length > 0) {
      try {
        const created = await Section.insertMany(sectionsToCreate, { ordered: false });
        logger.info(`Import: auto-created ${created.length} missing sections`, { requestId: req.requestId, tenantId: req.user?.tenantId });
      } catch (secErr) {
        logger.warn('Import: section auto-create partial error', { requestId: req.requestId, tenantId: req.user?.tenantId, error: secErr.message });
      }
      // Refresh sections cache
      allSections = await Section.find({ tenantId, isActive: true }).select('_id name classId').lean();
      sectionCache.clear();
      allSections.forEach(sec => {
        sectionCache.set(`${sec.classId.toString()}_${sec.name.toUpperCase()}`, sec);
      });
    }

    // ── Fix email unique index: must be partialFilterExpression, not sparse ──
    // MongoDB sparse unique indexes still index explicit `null` values,
    // causing E11000 errors when multiple students lack emails. The schema
    // now declares the correct partial-filter index, but legacy tenants may
    // still have a sparse-only index from an older deploy. This block is
    // idempotent — once the index is correct, it's a no-op.
    //
    // IMPORTANT: drop and create are foreground (no background:true). A
    // background recreate from a previous request can race with a follow-up
    // drop, leaving MongoDB to reject the new createIndex with "An existing
    // index has the same name as the requested index".
    try {
      const usersCol = User.collection;
      const indexes = await usersCol.indexes();
      const emailIdx = indexes.find(
        idx => idx.key && idx.key.email === 1 && idx.key.tenantId === 1
      );
      const needsFix = emailIdx && (
        !emailIdx.partialFilterExpression ||
        emailIdx.partialFilterExpression?.email?.$type !== 'string'
      );
      if (needsFix) {
        logger.info('Import: dropping stale email index and recreating with partial filter', { requestId: req.requestId, tenantId: req.user?.tenantId });
        // Clean up any docs with email:null first — they'd block partial index creation only if NOT actually null, so this is purely hygiene.
        await usersCol.updateMany({ email: null }, { $unset: { email: '' } });
        await usersCol.dropIndex(emailIdx.name);
        await usersCol.createIndex(
          { email: 1, tenantId: 1 },
          { unique: true, partialFilterExpression: { email: { $type: 'string' } }, name: 'email_1_tenantId_1' }
        );
        logger.info('Import: email index fixed successfully', { requestId: req.requestId, tenantId: req.user?.tenantId });
      }
    } catch (indexErr) {
      logger.warn('Import: email index fix skipped', { requestId: req.requestId, tenantId: req.user?.tenantId, error: indexErr.message });
    }

    // Pre-fetch all sub-departments and batch-create any missing ones from the import data
    const allSubDepts = await SubDepartment.find({ tenantId }).lean();
    const subDeptCache = new Map(allSubDepts.map(sd => [sd.name.toUpperCase(), sd]));
    const missingSubDeptNames = new Set();
    for (const row of validData) {
      if (row.subDepartment) {
        const key = row.subDepartment.toString().trim().toUpperCase();
        if (!subDeptCache.has(key)) missingSubDeptNames.add(key);
      }
    }
    if (missingSubDeptNames.size > 0) {
      try {
        const newSubDepts = await SubDepartment.insertMany(
          [...missingSubDeptNames].map(name => ({ tenantId, name })),
          { ordered: false }
        );
        newSubDepts.forEach(sd => subDeptCache.set(sd.name.toUpperCase(), sd));
      } catch (sdErr) {
        logger.warn('SubDepartment batch create warning', { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email, error: sdErr.message });
        // Re-fetch on partial failure so newly created entries are in the cache
        const refreshed = await SubDepartment.find({ tenantId }).lean();
        refreshed.forEach(sd => subDeptCache.set(sd.name.toUpperCase(), sd));
      }
    }

    // Pre-hash the default password once — avoids a bcrypt call per row
    const defaultPasswordHash = await bcrypt.hash('student123', 10);

    for (const row of validData) {
      let studentData = null; // Declare safely for error logging scope
      const rowNum = row._rowNumber || '?';

      try {
        // Check admission number for existing student (used for replace logic)
        const admNoKey = row.admissionNumber ? row.admissionNumber.toString().trim().toUpperCase() : null;
        const existingId = admNoKey ? existingStudentsMap.get(admNoKey) : null;

        // Skip email duplicate check when replacing an already-identified student
        // (the student exists by design; checking email would throw false errors)
        // Uses pre-fetched existingEmailsSet instead of per-row DB query (N+1 fix)
        if (!existingId && row.email && row.email.trim()) {
          const email = row.email.toLowerCase().trim();
          if (existingEmailsSet.has(email)) {
            throw new Error(`Student with email ${email} already exists`);
          }
        }

        // Generate Admission Number (only if not provided)
        let admissionNumber = row.admissionNumber ? row.admissionNumber.toString().trim() : null;

        if (!admissionNumber) {
          admissionNumber = await generateAdmissionNumber(tenantId);
        }

        // Prepare Guardians with auto-added honorifics
        const guardians = [];

        // Helper function to add honorific if not present
        const addHonorific = (name, prefix) => {
          if (!name || !name.trim()) return name;
          const trimmedName = name.trim();
          // Check if name already has a prefix
          if (/^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Miss)\s+/i.test(trimmedName)) {
            return trimmedName;
          }
          return `${prefix} ${trimmedName}`;
        };

        if (row.fatherName) {
          guardians.push({
            relation: 'Father',
            name: addHonorific(row.fatherName, 'Mr.'),
            phone: row.fatherPhone,
            email: row.fatherEmail,
            isPrimary: true
          });
        }

        if (row.motherName) {
          guardians.push({
            relation: 'Mother',
            name: addHonorific(row.motherName, 'Mrs.'),
            phone: row.motherPhone,
            email: row.motherEmail
          });
        }

        if (guardians.length === 0 && row.guardianName) {
          guardians.push({ relation: 'Guardian', name: row.guardianName, phone: row.guardianPhone, isPrimary: true });
        }

        // Handle Sub Department (use pre-fetched cache — no per-row DB call)
        let subDepartmentId = undefined;
        if (row.subDepartment) {
          const subDeptName = row.subDepartment.toString().trim().toUpperCase();
          const subDept = subDeptCache.get(subDeptName);
          if (subDept) subDepartmentId = subDept._id;
        }

        // Handle Driver Assignment — use cached drivers
        let driverId = undefined;
        let transportMode = '';

        if (row.driverName) {
          const driverName = row.driverName.toString().trim();
          if (driverName.toLowerCase() === 'self') {
            transportMode = 'Self';
          } else {
            const driver = driverCache.get(driverName.toLowerCase().trim());
            if (driver) {
              driverId = driver._id;
              transportMode = 'School Transport';
            } else {
              logger.warn(`Import: Driver not found: ${driverName}`, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
            }
          }
        }

        // Helper to safely parse dates
        const parseDate = (dateStr) => {
          if (!dateStr) return undefined;
          const d = new Date(dateStr);
          return isNaN(d.getTime()) ? undefined : d;
        };

        // Construct Data - only include fields with actual values
        const currentYear = new Date().getFullYear().toString();
        studentData = {
          role: 'student',
          tenantId: tenantId,
          admissionNumber,
          academicYear: row.academicYear || `${currentYear}-${parseInt(currentYear) + 1}`,
          admissionDate: parseDate(row.admissionDate) || new Date(),
          guardians,
          // Backfill legacy field from guardians for backward compatibility
          fatherOrHusbandName: guardians.find(g => g.relation === 'Father')?.name || undefined,
          udiseCode: defaultUdiseCode,
          isActive: true,
          isImported: true,
          studentType: (row.studentType || '').toLowerCase() === 'old' ? 'old' : 'new'
        };

        // CRITICAL: Ensure fullName is ALWAYS set (required for students)
        let fullNameValue = null;
        if (row.fullName && row.fullName.trim()) {
          fullNameValue = row.fullName.trim();
        } else if (row.firstName || row.lastName) {
          // Auto-generate from name parts
          const parts = [row.firstName, row.middleName, row.lastName].filter(p => p && p.trim());
          fullNameValue = parts.join(' ').trim();
        }

        // If still no fullName, use admission number as placeholder
        if (!fullNameValue) {
          fullNameValue = `Student ${admissionNumber}`;
        }
        studentData.fullName = fullNameValue;

        // Add optional name fields only if they have values
        if (row.firstName && row.firstName.trim()) {
          studentData.firstName = row.firstName.trim();
        }
        if (row.middleName && row.middleName.trim()) {
          studentData.middleName = row.middleName.trim();
        }
        if (row.lastName && row.lastName.trim()) {
          studentData.lastName = row.lastName.trim();
        }

        // Add email if valid
        if (row.email && row.email.trim()) {
          const emailValue = row.email.trim().toLowerCase();
          if (emailValue.includes('@') && emailValue.includes('.')) {
            studentData.email = emailValue;
          }
        }

        // Always set a password — use provided password or default 'student123'
        // (admission number can be used as username, default password stays simple)
        studentData.password = row.password || 'student123';

        // Add other optional fields only if they have values
        if (row.class && row.class.trim()) {
          const rawClassValue = row.class.trim();

          // Build list of values to try matching against DB (most specific first)
          const classValuesToTry = [rawClassValue]; // e.g. "Class 8"

          // Also try extracted number/keyword as fallback (e.g. "8", "LKG")
          const classMatch = rawClassValue.match(/class\s*(\d+|nursery|lkg|ukg)/i);
          if (classMatch) {
            const extracted = classMatch[1].toLowerCase();
            const normalized = (extracted === 'nursery' || extracted === 'lkg' || extracted === 'ukg')
              ? extracted.charAt(0).toUpperCase() + extracted.slice(1)
              : extracted;
            if (normalized !== rawClassValue) classValuesToTry.push(normalized);
          }

          // Strip ordinal suffix so "1ST" / "2ND" / "3RD" / "8TH" can match
          // a Class.grade stored as a plain number ("1", "2", "3", "8").
          const ordinalMatch = rawClassValue.match(/^(\d+)\s*(st|nd|rd|th)$/i);
          if (ordinalMatch) {
            const numeric = ordinalMatch[1];
            if (!classValuesToTry.includes(numeric)) classValuesToTry.push(numeric);
            // Also try "Class N" form in case the DB uses that as the name
            const classNForm = `Class ${numeric}`;
            if (!classValuesToTry.includes(classNForm)) classValuesToTry.push(classNForm);
          }

          // --- Class lookup using pre-fetched allClasses (no per-row DB query) ---
          let classDoc = null;
          try {
            for (const candidate of classValuesToTry) {
              const lc = candidate.toLowerCase();
              // Exact match first
              classDoc = allClasses.find(c =>
                c.name?.toLowerCase() === lc || c.grade?.toLowerCase() === lc
              );
              if (classDoc) break;

              // Partial match fallback (e.g. "8" inside "Class 8")
              classDoc = allClasses.find(c =>
                c.name?.toLowerCase().includes(lc) || c.grade?.toLowerCase().includes(lc)
              );
              if (classDoc) break;
            }

            if (classDoc) {
              // Use grade (consistent with UI student form which stores grade)
              studentData.class = classDoc.grade || classDoc.name;
              studentData.classId = classDoc._id;
            } else {
              studentData.class = rawClassValue;
            }
          } catch (classLookupErr) {
            logger.warn('Class lookup error during import', { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email, error: classLookupErr.message });
            studentData.class = rawClassValue;
          }

          // --- Section lookup (use pre-fetched cache — no per-row DB call) ---
          if (classDoc && row.section && row.section.trim()) {
            const sectionName = row.section.trim().toUpperCase();
            const cacheKey = `${classDoc._id.toString()}_${sectionName}`;
            const sectionDoc = sectionCache.get(cacheKey);
            if (sectionDoc) {
              studentData.sectionId = sectionDoc._id;
              studentData.section = sectionDoc.name;
            }
          }
        }

        // Fallback: set section string if not already set by lookup
        if (row.section && row.section.trim() && !studentData.section) {
          studentData.section = row.section.trim().toUpperCase();
        }
        // Set admissionClass from CSV or fall back to current class
        if (row.admissionClass && row.admissionClass.trim()) {
          studentData.admissionClass = row.admissionClass.trim();
        } else if (studentData.class) {
          studentData.admissionClass = studentData.class;
        }

        if (row.rollNumber && row.rollNumber.trim()) {
          studentData.rollNumber = row.rollNumber.trim();
        }

        // Phone: sanitize to remove invalid characters, keep only digits and +
        if (row.phone && row.phone.trim()) {
          let phoneValue = row.phone.trim();
          // Remove all non-digit and non-plus characters
          phoneValue = phoneValue.replace(/[^\d+]/g, '');
          // Only set if we have at least 6 digits
          if (phoneValue.replace(/\+/g, '').length >= 6) {
            studentData.phone = phoneValue;
          }
        }

        if (row.address && row.address.trim()) {
          // Truncate long addresses to 500 chars
          studentData.address = row.address.trim().substring(0, 500);
        }
        if (row.dateOfBirth) {
          const dob = parseDate(row.dateOfBirth);
          if (dob) studentData.dateOfBirth = dob;
        }
        if (row.gender && row.gender.trim()) {
          const genderValue = row.gender.trim().toLowerCase();
          // Accept male/female/other or m/f/o
          if (['male', 'female', 'other', 'm', 'f', 'o'].includes(genderValue)) {
            studentData.gender = genderValue === 'm' ? 'male' : genderValue === 'f' ? 'female' : genderValue;
          }
        }
        if (row.bloodGroup && row.bloodGroup.trim()) {
          studentData.bloodGroup = row.bloodGroup.trim();
        }
        if (row.category && row.category.trim()) {
          studentData.category = row.category.trim();
        }
        if (row.religion && row.religion.trim()) {
          studentData.religion = row.religion.trim();
        }
        if (row.penNumber && row.penNumber.toString().trim()) {
          studentData.penNumber = row.penNumber.toString().trim();
        }
        if (subDepartmentId) {
          studentData.subDepartment = subDepartmentId;
        }
        if (driverId) {
          studentData.driverId = driverId;
        }
        if (transportMode) {
          studentData.transportMode = transportMode;
        }

        // Handle Inactive Student Fields
        // Parse isActive (supports: true/false, yes/no, 1/0, active/inactive)
        if (row.isActive !== undefined && row.isActive !== null && row.isActive !== '') {
          const isActiveValue = row.isActive.toString().trim().toLowerCase();
          if (['false', 'no', '0', 'inactive'].includes(isActiveValue)) {
            studentData.isActive = false;

            // Set deactivation date from CSV (deactivatedAt column) or fall back to removalDate or current date
            if (row.deactivatedAt) {
              const deactivatedDate = parseDate(row.deactivatedAt);
              if (deactivatedDate) {
                studentData.inactivatedAt = deactivatedDate;
              }
            }

            // If student is inactive, handle removal fields
            if (row.removalDate) {
              const removalDate = parseDate(row.removalDate);
              if (removalDate) {
                studentData.removalDate = removalDate;
                // Fall back to removalDate if no explicit deactivatedAt was provided
                if (!studentData.inactivatedAt) {
                  studentData.inactivatedAt = removalDate;
                }
              }
            }

            // If still no deactivation date, default to now
            if (!studentData.inactivatedAt) {
              studentData.inactivatedAt = new Date();
            }

            // Normalize removal reason to match enum
            if (row.removalReason && row.removalReason.trim()) {
              const reasonValue = row.removalReason.trim();
              const validReasons = ['Graduated', 'Transferred', 'Withdrawn', 'Expelled', 'Other'];
              // Case-insensitive match
              const matchedReason = validReasons.find(r => r.toLowerCase() === reasonValue.toLowerCase());
              studentData.removalReason = matchedReason || 'Other';
            }

            if (row.removalNotes && row.removalNotes.trim()) {
              studentData.removalNotes = row.removalNotes.trim();
            }
          }
        }

        // Add timestamps
        studentData.createdAt = new Date();
        studentData.updatedAt = new Date();

        // Hash password — use the pre-hashed default unless a custom one was supplied
        if (studentData.password) {
          if (studentData.password !== 'student123') {
            studentData.password = await bcrypt.hash(studentData.password, 10);
          } else {
            studentData.password = defaultPasswordHash;
          }
        }

        // Decide what to do with this row (existingId already computed at top of loop)
        if (existingId && replaceDuplicates) {
          // Replace: update existing student with new data
          const { role: _role, tenantId: _t, createdAt: _createdAt, updatedAt: _updatedAt, password, ...updateFields } = studentData;
          if (row.password && row.password.trim()) updateFields.password = password;
          updateFields.updatedAt = new Date();
          docsToReplace.push({ id: existingId, updateFields });
        } else if (existingId) {
          // Skip: student already exists (default behavior — never create duplicates)
          results.skipped++;
        } else {
          // New student — remove null/undefined fields to avoid sparse unique index conflicts
          Object.keys(studentData).forEach(key => {
            if (studentData[key] === null || studentData[key] === undefined) {
              delete studentData[key];
            }
          });
          docsToInsert.push(studentData);
          // Track email to prevent within-file duplicate insertions
          if (studentData.email) existingEmailsSet.add(studentData.email.toLowerCase());
        }

      } catch (error) {
        results.failed++;
        logger.error(`Import error for row ${rowNum}`, error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email, rowNum });

        // Safely log data (prevent circular dependency/undefined errors)
        try {
          if (studentData) logger.error('Student data payload', new Error(JSON.stringify(studentData, null, 2)), { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId });
        } catch (logErr) {
          logger.error('Failed to log payload', logErr, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId });
        }

        // Capture validation errors if present
        if (error.errors) {
          const validationErrors = Object.keys(error.errors).map(key =>
            `${key}: ${error.errors[key].message}`
          ).join(', ');
          results.errors.push(`Row ${rowNum}: ${validationErrors}`);
        } else {
          results.errors.push(`Row ${rowNum}: ${error.message}`);
        }
      }
    }

    // ── Batch flush: insertMany for new students ──────────────────────────────
    if (docsToInsert.length > 0) {
      // Ensure ObjectId fields are proper ObjectIds and strip falsy values
      // for fields with unique indexes (email, employeeId, studentId, penNumber)
      // to avoid E11000 duplicate-key errors on null values.
      const objectIdTenantId = new mongoose.Types.ObjectId(tenantId.toString());
      docsToInsert.forEach(doc => {
        doc.tenantId = objectIdTenantId;
        if (doc.classId) doc.classId = new mongoose.Types.ObjectId(doc.classId.toString());
        if (doc.sectionId) doc.sectionId = new mongoose.Types.ObjectId(doc.sectionId.toString());
        if (doc.driverId) doc.driverId = new mongoose.Types.ObjectId(doc.driverId.toString());
        if (doc.subDepartment && mongoose.Types.ObjectId.isValid(doc.subDepartment)) {
          doc.subDepartment = new mongoose.Types.ObjectId(doc.subDepartment.toString());
        }
        // CRITICAL: Remove falsy values for fields with unique/sparse indexes.
        // MongoDB sparse indexes skip *missing* fields but still index `null`,
        // so email: null on 1000 docs = 999 duplicate-key errors.
        ['email', 'employeeId', 'studentId', 'penNumber'].forEach(field => {
          if (!doc[field]) delete doc[field];
        });
      });

      // Use raw driver insertMany (not Mongoose) to avoid Mongoose adding
      // schema-defined fields as null (which re-introduces the null-email problem).
      const CHUNK = 100;
      logger.info(`Import: inserting ${docsToInsert.length} new students in ${Math.ceil(docsToInsert.length / CHUNK)} chunks`, { requestId: req.requestId, tenantId: req.user?.tenantId });

      // Track docs that failed to insert so we don't log them as activity.
      const failedDocs = new Set();

      for (let i = 0; i < docsToInsert.length; i += CHUNK) {
        const chunk = docsToInsert.slice(i, i + CHUNK);
        const chunkNum = Math.floor(i / CHUNK) + 1;
        try {
          const r = await User.collection.insertMany(chunk, { ordered: false });
          const count = r.insertedCount || 0;
          results.success += count;
          logger.info(`Import chunk ${chunkNum}: inserted ${count}/${chunk.length}`, { requestId: req.requestId, tenantId: req.user?.tenantId });
        } catch (bulkErr) {
          // ordered:false still throws but inserts valid docs
          const inserted = bulkErr.insertedCount ?? bulkErr.result?.nInserted ?? 0;
          results.success += inserted;
          logger.error(`Import chunk ${chunkNum}: ${inserted}/${chunk.length} inserted, error: ${bulkErr.message}`, bulkErr, { requestId: req.requestId, tenantId: req.user?.tenantId });

          const writeErrors = bulkErr.writeErrors || [];
          if (Array.isArray(writeErrors) && writeErrors.length > 0) {
            writeErrors.forEach(we => {
              results.failed++;
              const failedDoc = chunk[we.index];
              if (failedDoc) failedDocs.add(failedDoc);
              const errMsg = we.errmsg || we.err?.errmsg || we.message || 'Unknown insert error';
              results.errors.push(`Insert error (admNo: ${failedDoc?.admissionNumber || '?'}): ${errMsg}`);
            });
          } else if (inserted < chunk.length) {
            // No writeErrors detail — fall back to one-by-one insert
            const remainingDocs = chunk.slice(inserted);
            logger.info(`Import chunk ${chunkNum}: falling back to individual inserts for ${remainingDocs.length} docs`, { requestId: req.requestId, tenantId: req.user?.tenantId });
            for (const doc of remainingDocs) {
              try {
                await User.collection.insertOne(doc);
                results.success++;
              } catch (singleErr) {
                results.failed++;
                failedDocs.add(doc);
                results.errors.push(`Insert error (admNo: ${doc.admissionNumber || '?'}): ${singleErr.message}`);
              }
            }
          }
        }
      }
      logger.info(`Import: batch insert complete. Success: ${results.success}, Failed: ${results.failed}`, { requestId: req.requestId, tenantId: req.user?.tenantId });

      // Log students imported with admission dates — only those that actually inserted.
      const withAdmissionDate = docsToInsert.filter(d => d.admissionDate && !failedDocs.has(d));
      if (withAdmissionDate.length > 0) {
        logger.info(`Import: ${withAdmissionDate.length} students imported with admission dates`, { requestId: req.requestId, tenantId: req.user?.tenantId });
        try {
          const ActivityLog = require('../models/ActivityLog');
          for (const doc of withAdmissionDate) {
            await ActivityLog.create({
              tenantId: req.user.tenantId,
              type: 'student',
              action: 'import_with_admission_date',
              message: `Student imported with admission date: ${doc.admissionDate instanceof Date ? doc.admissionDate.toISOString().substring(0, 10) : doc.admissionDate}`,
              studentName: doc.fullName || doc.name || doc.firstName,
              userId: req.user._id
            });
          }
        } catch { /* non-critical */ }
      }
    }

    // ── Batch flush: bulkWrite for replace rows ───────────────────────────────
    if (docsToReplace.length > 0) {
      const ops = docsToReplace.map(({ id, updateFields }) => ({
        updateOne: { filter: { _id: id }, update: { $set: updateFields } }
      }));
      const CHUNK = 200;
      for (let i = 0; i < ops.length; i += CHUNK) {
        try {
          const bwResult = await User.bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
          results.replaced += bwResult.modifiedCount ?? bwResult.nModified ?? Math.min(CHUNK, ops.length - i);
        } catch (bulkErr) {
          results.replaced += bulkErr.result?.nModified ?? bulkErr.modifiedCount ?? 0;
          results.failed += bulkErr.writeErrors?.length || 0;
        }
      }
    }

    // Include first few error messages in response for debugging
    const errorSample = results.errors.slice(0, 10);

    res.json({
      success: true,
      message: `Import completed. Imported: ${results.success}, Replaced: ${results.replaced}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
      data: {
        ...results,
        errorSample
      }
    });

  } catch (error) {
    logger.error('Import execute error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error during import execution',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      errorType: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack?.split('\n').slice(0, 5) : undefined
    });
  }
});

// @desc    Get student filters
// @route   GET /api/students/filters
// @access  Private
router.get('/filters', protect, authorize('admin', 'teacher'), async(req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Build section query — optionally filter by selected class
    const sectionQuery = { tenantId };
    if (req.query.class) {
      const classDoc = await Class.findOne({ tenantId, name: req.query.class });
      if (classDoc) sectionQuery.classId = classDoc._id;
    }

    // Fetch filter options from actual tenant-created data
    const [classes, sections, academicYears, drivers] = await Promise.all([
      User.distinct('class', { role: 'student', tenantId }),
      Section.distinct('name', sectionQuery),
      User.distinct('academicYear', { role: 'student', tenantId }),
      Driver.find({ tenantId, isActive: true }).select('_id name').sort({ name: 1 })
    ]);

    // Sort classes in educational hierarchy order (Nursery → LKG → UKG → 1 → 2 → ...)
    const prePrimaryOrder = { 'pre-nursery': 0, 'nursery': 1, 'lkg': 2, 'ukg': 3, 'jr. kg': 2, 'sr. kg': 3, 'playgroup': 0 };
    const getClassOrder = (name) => {
      if (!name) return 9999;
      const n = name.toString().trim().toLowerCase();
      if (prePrimaryOrder[n] !== undefined) return prePrimaryOrder[n] - 100;
      const num = parseInt(n.replace(/^(class|grade|std|standard)\s*/i, ''), 10);
      return isNaN(num) ? 9000 : num;
    };
    const sortAlphaNum = (a, b) => {
      return a.toString().localeCompare(b.toString(), undefined, { numeric: true, sensitivity: 'base' });
    };

    res.json({
      success: true,
      data: {
        classes: classes.filter(Boolean).sort((a, b) => getClassOrder(a) - getClassOrder(b)),
        sections: sections.filter(Boolean).sort(sortAlphaNum),
        academicYears: academicYears.filter(Boolean).sort().reverse(), // Newest first
        genders: ['Male', 'Female', 'Other'],
        drivers: drivers.map(d => ({ _id: d._id, name: d.name }))
      }
    });
  } catch (error) {
    logger.error('Filter options error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Export students to CSV
// @route   GET /api/students/export
// @access  Private
router.get('/export', protect, authorize('admin', 'teacher'), async(req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Build filter (same as list route)
    const filter = { role: 'student', tenantId };

    if (req.user.role === 'teacher') {
      try {
        const legacyClasses = Array.isArray(req.user.assignedClasses) ? req.user.assignedClasses : [];
        const assignmentQuery = { teacherId: req.user._id, tenantId: req.user.tenantId, isActive: true };

        // 1. Fetch TeacherSubjectAssignment
        const assignments = await TeacherSubjectAssignment.find(assignmentQuery);

        // 2. Fetch Class Model Assignments
        const classAssignments = await Class.find({
          tenantId: req.user.tenantId,
          $or: [
            { classTeacher: req.user._id },
            { 'subjects.teacher': req.user._id }
          ]
        }).select('name');

        // 3. Fetch Section Model Assignments
        const Section = require('../models/Section');
        const sectionAssignments = await Section.find({
          tenantId: req.user.tenantId,
          sectionTeacher: req.user._id,
          isActive: true
        }).select('name classId');

        const criteria = [];

        // Add legacy classes
        if (legacyClasses.length > 0) {
          criteria.push({ class: { $in: legacyClasses } });
        }

        // Add class assignments
        if (classAssignments.length > 0) {
          const classNames = classAssignments.map(c => c.name);
          criteria.push({ class: { $in: classNames } });
          criteria.push({ classId: { $in: classAssignments.map(c => c._id) } });
        }

        // Add section assignments
        if (sectionAssignments.length > 0) {
          const sectionNames = sectionAssignments.map(s => s.name);
          const sectionIds = sectionAssignments.map(s => s._id);
          const relatedClassIds = sectionAssignments.map(s => s.classId);

          criteria.push({
            $or: [
              { sectionId: { $in: sectionIds } },
              { section: { $in: sectionNames }, classId: { $in: relatedClassIds } }
            ]
          });
        }

        assignments.forEach(a => {
          const clause = { classId: a.classId };
          if (a.sectionId) clause.sectionId = a.sectionId;
          criteria.push(clause);
        });

        if (criteria.length > 0) {
          if (!filter.$and) filter.$and = [];
          filter.$and.push({ $or: criteria });
        } else {
          if (!filter.$and) filter.$and = [];
          filter.$and.push({ _id: null });
        }
      } catch (err) {
        logger.error('Teacher export filter error', err, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
        if (!filter.$and) filter.$and = [];
        filter.$and.push({ _id: null });
      }
    }

    // Apply filters
    if (req.query.class) filter.class = req.query.class;
    // Section filter — SIMPLE STRING MATCH (no sectionId dependency)
    if (req.query.section) {
      const sectionStr = req.query.section.trim();
      filter.section = new RegExp(`^${sectionStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    if (req.query.status) filter.isActive = req.query.status === 'active';

    // NEW: Driver filter
    if (req.query.driverId) {
      filter.driverId = req.query.driverId;
    }

    // NEW: Transport mode filter
    if (req.query.transportMode) {
      filter.transportMode = req.query.transportMode;
    }

    if (req.query.search) {
      filter.$or = [
        { fullName: { $regex: req.query.search, $options: 'i' } },
        { admissionNumber: { $regex: req.query.search, $options: 'i' } },
        { rollNumber: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const students = await User.find(filter)
      .sort({ class: 1, section: 1, rollNumber: 1, fullName: 1 })
      .populate('subDepartment', 'name')
      .populate('driverId', 'name phone');

    // Define all available fields with their extractors
    const fieldDefinitions = {
      // Basic Info
      admissionNumber: { label: 'Admission No', extract: (s) => s.admissionNumber || '' },
      name: { label: 'Name', extract: (s) => `"${s.fullName}"` },
      class: { label: 'Class', extract: (s) => s.class || '' },
      section: { label: 'Section', extract: (s) => s.section || '' },
      rollNumber: { label: 'Roll No', extract: (s) => s.rollNumber || '' },
      status: { label: 'Status', extract: (s) => s.isActive ? 'Active' : 'Inactive' },

      // Academic
      academicYear: { label: 'Academic Year', extract: (s) => s.academicYear || '' },
      admissionDate: { label: 'Admission Date', extract: (s) => s.admissionDate ? new Date(s.admissionDate).toLocaleDateString('en-IN') : '' },
      admissionClass: { label: 'Admission Class', extract: (s) => s.admissionClass || '' },
      penNumber: { label: 'PEN Number', extract: (s) => s.penNumber || '' },
      subDepartment: { label: 'Sub Department', extract: (s) => s.subDepartment?.name || '' },

      // Contact
      fatherName: {
        label: 'Father Name', extract: (s) => {
          const father = s.guardians?.find(g => g.relation === 'Father');
          let name = s.fatherOrHusbandName || father?.name || '';

          // Add "Mr." prefix if not already present
          if (name && !/^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Miss)\s+/i.test(name)) {
            name = `Mr. ${name}`;
          }

          return `"${name}"`;
        }
      },
      motherName: {
        label: 'Mother Name', extract: (s) => {
          const mother = s.guardians?.find(g => g.relation === 'Mother');
          let name = mother?.name || '';

          // Add "Mrs." prefix if not already present
          if (name && !/^(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Miss)\s+/i.test(name)) {
            name = `Mrs. ${name}`;
          }

          return `"${name}"`;
        }
      },
      guardianName: {
        label: 'Guardian Name', extract: (s) => {
          const guardian = s.guardians?.[0];
          return `"${guardian?.name || ''}"`;
        }
      },
      mobile: { label: 'Mobile', extract: (s) => s.phone || '' },
      altMobile: {
        label: 'Alt Mobile', extract: (s) => {
          const guardian = s.guardians?.[0];
          return guardian?.phone || '';
        }
      },
      email: { label: 'Email', extract: (s) => s.email || '' },
      address: { label: 'Address', extract: (s) => `"${(s.address || '').replace(/"/g, '""')}"` },

      // Personal
      dob: { label: 'DOB', extract: (s) => s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('en-IN') : '' },
      gender: { label: 'Gender', extract: (s) => s.gender || '' },
      bloodGroup: { label: 'Blood Group', extract: (s) => s.bloodGroup || '' },
      category: { label: 'Category', extract: (s) => s.category || '' },
      religion: { label: 'Religion', extract: (s) => s.religion || '' },

      // Transport
      driverName: { label: 'Driver', extract: (s) => s.driverId?.name || '' },
      driverPhone: { label: 'Driver Phone', extract: (s) => s.driverId?.phone || '' },
      transportMode: { label: 'Transport Mode', extract: (s) => s.transportMode || '' }
    };

    // Parse selected fields from query parameter
    let selectedFields = [];
    if (req.query.fields) {
      // Fields are comma-separated
      selectedFields = req.query.fields.split(',').map(f => f.trim()).filter(f => fieldDefinitions[f]);
    }

    // If no fields specified, use all fields (default behavior)
    if (selectedFields.length === 0) {
      selectedFields = [
        'admissionNumber', 'name', 'class', 'section', 'rollNumber',
        'fatherName', 'motherName', 'mobile', 'altMobile', 'email',
        'dob', 'gender', 'address', 'driverName', 'driverPhone', 'subDepartment', 'status'
      ];
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const format = (req.query.format || 'csv').toLowerCase();

    // Build header labels and raw data rows (no CSV quoting for non-CSV formats)
    const headerLabels = selectedFields.map(f => fieldDefinitions[f].label);

    const rawRows = students.map(student =>
      selectedFields.map(field => {
        const raw = fieldDefinitions[field].extract(student);
        // Strip CSV quoting wrappers (e.g. `"value"`) for non-CSV output
        return typeof raw === 'string' ? raw.replace(/^"|"$/g, '').replace(/""/g, '"') : (raw ?? '');
      })
    );

    // Get school name for report header
    const ImportExportService = require('../services/importExportService');
    const headerInfo = await ImportExportService.getExportHeaderInfo(tenantId, 'Student List');

    // ── CSV ─────────────────────────────────────────────────────────────────
    if (format === 'csv') {
      const csvQuote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const reportHeader = [];
      if (headerInfo.schoolName) reportHeader.push(`"${headerInfo.schoolName}"`);
      reportHeader.push('"Student List"');
      reportHeader.push(`"${headerInfo.dateTime}"`);
      reportHeader.push('');
      const csvRows = [
        ...reportHeader,
        headerLabels.map(csvQuote).join(','),
        ...rawRows.map(row => row.map(csvQuote).join(','))
      ];
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=students_export_${dateStr}.csv`);
      return res.status(200).send(csvRows.join('\n'));
    }

    // ── Excel (.xlsx) ────────────────────────────────────────────────────────
    if (format === 'excel') {
      const xlsx = require('xlsx');
      const topRows = [];
      if (headerInfo.schoolName) topRows.push([headerInfo.schoolName]);
      topRows.push(['Student List']);
      topRows.push([headerInfo.dateTime]);
      topRows.push([]);
      const wsData = [...topRows, headerLabels, ...rawRows];
      const ws = xlsx.utils.aoa_to_sheet(wsData);

      // Merge header info rows across all columns
      if (headerLabels.length > 1) {
        ws['!merges'] = [];
        for (let i = 0; i < topRows.length - 1; i++) {
          ws['!merges'].push({ s: { r: i, c: 0 }, e: { r: i, c: headerLabels.length - 1 } });
        }
      }

      // Auto column widths
      const colWidths = headerLabels.map((h, i) => ({
        wch: Math.max(h.length, ...rawRows.map(r => String(r[i] ?? '').length), 10)
      }));
      ws['!cols'] = colWidths;

      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Students');
      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=students_export_${dateStr}.xlsx`);
      return res.status(200).send(buffer);
    }

    // ── TXT (tab-delimited) ──────────────────────────────────────────────────
    if (format === 'txt') {
      const txtHeader = [];
      if (headerInfo.schoolName) txtHeader.push(headerInfo.schoolName);
      txtHeader.push('Student List');
      txtHeader.push(headerInfo.dateTime);
      txtHeader.push('-'.repeat(50));
      const txtRows = [
        ...txtHeader,
        headerLabels.join('\t'),
        ...rawRows.map(row => row.join('\t'))
      ];
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=students_export_${dateStr}.txt`);
      return res.status(200).send(txtRows.join('\n'));
    }

    // ── JSON (used by client-side PDF generation) ────────────────────────────
    if (format === 'json') {
      const result = rawRows.map(row => {
        const obj = {};
        headerLabels.forEach((h, i) => {
          obj[h] = row[i];
        });
        return obj;
      });
      return res.status(200).json({ success: true, headers: headerLabels, rows: rawRows, data: result, schoolName: headerInfo.schoolName });
    }

    res.status(400).json({ success: false, message: `Unsupported format: ${format}` });

  } catch (error) {
    logger.error('Export error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({ success: false, message: 'Server error during export' });
  }
});

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
router.get('/:id', protect, canAccessStudent, async(req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student',
      tenantId: req.user.tenantId
    })
      .select('-password')
      .populate('subDepartment', 'name')
      .populate('driverId', 'name phone')
      .populate('classId', 'name grade');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get fee summary via aggregation (single DB call instead of loading all fees)
    const feeSummaryAgg = await Fee.aggregate([
      { $match: { student: student._id } },
      { $group: {
        _id: null,
        total: { $sum: '$amount' },
        paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
        overdue: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, '$amount', 0] } }
      } }
    ]);
    const summary = feeSummaryAgg[0] || { total: 0, paid: 0, pending: 0, overdue: 0 };

    // Get recent fees only (limit 50 for performance)
    const fees = await Fee.find({ student: student._id }).sort({ dueDate: -1 }).limit(50).lean();

    // Format currency once and reuse for all fees
    const currencySymbol = await formatCurrencyWithSettings(0);
    const symbolPrefix = currencySymbol.replace(/[\d.,\s]/g, '');
    const formatAmount = (amt) => `${symbolPrefix}${Number(amt || 0).toLocaleString('en-IN')}`;

    const formattedFees = fees.map(fee => ({
      ...fee,
      formattedAmount: formatAmount(fee.amount)
    }));

    res.json({
      success: true,
      data: {
        ...student.toJSON(),
        fees: formattedFees,
        feeSummary: {
          total: formatAmount(summary.total),
          paid: formatAmount(summary.paid),
          pending: formatAmount(summary.pending),
          overdue: formatAmount(summary.overdue)
        }
      },
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Get student error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student',
      requestId: req.requestId
    });
  }
});

// @desc    Helper — fetch student + school data for detail-form rendering
async function loadStudentAndSchoolForForm(req) {
  const student = await User.findOne({
    _id: req.params.id,
    role: 'student',
    tenantId: req.user.tenantId
  })
    .select('-password')
    .populate('subDepartment', 'name')
    .populate('driverId', 'name phone')
    .populate('classId', 'name grade')
    .lean();

  if (!student) return { student: null };

  const Tenant = require('../models/Tenant');
  const tenant = await Tenant.findById(req.user.tenantId)
    .select('schoolName schoolCode address phone email logo fullAddress').lean();
  const settings = await Settings.getSettings(req.user.tenantId);
  const schoolData = tenant ? { ...tenant } : {};
  if (settings?.institution) {
    if (settings.institution.contact?.phone) schoolData.phone = settings.institution.contact.phone;
    if (settings.institution.contact?.email) schoolData.email = settings.institution.contact.email;
    if (settings.institution.schoolCode) schoolData.schoolCode = settings.institution.schoolCode;
    if (settings.institution.udiseCode) schoolData.udiseCode = settings.institution.udiseCode;
    if (settings.institution.logo) schoolData.logo = settings.institution.logo;
  }

  return { student, schoolData };
}

// @desc    View printable student detail form (HTML)
// @route   GET /api/students/:id/detail-form/html
// @access  Private (Admin)
router.get('/:id/detail-form/html', protect, authorize('admin', 'principal', 'vice_principal'), async(req, res) => {
  try {
    const { student, schoolData } = await loadStudentAndSchoolForForm(req);
    if (!student) return res.status(404).send('Student not found');

    const { generateStudentDetailFormHtml } = require('../services/studentDetailFormPdfService');
    const html = await generateStudentDetailFormHtml(student, schoolData);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    logger.error('Student detail form HTML error', error, { requestId: req.requestId, tenantId: req.user?.tenantId });
    if (!res.headersSent) res.status(500).send('Server error generating form');
  }
});

// @desc    Download student detail form (PDF)
// @route   GET /api/students/:id/detail-form/pdf
// @access  Private (Admin)
router.get('/:id/detail-form/pdf', protect, authorize('admin', 'principal', 'vice_principal'), async(req, res) => {
  try {
    const { student, schoolData } = await loadStudentAndSchoolForForm(req);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found', requestId: req.requestId });
    }

    const { generateStudentDetailFormPdf } = require('../services/studentDetailFormPdfService');
    const pdfBuffer = await generateStudentDetailFormPdf(student, schoolData);

    const safeName = (student.fullName || student.name || 'Student').replace(/[^a-zA-Z0-9-_]/g, '_');
    const safeAdm = (student.admissionNumber || '').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `Student-Detail-${safeName}${safeAdm ? `-${  safeAdm}` : ''}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  } catch (error) {
    logger.error('Student detail form PDF error', error, { requestId: req.requestId, tenantId: req.user?.tenantId });
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Server error generating form PDF', requestId: req.requestId });
    }
  }
});

// @desc    Create new student
// @route   POST /api/students
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), planGate.requireActiveSubscription, planGate.checkStudentLimit, validateStudent, handleValidationErrors, async(req, res) => {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(400).json({ success: false, message: 'User tenant not found.' });
    }

    const {
      fullName, name, firstName, middleName, lastName, email, phone: _phone, password,
      classId, class: studentClass, section, academicYear, rollNumber, admissionDate, admissionClass,
      guardians, address, avatar,
      penNumber, subDepartment, udiseCode,
      transportMode, driverId,
      // Student personal/medical fields from form
      dateOfBirth, gender, bloodGroup, religion, category,
      identificationMark, isOrphan, nationality,
      previousSchool, previousBoard, previousRollNumber, transferNotes,
      medicalConditions, allergies, doctorName, doctorPhone, notes
    } = req.body;

    // Handle Transport Mode Logic
    let finalDriverId = driverId;
    let finalTransportMode = transportMode || '';

    if (driverId === 'self') {
      finalDriverId = null;
      finalTransportMode = 'Self';
    } else if (driverId && driverId.trim() !== '') {
      finalTransportMode = 'School Transport';
    }

    const tenantId = req.user.tenantId;

    // Check email uniqueness within tenant (only if email provided)
    if (email && email.trim()) {
      const existingEmail = await User.findOne({
        email: email.toLowerCase().trim(),
        tenantId
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Student with this email already exists'
        });
      }
    }

    // Check Roll Number uniqueness
    if (rollNumber && studentClass && academicYear) {
      const existingRoll = await User.findOne({
        rollNumber: rollNumber.trim(),
        class: studentClass.trim(),
        section: section ? section.trim() : undefined,
        academicYear: academicYear.trim(),
        role: 'student',
        tenantId
      });
      if (existingRoll) {
        return res.status(400).json({ success: false, message: 'Roll number already exists in this class/section' });
      }
    }

    // ── Duplicate student detection ───────────────────────────────────────
    // Catches accidental re-entry of the same student. Admin can override
    // by re-submitting with confirmDuplicate: true (intentional edge cases:
    // namesakes, re-admissions, etc.).
    if (!req.body.confirmDuplicate) {
      const candidateName = (fullName || name || '').trim();
      const normalizedName = candidateName.toLowerCase().replace(/\s+/g, ' ');

      const guardianPhones = Array.isArray(guardians)
        ? guardians
          .map(g => (g && g.phone ? String(g.phone).replace(/[\s\-+]/g, '') : ''))
          .filter(p => p && p.length >= 10)
        : [];

      if (normalizedName && normalizedName.length >= 2) {
        const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nameRegex = new RegExp(`^${escapeRegex(normalizedName)}$`, 'i');

        const orClauses = [];
        if (dateOfBirth) {
          const dob = new Date(dateOfBirth);
          if (!isNaN(dob.getTime())) {
            const dobStart = new Date(dob); dobStart.setHours(0, 0, 0, 0);
            const dobEnd = new Date(dob); dobEnd.setHours(23, 59, 59, 999);
            orClauses.push({ dateOfBirth: { $gte: dobStart, $lte: dobEnd } });
          }
        }
        if (guardianPhones.length) {
          orClauses.push({ 'guardians.phone': { $in: guardianPhones } });
        }
        if (studentClass && section) {
          orClauses.push({
            class: studentClass.trim(),
            section: section.trim()
          });
        }

        if (orClauses.length) {
          const candidates = await User.find({
            tenantId,
            role: 'student',
            isActive: { $ne: false },
            $and: [
              {
                $or: [
                  { name: nameRegex },
                  { fullName: nameRegex }
                ]
              },
              { $or: orClauses }
            ]
          })
            .select('_id name fullName admissionNumber class section dateOfBirth guardians')
            .limit(5)
            .lean();

          if (candidates.length) {
            return res.status(409).json({
              success: false,
              potentialDuplicate: true,
              message: 'A student with similar details already exists. Please confirm to add anyway.',
              duplicates: candidates.map(c => {
                const primaryGuardian = (c.guardians || []).find(g => g.isPrimary) || (c.guardians || [])[0] || {};
                return {
                  id: c._id,
                  name: c.fullName || c.name,
                  admissionNumber: c.admissionNumber,
                  class: c.class,
                  section: c.section,
                  dateOfBirth: c.dateOfBirth,
                  guardianName: primaryGuardian.name,
                  guardianPhone: primaryGuardian.phone
                };
              }),
              requestId: req.requestId
            });
          }
        }
      }
    }

    // Generate Admission Number (if not provided)
    let admissionNumber = req.body.admissionNumber ? req.body.admissionNumber.trim() : null;

    if (!admissionNumber) {
      admissionNumber = await generateAdmissionNumber(tenantId);
    }

    // Look up sectionId if section name is provided
    let sectionId = req.body.sectionId || null;
    if (section && !sectionId) {
      try {
        const Section = require('../models/Section');
        const Class = require('../models/Class');

        // Find the class first
        const classDoc = await Class.findOne({
          grade: studentClass,
          tenantId
        });

        if (classDoc) {
          // Find the section within that class
          const sectionDoc = await Section.findOne({
            name: section.trim().toUpperCase(),
            classId: classDoc._id,
            tenantId,
            isActive: true
          });

          if (sectionDoc) {
            sectionId = sectionDoc._id;
          }
        }
      } catch (err) {
        logger.error('Error looking up sectionId', err, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
        // Continue without sectionId - will save section string only
      }
    }

    // Support both fullName and name (since StudentForm.jsx renames fullName to name)
    const finalName = fullName || name;

    // Default password: use provided password or 'student123'
    const defaultPassword = password || 'student123';

    const studentData = {
      fullName: finalName ? finalName.trim() : undefined,
      name: finalName ? finalName.trim() : undefined,
      firstName: firstName ? firstName.trim() : undefined,
      middleName: middleName ? middleName.trim() : undefined,
      lastName: lastName ? lastName.trim() : undefined,
      email: email && email.trim() ? email.toLowerCase().trim() : undefined,
      password: defaultPassword,
      role: 'student',
      tenantId,
      admissionNumber,
      classId: classId || undefined,
      class: studentClass,
      section,
      sectionId,
      academicYear,
      rollNumber,
      admissionDate: admissionDate || new Date(),
      admissionClass: admissionClass || studentClass || undefined,
      guardians, address, avatar,
      // Backfill legacy fatherOrHusbandName from guardians for backward compatibility
      fatherOrHusbandName: guardians?.find(g => g.relation === 'Father')?.name || undefined,
      penNumber: penNumber ? penNumber.trim() : undefined,
      subDepartment,
      udiseCode: udiseCode ? udiseCode.trim() : undefined,
      transportMode: finalTransportMode,
      driverId: finalDriverId,
      // Personal details
      dateOfBirth, gender, bloodGroup, religion, category,
      identificationMark, isOrphan, nationality,
      // Academic background
      previousSchool, previousBoard, previousRollNumber, transferNotes,
      // Medical & notes
      medicalConditions, allergies, doctorName, doctorPhone, notes
    };

    const student = await User.create(studentData);

    if (admissionDate) {
      logger.info('Admission date set on student creation', {
        requestId: req.requestId, tenantId, studentId: student._id,
        admissionDate: student.admissionDate
      });
    }

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      requestId: req.requestId,
      data: {
        id: student._id,
        name: student.name,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        admissionNumber: student.admissionNumber,
        credentials: {
          loginId: student.email || student.admissionNumber,
          password: defaultPassword,
          note: student.email
            ? 'Login with email or admission number'
            : 'Login with admission number'
        }
      }
    });

  } catch (error) {
    // Rollback admission number counter if we auto-generated one
    if (!req.body.admissionNumber) {
      try {
        const { rollbackAdmissionNumber } = require('../utils/admissionUtils');
        await rollbackAdmissionNumber(req.user.tenantId);
      } catch (rollbackErr) {
        logger.error('Admission number rollback failed', rollbackErr, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
      }
    }

    logger.error('Create student error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate entry detected (Email or Admission No)' });
    }
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
});

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private
router.put('/:id', protect, canAccessStudent, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Please provide a valid email address'),
  body('phone').optional().custom((value) => {
    // Allow empty string or null
    if (!value || value.trim() === '') return true;
    // Basic phone validation - just check if it's numeric and reasonable length
    const cleaned = value.replace(/[\s\-()]/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(cleaned)) {
      throw new Error('Please provide a valid phone number (10-15 digits)');
    }
    return true;
  }),
  body('class').optional().trim().notEmpty().withMessage('Class cannot be empty'),
  body('rollNumber').optional().custom((value) => {
    // Allow empty string or null
    if (!value || value.trim() === '') return true;
    // If provided, just check it's not too long
    if (value.trim().length > 20) {
      throw new Error('Roll number is too long');
    }
    return true;
  }),
  handleValidationErrors
], async(req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
      role: 'student'
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if email already exists (if being updated)
    if (req.body.email) {
      const existingEmail = await User.findOne({
        email: req.body.email.trim().toLowerCase(),
        _id: { $ne: req.params.id },
        tenantId: req.user.tenantId
      });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists for another user'
        });
      }
    }

    // Check if roll number already exists in the same class (if being updated)
    // Treat '0' and empty values as "no roll number" — skip duplicate check.
    const rollNumberValue = req.body.rollNumber ? String(req.body.rollNumber).trim() : '';
    if (rollNumberValue && rollNumberValue !== '0' && req.body.class) {
      const existingRollNumber = await User.findOne({
        rollNumber: rollNumberValue,
        class: req.body.class?.trim(),
        section: req.body.section ? req.body.section.trim() : undefined,
        role: 'student',
        tenantId: req.user.tenantId,
        _id: { $ne: req.params.id }
      });
      if (existingRollNumber) {
        return res.status(400).json({
          success: false,
          message: 'Roll number already exists in this class/section'
        });
      }
    }

    // Update student
    const updatePayload = { ...req.body };
    if (updatePayload.password === '') {
      delete updatePayload.password;
    }

    // Email's unique index is partial on { email: { $type: 'string' } }, so an
    // empty string still collides across students. If client sent blank email,
    // unset the field rather than writing "".
    let unsetFields = null;
    if (Object.prototype.hasOwnProperty.call(updatePayload, 'email')) {
      const e = typeof updatePayload.email === 'string' ? updatePayload.email.trim() : updatePayload.email;
      if (!e) {
        delete updatePayload.email;
        unsetFields = { ...(unsetFields || {}), email: '' };
      } else {
        updatePayload.email = e.toLowerCase();
      }
    }
    // Same idea for rollNumber: '0' / '' should clear the value rather than persist a placeholder.
    if (Object.prototype.hasOwnProperty.call(updatePayload, 'rollNumber')) {
      const rn = updatePayload.rollNumber == null ? '' : String(updatePayload.rollNumber).trim();
      if (!rn || rn === '0') {
        delete updatePayload.rollNumber;
        unsetFields = { ...(unsetFields || {}), rollNumber: '' };
      } else {
        updatePayload.rollNumber = rn;
      }
    }

    // Keep name and fullName in sync (StudentForm sends 'name', but fullName is displayed)
    if (updatePayload.name && !updatePayload.fullName) {
      updatePayload.fullName = updatePayload.name;
    } else if (updatePayload.fullName && !updatePayload.name) {
      updatePayload.name = updatePayload.fullName;
    }

    // Handle 'self' transport option
    if (updatePayload.driverId === 'self') {
      updatePayload.driverId = null;
      updatePayload.transportMode = 'Self';
    } else if (updatePayload.driverId && updatePayload.driverId !== '' && updatePayload.driverId !== null) {
      updatePayload.transportMode = 'School Transport';
    }

    // Convert empty strings to null for ObjectId fields
    // This prevents "Cast to ObjectId failed" errors
    const objectIdFields = ['driverId', 'subDepartment'];
    objectIdFields.forEach(field => {
      if (updatePayload[field] === '' || updatePayload[field] === null) {
        updatePayload[field] = null;
      }
    });

    // Normalize category value to match enum (General, SC, ST, OBC, Other)
    if (updatePayload.category) {
      const categoryMap = {
        'GENERAL': 'General',
        'general': 'General',
        'SC': 'SC',
        'sc': 'SC',
        'ST': 'ST',
        'st': 'ST',
        'OBC': 'OBC',
        'obc': 'OBC',
        'OTHER': 'Other',
        'other': 'Other'
      };
      updatePayload.category = categoryMap[updatePayload.category] || updatePayload.category;
    }

    // Also backfill fatherOrHusbandName from guardians if guardians are being updated
    if (updatePayload.guardians && Array.isArray(updatePayload.guardians)) {
      const fatherGuardian = updatePayload.guardians.find(g => g.relation === 'Father');
      if (fatherGuardian?.name) {
        updatePayload.fatherOrHusbandName = fatherGuardian.name;
      }
    }

    // Look up sectionId if section is being updated
    if (updatePayload.section && !updatePayload.sectionId) {
      try {
        const Section = require('../models/Section');
        const Class = require('../models/Class');

        // Find the class first (use updated class or existing)
        const classGrade = updatePayload.class || student.class;
        const classDoc = await Class.findOne({
          grade: classGrade,
          tenantId: req.user.tenantId
        });

        if (classDoc) {
          // Find the section within that class
          const sectionDoc = await Section.findOne({
            name: updatePayload.section.trim().toUpperCase(),
            classId: classDoc._id,
            tenantId: req.user.tenantId,
            isActive: true
          });

          if (sectionDoc) {
            updatePayload.sectionId = sectionDoc._id;
          }
        }
      } catch (err) {
        logger.error('Error looking up sectionId during update', err, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
        // Continue without sectionId - will save section string only
      }
    }

    // Log admission date changes
    if (updatePayload.admissionDate && updatePayload.admissionDate !== student.admissionDate?.toISOString()?.substring(0, 10)) {
      logger.info('Admission date updated', {
        requestId: req.requestId, tenantId: req.user.tenantId, studentId: req.params.id,
        previousAdmissionDate: student.admissionDate, newAdmissionDate: updatePayload.admissionDate
      });
      // Write to ActivityLog for UI activity feed
      try {
        const ActivityLog = require('../models/ActivityLog');
        await ActivityLog.create({
          tenantId: req.user.tenantId,
          type: 'student',
          action: 'admission_date_update',
          message: `Admission date updated to: ${updatePayload.admissionDate} for ${student.fullName || student.name}`,
          studentName: student.fullName || student.name,
          userId: req.user._id
        });
      } catch { /* non-critical */ }
    }

    const updateOp = unsetFields
      ? { $set: updatePayload, $unset: unsetFields }
      : updatePayload;
    const updatedStudent = await User.findByIdAndUpdate(
      req.params.id,
      updateOp,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    logger.error('Update student error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({ success: false, message: `Duplicate entry detected for ${field}` });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while updating student',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get pending fees for a student
// @route   GET /api/students/:id/pending-fees
// @access  Private (Admin)
router.get('/:id/pending-fees', protect, authorize('admin'), async(req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student',
      tenantId: req.user.tenantId
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Check both Fee (legacy) and FeeInvoice (current) models
    const [legacyFees, invoices] = await Promise.all([
      Fee.find({
        student: req.params.id,
        tenantId: req.user.tenantId,
        status: { $in: ['pending', 'overdue', 'partially_paid'] }
      }),
      FeeInvoice.find({
        studentId: req.params.id,
        tenantId: req.user.tenantId,
        status: { $in: ['Pending', 'Partial', 'Overdue'] }
      })
    ]);

    const breakdown = [];
    let totalPending = 0;

    // Legacy Fee records
    for (const f of legacyFees) {
      const balance = f.balance > 0 ? f.balance : f.amount - (f.paidAmount || 0);
      totalPending += balance;
      breakdown.push({
        id: f._id,
        description: f.description,
        feeType: f.feeType || 'Fee',
        amount: f.amount,
        paidAmount: f.paidAmount || 0,
        balance,
        status: f.status,
        dueDate: f.dueDate,
        source: 'fee'
      });
    }

    // FeeInvoice records
    for (const inv of invoices) {
      totalPending += inv.balanceAmount;
      breakdown.push({
        id: inv._id,
        description: inv.invoiceNumber + (inv.items?.length ? ` — ${inv.items.map(i => i.feeHeadName).join(', ')}` : ''),
        feeType: 'Invoice',
        amount: inv.totalAmount,
        paidAmount: inv.paidAmount || 0,
        balance: inv.balanceAmount,
        status: inv.status,
        dueDate: inv.dueDate,
        source: 'invoice'
      });
    }

    res.json({
      success: true,
      data: {
        hasPending: breakdown.length > 0,
        totalAmount: totalPending,
        count: breakdown.length,
        breakdown
      }
    });
  } catch (error) {
    logger.error('Get pending fees error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId });
    res.status(500).json({ success: false, message: 'Server error while fetching pending fees' });
  }
});

// @desc    Deactivate student (mark as inactive with removal details)
// @route   PUT /api/students/:id/deactivate
// @access  Private (Admin)
router.put('/:id/deactivate', protect, authorize('admin'), [
  body('removalDate').optional().isISO8601().withMessage('Invalid removal date'),
  body('removalReason').optional().isIn(['Graduated', 'Transferred', 'Withdrawn', 'Expelled', 'Other', '']).withMessage('Invalid removal reason'),
  body('removalNotes').optional().trim(),
  handleValidationErrors
], async(req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student',
      tenantId: req.user.tenantId
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if already inactive
    if (!student.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Student is already inactive'
      });
    }

    // Prepare update data
    const updateData = {
      isActive: false,
      removalDate: req.body.removalDate ? new Date(req.body.removalDate) : new Date(),
      removalReason: req.body.removalReason || 'Other',
      removalNotes: req.body.removalNotes || ''
    };

    // Update student
    const updatedStudent = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Student deactivated successfully',
      data: updatedStudent
    });
  } catch (error) {
    logger.error('Deactivate student error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while deactivating student',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Reactivate student (mark as active, clear removal details)
// @route   PUT /api/students/:id/reactivate
// @access  Private (Admin)
router.put('/:id/reactivate', protect, authorize('admin'), async(req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student',
      tenantId: req.user.tenantId
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if already active
    if (student.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Student is already active'
      });
    }

    // Prepare update data - clear removal fields
    const updateData = {
      isActive: true,
      removalDate: null,
      removalReason: '',
      removalNotes: ''
    };

    // Update student
    const updatedStudent = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Student reactivated successfully',
      data: updatedStudent
    });
  } catch (error) {
    logger.error('Reactivate student error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while reactivating student',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Bulk delete students permanently
// @route   DELETE /api/students/bulk-delete
// @access  Private (Admin)
router.delete('/bulk-delete', protect, authorize('admin'), async(req, res) => {
  try {
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide student IDs'
      });
    }

    // Verify all students belong to this tenant
    const students = await User.find({
      _id: { $in: studentIds },
      role: 'student',
      tenantId: req.user.tenantId
    }).select('_id fullName');

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No valid students found'
      });
    }

    const validIds = students.map(s => s._id);

    // Check if any of these students have existing fees
    const studentsWithFees = await Fee.distinct('student', {
      student: { $in: validIds }
    });

    if (studentsWithFees.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${studentsWithFees.length} student(s) have existing fee records and cannot be deleted. Please clear their fees first.`
      });
    }

    // Delete all valid students
    const result = await User.deleteMany({
      _id: { $in: validIds },
      role: 'student',
      tenantId: req.user.tenantId
    });

    res.json({
      success: true,
      message: `${result.deletedCount} student(s) deleted permanently`,
      data: { count: result.deletedCount }
    });
  } catch (error) {
    logger.error('Bulk delete students error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while deleting students'
    });
  }
});

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async(req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student',
      tenantId: req.user.tenantId
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Soft delete - set status to inactive
    student.isActive = false;
    student.loginEnabled = false;
    student.inactiveReason = 'Deleted by admin';
    student.inactivatedAt = new Date();
    student.inactivatedBy = req.user._id;
    await student.save();

    res.json({
      success: true,
      message: 'Student deactivated successfully'
    });
  } catch (error) {
    logger.error('Delete student error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while deleting student'
    });
  }
});

// @desc    Get student fees
// @route   GET /api/students/:id/fees
// @access  Private
router.get('/:id/fees', protect, canAccessStudent, async(req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const fees = await Fee.find({ student: req.params.id })
      .sort({ dueDate: -1 });

    // Format fees with currency
    const formattedFees = await Promise.all(
      fees.map(async(fee) => ({
        ...fee.toJSON(),
        formattedAmount: await formatCurrencyWithSettings(fee.amount, fee.currency)
      }))
    );

    res.json({
      success: true,
      data: formattedFees
    });
  } catch (error) {
    logger.error('Get student fees error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student fees'
    });
  }
});

// @desc    Get student statistics
// @route   GET /api/students/:id/statistics
// @access  Private
router.get('/:id/statistics', protect, canAccessStudent, async(req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const fees = await Fee.find({ student: req.params.id });

    const statistics = {
      totalFees: fees.length,
      paidFees: fees.filter(fee => fee.status === 'paid').length,
      pendingFees: fees.filter(fee => fee.status === 'pending').length,
      overdueFees: fees.filter(fee => fee.status === 'overdue').length,
      totalAmount: fees.reduce((sum, fee) => sum + fee.amount, 0),
      paidAmount: fees.filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + fee.amount, 0),
      pendingAmount: fees.filter(fee => fee.status === 'pending').reduce((sum, fee) => sum + fee.amount, 0),
      overdueAmount: fees.filter(fee => fee.status === 'overdue').reduce((sum, fee) => sum + fee.amount, 0)
    };

    // Format amounts
    statistics.formattedTotalAmount = await formatCurrencyWithSettings(statistics.totalAmount);
    statistics.formattedPaidAmount = await formatCurrencyWithSettings(statistics.paidAmount);
    statistics.formattedPendingAmount = await formatCurrencyWithSettings(statistics.pendingAmount);
    statistics.formattedOverdueAmount = await formatCurrencyWithSettings(statistics.overdueAmount);

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error('Get student statistics error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student statistics'
    });
  }
});

// @desc    Toggle student active/inactive status
// @route   PUT /api/students/:id/toggle-status
// @access  Private (Admin)
router.put('/:id/toggle-status', protect, authorize('admin'), async(req, res) => {
  try {
    const { reason } = req.body;
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student',
      tenantId: req.user.tenantId
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Toggle status
    student.isActive = !student.isActive;

    if (!student.isActive) {
      student.inactiveReason = reason || 'No reason provided';
      student.inactivatedAt = new Date();
      student.inactivatedBy = req.user._id;
      student.loginEnabled = false; // Disable login when inactive
    } else {
      student.inactiveReason = null;
      student.inactivatedAt = null;
      student.inactivatedBy = null;
      student.loginEnabled = true; // Re-enable login when active
    }

    await student.save();

    res.json({
      success: true,
      message: `Student ${student.isActive ? 'activated' : 'deactivated'} successfully`,
      data: student
    });
  } catch (error) {
    logger.error('Toggle status error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while toggling student status'
    });
  }
});

// @desc    Reset student password
// @route   PUT /api/students/:id/reset-password
// @access  Private (Admin)
router.put('/:id/reset-password', protect, authorize('admin'), async(req, res) => {
  try {
    const { newPassword, forceChange } = req.body;
    const student = await User.findOne({
      _id: req.params.id,
      role: 'student',
      tenantId: req.user.tenantId
    }).select('+password');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Set new password (will be hashed by pre-save hook)
    student.password = newPassword || 'student123';
    student.forcePasswordChange = forceChange !== undefined ? forceChange : true;

    await student.save();

    res.json({
      success: true,
      message: 'Password reset successfully',
      data: {
        email: student.email,
        newPassword: newPassword || 'student123'
      }
    });
  } catch (error) {
    logger.error('Reset password error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while resetting password'
    });
  }
});

// @desc    Bulk activate students
// @route   POST /api/students/bulk-activate
// @access  Private (Admin)
router.post('/bulk-activate', protect, authorize('admin'), async(req, res) => {
  try {
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide student IDs'
      });
    }

    const result = await User.updateMany(
      { _id: { $in: studentIds }, role: 'student', tenantId: req.user.tenantId },
      {
        $set: {
          isActive: true,
          loginEnabled: true,
          inactiveReason: null,
          inactivatedAt: null,
          inactivatedBy: null
        }
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} students activated successfully`,
      data: { count: result.modifiedCount }
    });
  } catch (error) {
    logger.error('Bulk activate error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while activating students'
    });
  }
});

// @desc    Bulk deactivate students
// @route   POST /api/students/bulk-deactivate
// @access  Private (Admin)
router.post('/bulk-deactivate', protect, authorize('admin'), async(req, res) => {
  try {
    const { studentIds, reason } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide student IDs'
      });
    }

    const result = await User.updateMany(
      { _id: { $in: studentIds }, role: 'student', tenantId: req.user.tenantId },
      {
        $set: {
          isActive: false,
          loginEnabled: false,
          inactiveReason: reason || 'Bulk deactivation',
          inactivatedAt: new Date(),
          inactivatedBy: req.user._id
        }
      }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} students deactivated successfully`,
      data: { count: result.modifiedCount }
    });
  } catch (error) {
    logger.error('Bulk deactivate error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while deactivating students'
    });
  }
});

// @desc    Promote students to next class
// @route   POST /api/students/promote
// @access  Private (Admin)
router.post('/promote', protect, authorize('admin'), async(req, res) => {
  try {
    const { studentIds, toClass, toSection, academicYear, resetRollNumbers } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide student IDs'
      });
    }

    if (!toClass || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Target class and academic year are required'
      });
    }

    const updateData = {
      class: toClass,
      section: toSection || '',
      academicYear: academicYear
    };

    // Reset roll numbers if requested
    if (resetRollNumbers) {
      updateData.rollNumber = '';
    }

    const result = await User.updateMany(
      { _id: { $in: studentIds }, role: 'student', tenantId: req.user.tenantId },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} students promoted successfully`,
      data: {
        count: result.modifiedCount,
        toClass,
        toSection,
        academicYear
      }
    });
  } catch (error) {
    logger.error('Promote students error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while promoting students'
    });
  }
});

// ============================================================================
// EXPORT ROUTES
// ============================================================================

const ImportExportService = require('../services/importExportService');

// @desc    Export students to CSV
// @route   GET /api/students/export
// @access  Private (Admin, Teacher)
router.get('/export', protect, authorize('admin', 'teacher'), async(req, res) => {
  try {
    // Build filter (same as GET /api/students)
    const filter = { role: 'student' };

    if (req.user && req.user.tenantId) {
      filter.tenantId = req.user.tenantId;
    }

    if (req.user.role === 'teacher' && req.user.assignedClasses) {
      filter.class = { $in: req.user.assignedClasses };
    }

    if (req.query.class) {
      filter.class = req.query.class;
    }

    // Section filter — SIMPLE STRING MATCH (no sectionId dependency)
    if (req.query.section) {
      const sectionStr = req.query.section.trim();
      filter.section = new RegExp(`^${sectionStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }

    if (req.query.academicYear) {
      filter.academicYear = req.query.academicYear;
    }

    if (req.query.status) {
      filter.isActive = req.query.status === 'active';
    }

    // Get students
    const students = await User.find(filter)
      .select('-password')
      .populate('class', 'name')
      .lean();

    // Define columns for export
    const columns = [
      { key: 'admissionNumber', header: 'Admission Number' },
      { key: 'name', header: 'Full Name' },
      { key: 'email', header: 'Email' },
      { key: 'phone', header: 'Phone' },
      { key: 'dateOfBirth', header: 'Date of Birth', format: (val) => val ? new Date(val).toISOString().split('T')[0] : '' },
      { key: 'gender', header: 'Gender' },
      { key: 'class.name', header: 'Class' },
      { key: 'section', header: 'Section' },
      { key: 'rollNumber', header: 'Roll Number' },
      { key: 'admissionDate', header: 'Admission Date', format: (val) => val ? new Date(val).toISOString().split('T')[0] : '' },
      { key: 'admissionClass', header: 'Admission Class' },
      { key: 'bloodGroup', header: 'Blood Group' },
      { key: 'address', header: 'Address' },
      { key: 'city', header: 'City' },
      { key: 'state', header: 'State' },
      { key: 'pincode', header: 'Pincode' },
      { key: 'isActive', header: 'Status', format: (val) => val ? 'Active' : 'Inactive' },
      { key: 'inactivatedAt', header: 'Deactivated At', format: (val) => val ? new Date(val).toISOString().split('T')[0] : '' },
      { key: 'removalDate', header: 'Removal Date', format: (val) => val ? new Date(val).toISOString().split('T')[0] : '' },
      { key: 'removalReason', header: 'Removal Reason' },
      { key: 'removalNotes', header: 'Removal Notes' },
      { key: 'createdAt', header: 'Created At', format: (val) => new Date(val).toISOString().split('T')[0] }
    ];

    // Get format from query parameter (default to csv)
    const format = req.query.format || 'csv';

    // Generate export file
    let buffer;
    let contentType;
    let fileExtension;

    if (format === 'xlsx' || format === 'excel') {
      buffer = ImportExportService.exportToExcel(students, columns, 'Students');
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileExtension = 'xlsx';
    } else {
      buffer = await ImportExportService.exportToCSV(students, columns);
      contentType = 'text/csv';
      fileExtension = 'csv';
    }

    const filename = `students_export_${new Date().toISOString().split('T')[0]}.${fileExtension}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    logger.error('Export students error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({
      success: false,
      message: 'Server error while exporting students'
    });
  }
});

// --- Class Promotion & Demotion Routes ---
const StudentClassHistory = require('../models/StudentClassHistory');
const classSequence = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const _getNextClass = (currentClass) => {
  const index = classSequence.indexOf(currentClass);
  if (index === -1) return null; // Unknown class
  if (index === classSequence.length - 1) return 'GRADUATED';
  return classSequence[index + 1];
};

const _getPrevClass = (currentClass) => {
  const index = classSequence.indexOf(currentClass);
  if (index === -1) return null;
  if (index === 0) return 'LOWEST';
  return classSequence[index - 1];
};

// @desc    Get bulk promotion/demotion history for reports
// @route   GET /api/students/promotions/report
// @access  Private (Admin)
router.get('/promotions/report', protect, authorize('admin', 'principal'), async(req, res) => {
  try {
    const { startDate, endDate, academicYear, actionType } = req.query;
    const filter = { tenantId: req.user.tenantId };

    if (academicYear) filter.academicYear = academicYear;
    if (actionType) filter.actionType = actionType;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = eDate;
      }
    }

    const history = await StudentClassHistory.find(filter)
      .populate('studentId', 'name fullName admissionNumber')
      .populate('performedBy', 'name fullName')
      .sort({ createdAt: -1 })
      .limit(1000); // Reasonable limit for now

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('Get promotions report error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({ success: false, message: 'Server error fetching promotion report' });
  }
});

// @desc    Get student class history
// @route   GET /api/students/:id/class-history
// @access  Private
router.get('/:id/class-history', protect, authorize('admin', 'teacher'), async(req, res) => {
  try {
    const history = await StudentClassHistory.find({
      studentId: req.params.id,
      tenantId: req.user.tenantId
    })
      .populate('performedBy', 'name fullName')
      .sort({ createdAt: -1 });

    const student = await User.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
      .select('admissionClass');

    res.json({
      success: true,
      data: history,
      admissionClass: student?.admissionClass || 'N/A'
    });
  } catch (error) {
    logger.error('Get class history error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({ success: false, message: 'Server error fetching class history' });
  }
});

// @desc    Promote individual student
// @route   POST /api/students/:id/promote
// @access  Private (Admin)
router.post('/:id/promote', protect, authorize('admin', 'principal'), async(req, res) => {
  try {
    const { toClass, toSection, academicYear, remarks, forceOverride } = req.body;
    const student = await User.findOne({ _id: req.params.id, tenantId: req.user.tenantId, role: 'student' });

    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Check if duplicate promotion this year unless overridden
    if (!forceOverride) {
      const existingAction = await StudentClassHistory.findOne({
        studentId: student._id,
        academicYear,
        actionType: 'promoted',
        tenantId: req.user.tenantId
      });
      if (existingAction) {
        return res.status(400).json({ success: false, message: 'Student already promoted this academic year', requiresOverride: true });
      }
    }

    // Set admission class if missing and this is their first move
    if (!student.admissionClass) {
      student.admissionClass = student.class;
      student.admissionSection = student.section;
    }

    const fromClass = student.class;
    const fromSection = student.section;

    student.class = toClass;
    if (toSection) student.section = toSection;
    student.academicYear = academicYear;

    // Lookup Class ID if class model changes are needed later (Optional but good practice)
    const classDoc = await Class.findOne({ grade: toClass, tenantId: req.user.tenantId });
    if (classDoc) student.classId = classDoc._id;

    await student.save();

    await StudentClassHistory.create({
      tenantId: req.user.tenantId,
      studentId: student._id,
      fromClass,
      fromSection,
      toClass,
      toSection: student.section,
      academicYear,
      actionType: 'promoted',
      performedBy: req.user._id,
      remarks: remarks || `Promoted to ${toClass}`
    });

    res.json({ success: true, message: 'Student promoted successfully', data: student });
  } catch (error) {
    logger.error('Promote student error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({ success: false, message: 'Server error during promotion' });
  }
});

// @desc    Demote individual student
// @route   POST /api/students/:id/demote
// @access  Private (Admin)
router.post('/:id/demote', protect, authorize('admin', 'principal'), async(req, res) => {
  try {
    const { toClass, toSection, academicYear, remarks, forceOverride } = req.body;
    const student = await User.findOne({ _id: req.params.id, tenantId: req.user.tenantId, role: 'student' });

    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (!forceOverride) {
      const existingAction = await StudentClassHistory.findOne({
        studentId: student._id,
        academicYear,
        actionType: 'demoted',
        tenantId: req.user.tenantId
      });
      if (existingAction) {
        return res.status(400).json({ success: false, message: 'Student already demoted this academic year', requiresOverride: true });
      }
    }

    if (!student.admissionClass) {
      student.admissionClass = student.class;
      student.admissionSection = student.section;
    }

    const fromClass = student.class;
    const fromSection = student.section;

    student.class = toClass;
    if (toSection) student.section = toSection;
    student.academicYear = academicYear;

    const classDoc = await Class.findOne({ grade: toClass, tenantId: req.user.tenantId });
    if (classDoc) student.classId = classDoc._id;

    await student.save();

    await StudentClassHistory.create({
      tenantId: req.user.tenantId,
      studentId: student._id,
      fromClass,
      fromSection,
      toClass,
      toSection: student.section,
      academicYear,
      actionType: 'demoted',
      performedBy: req.user._id,
      remarks: remarks || `Demoted to ${toClass}`
    });

    res.json({ success: true, message: 'Student demoted successfully', data: student });
  } catch (error) {
    logger.error('Demote student error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({ success: false, message: 'Server error during demotion' });
  }
});

// @desc    Bulk Promote/Demote Operations
// @route   POST /api/students/bulk-class-action
// @access  Private (Admin)
router.post('/bulk-class-action', protect, authorize('admin', 'principal'), async(req, res) => {
  try {
    const {
      studentIds,
      actionType,
      toClass,
      toSection,
      academicYear,
      remarks,
      forceOverride,
      reallocateFees = false,
      targetAcademicSessionId,
      paymentPlan
    } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No students selected' });
    }

    const students = await User.find({
      _id: { $in: studentIds },
      tenantId: req.user.tenantId,
      role: 'student'
    });

    const classDoc = await Class.findOne({ grade: toClass, tenantId: req.user.tenantId });

    // Resolve the target session once if fee reallocation was requested
    let targetSession = null;
    if (reallocateFees) {
      const { resolveTargetSession } = require('../services/feeReallocationService');
      targetSession = await resolveTargetSession({
        tenantId: req.user.tenantId,
        targetAcademicSessionId,
        academicYearName: academicYear
      });
    }

    let successCount = 0;
    const errors = [];
    const feeReallocation = {
      attempted: Boolean(reallocateFees),
      created: 0,
      skipped: 0,
      errors: 0,
      details: []
    };

    for (const student of students) {
      try {
        if (!forceOverride) {
          const existingAction = await StudentClassHistory.findOne({
            studentId: student._id,
            academicYear,
            actionType,
            tenantId: req.user.tenantId
          });
          if (existingAction) {
            errors.push(`${student.fullName} was already ${actionType} this year.`);
            continue;
          }
        }

        if (!student.admissionClass) {
          student.admissionClass = student.class;
          student.admissionSection = student.section;
        }

        const fromClass = student.class;
        const fromSection = student.section;

        student.class = toClass;
        if (toSection) student.section = toSection;
        student.academicYear = academicYear;
        if (classDoc) student.classId = classDoc._id;

        await student.save();

        await StudentClassHistory.create({
          tenantId: req.user.tenantId,
          studentId: student._id,
          fromClass,
          fromSection,
          toClass,
          toSection: student.section,
          academicYear,
          actionType,
          performedBy: req.user._id,
          remarks: remarks || `Bulk ${actionType} to ${toClass}`
        });

        successCount++;

        // Fee reallocation: only if requested, a session was resolved, and the class actually changed
        if (reallocateFees && targetSession && classDoc && fromClass !== toClass) {
          try {
            const { reallocateStudentForSession } = require('../services/feeReallocationService');
            const result = await reallocateStudentForSession({
              tenantId: req.user.tenantId,
              student,
              newClassId: classDoc._id,
              newSectionId: null,
              session: targetSession,
              performedBy: req.user._id,
              paymentPlan
            });

            if (result.status === 'created') {
              feeReallocation.created++;
            } else if (result.status === 'skipped') {
              feeReallocation.skipped++;
              feeReallocation.details.push(`${student.name || student.fullName}: ${result.reason}`);
            } else {
              feeReallocation.errors++;
              feeReallocation.details.push(`${student.name || student.fullName}: ${result.reason}`);
            }
          } catch (reallocErr) {
            feeReallocation.errors++;
            feeReallocation.details.push(`${student.name || student.fullName}: ${reallocErr.message}`);
            logger.error('Fee reallocation failed for student', reallocErr, {
              requestId: req.requestId,
              tenantId: req.user.tenantId,
              studentId: String(student._id)
            });
          }
        }
      } catch (err) {
        errors.push(`Failed for ${student.name || student.fullName}: ${err.message}`);
      }
    }

    // Surface "target session not found" as a single top-level warning
    if (reallocateFees && !targetSession && successCount > 0) {
      feeReallocation.details.push(
        `Fee reallocation skipped — no academic session matching "${academicYear}" found. Create the session (and its fee structures) first, then re-run reallocation from the Fees page.`
      );
    }

    res.json({
      success: true,
      message: `Successfully ${actionType} ${successCount} students.`,
      successCount,
      errors,
      feeReallocation
    });
  } catch (error) {
    logger.error('Bulk class action error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId, userEmail: req.user?.email });
    res.status(500).json({ success: false, message: 'Server error during bulk operation' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Subject Preferences — per-student opt-out of optional subjects
// ────────────────────────────────────────────────────────────────────────────

/**
 * @desc    Get subject preferences for a student
 *          Returns all optional subjects for the student's class and which ones are skipped.
 * @route   GET /api/students/:id/subject-preferences
 * @access  Private (Admin)
 */
router.get('/:id/subject-preferences', protect, authorize('admin', 'principal'), async(req, res) => {
  try {
    const Subject = require('../models/Subject');
    const Result = require('../models/Result');
    const Exam = require('../models/Exam');

    const student = await User.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
      role: 'student'
    }).select('fullName name class skippedSubjects');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Fetch all optional subjects for the tenant
    const optionalSubjects = await Subject.find({
      tenantId: req.user.tenantId,
      isOptional: true,
      isActive: true
    }).select('name subjectCode isOptional').lean();

    // For each optional subject, check if the student already has marks recorded
    const subjectsWithMeta = await Promise.all(optionalSubjects.map(async(subj) => {
      // Find exams for this subject in the student's class
      const exams = await Exam.find({
        tenantId: req.user.tenantId,
        class: student.class,
        subject: subj.name
      }).select('_id').lean();

      let hasMarks = false;
      if (exams.length > 0) {
        const examIds = exams.map(e => e._id);
        const markCount = await Result.countDocuments({
          tenantId: req.user.tenantId,
          student: student._id,
          exam: { $in: examIds }
        });
        hasMarks = markCount > 0;
      }

      return {
        _id: subj._id,
        name: subj.name,
        subjectCode: subj.subjectCode,
        isSkipped: (student.skippedSubjects || []).includes(subj.name),
        hasMarks
      };
    }));

    res.json({
      success: true,
      data: {
        studentId: student._id,
        studentName: student.fullName || student.name,
        studentClass: student.class,
        skippedSubjects: student.skippedSubjects || [],
        optionalSubjects: subjectsWithMeta
      }
    });
  } catch (error) {
    logger.error('Get subject preferences error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * @desc    Update subject preferences for a student
 *          Sets which optional subjects this student has opted out of.
 *          Does NOT delete existing marks — only excludes from display/calculations.
 * @route   PUT /api/students/:id/subject-preferences
 * @access  Private (Admin)
 */
router.put('/:id/subject-preferences', protect, authorize('admin', 'principal'), [
  body('skippedSubjects').isArray().withMessage('skippedSubjects must be an array'),
  body('skippedSubjects.*').isString().trim().notEmpty().withMessage('Each skipped subject must be a non-empty string'),
  handleValidationErrors
], async(req, res) => {
  try {
    const Subject = require('../models/Subject');

    // Verify student exists
    const student = await User.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId,
      role: 'student'
    }).select('_id').lean();

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const { skippedSubjects } = req.body;

    // Validate: only optional subjects can be skipped
    const optionalSubjectNames = await Subject.find({
      tenantId: req.user.tenantId,
      isOptional: true,
      isActive: true
    }).select('name').lean().then(docs => docs.map(d => d.name));

    const invalidSkips = skippedSubjects.filter(s => !optionalSubjectNames.includes(s));
    if (invalidSkips.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot skip non-optional subjects: ${invalidSkips.join(', ')}`
      });
    }

    // Use findByIdAndUpdate to avoid password validation issues with save()
    await User.findByIdAndUpdate(
      req.params.id,
      { $set: { skippedSubjects } },
      { runValidators: false }
    );

    res.json({
      success: true,
      message: 'Subject preferences updated successfully',
      data: { skippedSubjects }
    });
  } catch (error) {
    logger.error('Update subject preferences error', error, { requestId: req.requestId, route: req.route?.path, tenantId: req.user?.tenantId });
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

