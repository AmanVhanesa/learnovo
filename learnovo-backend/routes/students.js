const express = require('express');
const { body, query } = require('express-validator');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Counter = require('../models/Counter');
const { protect, authorize, canAccessStudent } = require('../middleware/auth');
const { handleValidationErrors, validateStudent } = require('../middleware/validation');
const Settings = require('../models/Settings'); // Import Settings model
const SubDepartment = require('../models/SubDepartment');
const { formatCurrencyWithSettings } = require('../utils/currency');
const upload = require('../middleware/upload');
const { parseCSV } = require('../utils/csvHandler');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const TeacherSubjectAssignment = require('../models/TeacherSubjectAssignment');
const Class = require('../models/Class');
const Driver = require('../models/Driver');

const router = express.Router();

// @desc    Get all students
// @route   GET /api/students
// @access  Private (Admin, Teacher)
router.get('/', protect, authorize('admin', 'teacher'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 2000 }).withMessage('Limit must be between 1 and 2000'),
  query('class').optional().trim().notEmpty().withMessage('Class filter cannot be empty'),
  query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search query must be between 1 and 100 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

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
        console.error('Teacher filter error:', err);
        if (!filter.$and) filter.$and = [];
        filter.$and.push({ _id: null });
      }
    }

    // Add class filter from query
    if (req.query.class) {
      filter.class = req.query.class;
    }

    // Add section filter
    if (req.query.section) {
      // If section is provided, we need to find the section by name and classId
      // Then filter by sectionId for accurate results
      try {
        const Section = require('../models/Section');
        const sectionQuery = {
          name: req.query.section,
          tenantId: req.user.tenantId,
          isActive: true
        };

        // If class filter is also provided, use it to narrow down section lookup
        if (req.query.class) {
          const Class = require('../models/Class');
          const classDoc = await Class.findOne({
            grade: req.query.class,
            tenantId: req.user.tenantId
          });
          if (classDoc) {
            sectionQuery.classId = classDoc._id;
          }
        }

        const section = await Section.findOne(sectionQuery);
        if (section) {
          filter.sectionId = section._id;
        } else {
          // If section not found, also try string match as fallback for legacy data
          filter.section = req.query.section;
        }
      } catch (err) {
        console.error('Section filter error:', err);
        // Fallback to string match
        filter.section = req.query.section;
      }
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

    // Add search filter
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { fullName: { $regex: req.query.search, $options: 'i' } },
        { admissionNumber: { $regex: req.query.search, $options: 'i' } },
        { rollNumber: { $regex: req.query.search, $options: 'i' } },
        { studentId: { $regex: req.query.search, $options: 'i' } },
        { phone: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Get students
    const students = await User.find(filter)
      .select('-password')
      .populate('subDepartment', 'name')
      .populate('driverId', 'name phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count
    const total = await User.countDocuments(filter);

    // Get fee summary for each student
    const studentsWithFees = await Promise.all(
      students.map(async (student) => {
        const fees = await Fee.find({ student: student._id });
        const totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0);
        const paidFees = fees.filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + fee.amount, 0);
        const pendingFees = fees.filter(fee => fee.status === 'pending').reduce((sum, fee) => sum + fee.amount, 0);
        const overdueFees = fees.filter(fee => fee.status === 'overdue').reduce((sum, fee) => sum + fee.amount, 0);

        return {
          ...student.toJSON(),
          feeSummary: {
            total: await formatCurrencyWithSettings(totalFees),
            paid: await formatCurrencyWithSettings(paidFees),
            pending: await formatCurrencyWithSettings(pendingFees),
            overdue: await formatCurrencyWithSettings(overdueFees)
          }
        };
      })
    );

    res.json({
      success: true,
      data: studentsWithFees,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching students'
    });
  }
});

// @desc    Download student import CSV template
// @route   GET /api/students/import/template
// @access  Private (Admin)
router.get('/import/template', protect, authorize('admin'), (req, res) => {
  try {
    const fields = [
      'fullName', 'email', 'phone', 'dateOfBirth', 'gender',
      'admissionNumber', 'rollNumber', 'class', 'section', 'academicYear', 'admissionDate',
      'bloodGroup', 'category', 'religion',
      'fatherName', 'fatherPhone', 'fatherEmail',
      'motherName', 'motherPhone', 'motherEmail',
      'guardianName', 'guardianPhone',
      'address',
      'penNumber', 'subDepartment', 'driverName',
      // Optional: firstName, middleName, lastName for backward compatibility
      'firstName', 'middleName', 'lastName'
    ];

    // Create header row
    const csvContent = fields.join(',') + '\n' +
      // Add a sample row
      'John David Doe,john.doe@example.com,1234567890,2010-05-15,male,ADM001,1,10,A,2024-2025,2024-04-01,A+,General,Hindu,Father Name,9876543210,father@example.com,Mother Name,9876543211,mother@example.com,,,123 Main St,12345678901,27 LG SEC,Raju Singh,,,';



    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=students_import_template.csv');
    res.status(200).send(csvContent);
  } catch (error) {
    console.error('Download template error:', error);
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
      'admissionNumber', 'rollNumber', 'class', 'section', 'academicYear', 'admissionDate',
      'bloodGroup', 'category', 'religion',
      'fatherName', 'fatherPhone', 'fatherEmail',
      'motherName', 'motherPhone', 'motherEmail',
      'guardianName', 'guardianPhone',
      'address',
      'penNumber', 'subDepartment', 'driverName',
      'firstName', 'middleName', 'lastName'
    ];

    // Sample data row
    const sampleData = {
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
      'firstName': '',
      'middleName': '',
      'lastName': ''
    };

    // Create worksheet with headers and sample data
    const wsData = [fields, Object.values(sampleData)];
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
    console.error('Download Excel template error:', error);
    res.status(500).json({ success: false, message: 'Server error generating Excel template' });
  }
});

// @desc    Preview student import from CSV
// @route   POST /api/students/import/preview
// @access  Private (Admin)
router.post('/import/preview', protect, authorize('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
    }

    const rows = await parseCSV(req.file);

    // Clean up file immediately after parsing (only if file exists on disk)
    if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

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
        const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
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

    res.json({
      success: true,
      preview,
      errors,
      duplicates, // Students that already exist in the system
      validData, // Send back valid data for the next step
      summary: {
        totalRows: normalizedRows.length,
        validRows: validData.length,
        invalidRows: errors.length > 0 ? normalizedRows.length - validData.length - duplicates.length : 0,
        duplicatesInFile: 0, // Handled in errors logic effectively
        duplicatesInDB: duplicates.length // New students that already exist
      }
    });

  } catch (error) {
    console.error('Import preview error:', error);
    console.error('Error stack:', error.stack);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during preview',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// @desc    Execute student import
// @route   POST /api/students/import/execute
// @access  Private (Admin)
router.post('/import/execute', protect, authorize('admin'), async (req, res) => {
  try {
    const { validData, options } = req.body;

    console.log('=== IMPORT EXECUTE CALLED ===');
    console.log('validData length:', validData ? validData.length : 'undefined');
    console.log('validData is array:', Array.isArray(validData));
    console.log('================================');

    if (!validData || !Array.isArray(validData) || validData.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid data to import' });
    }

    const tenantId = req.user.tenantId;

    // Get settings for UDISE Code
    const settings = await Settings.getSettings(tenantId);
    const defaultUdiseCode = settings.institution?.udiseCode;

    // Extract options
    const skipDuplicates = options?.skipDuplicates || false;
    const replaceDuplicates = options?.replaceDuplicates || false;

    const results = { success: 0, failed: 0, skipped: 0, replaced: 0, errors: [] };

    // Pre-fetch all existing admission numbers for this tenant (for fast lookup)
    const existingStudentsMap = new Map();
    if (skipDuplicates || replaceDuplicates) {
      const existingStudents = await User.find({ tenantId, role: 'student' })
        .select('_id admissionNumber')
        .lean();
      existingStudents.forEach(s => {
        if (s.admissionNumber) {
          existingStudentsMap.set(s.admissionNumber.trim().toUpperCase(), s._id);
        }
      });
    }

    // Pre-cache all classes and drivers for this tenant to avoid N+1 queries in the loop
    const Class = require('../models/Class');
    const Section = require('../models/Section');
    const allClasses = await Class.find({ tenantId }).select('_id name grade').lean();
    const allDrivers = await Driver.find({ tenantId, isActive: true }).select('_id name').lean();
    const driverCache = new Map(allDrivers.map(d => [d.name.toLowerCase().trim(), d]));

    for (const row of validData) {
      let studentData = null; // Declare safely for error logging scope
      const rowNum = row._rowNumber || '?';

      try {
        // Check admission number for existing student (used for replace logic)
        const admNoKey = row.admissionNumber ? row.admissionNumber.toString().trim().toUpperCase() : null;
        const existingId = admNoKey ? existingStudentsMap.get(admNoKey) : null;

        // Skip email duplicate check when replacing an already-identified student
        // (the student exists by design; checking email would throw false errors)
        if (!existingId && row.email && row.email.trim()) {
          const email = row.email.toLowerCase().trim();
          const existingStudent = await User.findOne({ email, tenantId }).select('_id').lean();
          if (existingStudent) {
            throw new Error(`Student with email ${email} already exists`);
          }
        }

        // Generate Admission Number (only if not provided)
        let admissionNumber = row.admissionNumber ? row.admissionNumber.toString().trim() : null;

        if (!admissionNumber) {
          const settings = await Settings.getSettings(tenantId);
          const { mode, prefix, yearFormat, counterPadding, startFrom } = settings.admission;

          const currentYear = new Date().getFullYear().toString();
          const yearStr = yearFormat === 'YY' ? currentYear.substring(2) : currentYear;
          const effectivePrefix = mode === 'CUSTOM' ? (prefix || 'ADM') : 'ADM';

          const sequence = await Counter.getNextSequence('admission', currentYear, tenantId);
          admissionNumber = `${effectivePrefix}${yearStr}${String(sequence).padStart(counterPadding, '0')}`;
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

        // Handle Sub Department
        let subDepartmentId = undefined;
        if (row.subDepartment) {
          const subDeptName = row.subDepartment.toString().trim().toUpperCase();
          let subDept = await SubDepartment.findOne({ tenantId, name: subDeptName });
          // Auto-create if missing
          if (!subDept) {
            subDept = await SubDepartment.create({ tenantId, name: subDeptName });
          }
          subDepartmentId = subDept._id;
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
              console.warn(`Import: Driver not found: ${driverName}`);
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
          udiseCode: defaultUdiseCode,
          isActive: true
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

        // Add email and password only if email exists and is valid
        if (row.email && row.email.trim()) {
          const emailValue = row.email.trim().toLowerCase();
          // Basic email validation - very lenient
          if (emailValue.includes('@') && emailValue.includes('.')) {
            studentData.email = emailValue;
            studentData.password = row.password || 'student123';
          }
        }

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
              studentData.class = classDoc.name;
              studentData.classId = classDoc._id;
            } else {
              studentData.class = rawClassValue;
            }
          } catch (classLookupErr) {
            console.warn('Class lookup error during import:', classLookupErr.message);
            studentData.class = rawClassValue;
          }

          // --- Section lookup (only if class was found) ---
          if (classDoc && row.section && row.section.trim()) {
            try {
              const sectionName = row.section.trim().toUpperCase();
              const escapedSection = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const sectionDoc = await Section.findOne({
                tenantId,
                classId: classDoc._id,
                name: { $regex: new RegExp(`^${escapedSection}$`, 'i') },
                isActive: true
              });
              if (sectionDoc) {
                studentData.sectionId = sectionDoc._id;
                studentData.section = sectionDoc.name;
              }
            } catch (sectionLookupErr) {
              console.warn('Section lookup error during import:', sectionLookupErr.message);
            }
          }
        }

        // Fallback: set section string if not already set by lookup
        if (row.section && row.section.trim() && !studentData.section) {
          studentData.section = row.section.trim().toUpperCase();
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

            // If student is inactive, handle removal fields
            if (row.removalDate) {
              const removalDate = parseDate(row.removalDate);
              if (removalDate) {
                studentData.removalDate = removalDate;
              }
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

        // Hash password if provided
        if (studentData.password) {
          const salt = await bcrypt.genSalt(10);
          studentData.password = await bcrypt.hash(studentData.password, salt);
        }

        // Decide what to do with this row (existingId already computed at top of loop)
        if (existingId && replaceDuplicates) {
          // REPLACE: update fields on the existing student record
          // Exclude: role, tenantId (immutable), createdAt (preserve original), updatedAt (set below), password (preserve unless explicitly in CSV)
          const { role, tenantId: _t, createdAt, updatedAt, password, ...updateFields } = studentData;
          // Only overwrite password if the CSV row provided one explicitly
          if (row.password && row.password.trim()) {
            updateFields.password = password; // already hashed above
          }
          updateFields.updatedAt = new Date();
          await User.findByIdAndUpdate(existingId, { $set: updateFields });
          results.replaced++;
        } else if (existingId && skipDuplicates) {
          // SKIP: do nothing
          results.skipped++;
        } else {
          // INSERT: new student
          await User.collection.insertOne(studentData);
          results.success++;
        }

      } catch (error) {
        results.failed++;
        console.error(`Import error for row ${rowNum}:`, error.message);

        // Safely log data (prevent circular dependency/undefined errors)
        try {
          if (studentData) console.error('Student data payload:', JSON.stringify(studentData, null, 2));
        } catch (logErr) { console.error('Failed to log payload:', logErr.message); }

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

    res.json({
      success: true,
      message: `Import completed. Imported: ${results.success}, Replaced: ${results.replaced}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
      data: results
    });

  } catch (error) {
    console.error('Import execute error:', error);
    res.status(500).json({ success: false, message: 'Server error during import execution' });
  }
});

// @desc    Get student filters
// @route   GET /api/students/filters
// @access  Private
router.get('/filters', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Aggregation to get distinct values efficiently
    const [classes, sections, academicYears, drivers] = await Promise.all([
      User.distinct('class', { role: 'student', tenantId }),
      User.distinct('section', { role: 'student', tenantId }),
      User.distinct('academicYear', { role: 'student', tenantId }),
      Driver.find({ tenantId, isActive: true }).select('_id name').sort({ name: 1 })
    ]);

    // Sort values for better UI
    const sortAlphaNum = (a, b) => {
      return a.toString().localeCompare(b.toString(), undefined, { numeric: true, sensitivity: 'base' });
    };

    res.json({
      success: true,
      data: {
        classes: classes.filter(Boolean).sort(sortAlphaNum),
        sections: sections.filter(Boolean).sort(sortAlphaNum),
        academicYears: academicYears.filter(Boolean).sort().reverse(), // Newest first
        genders: ['Male', 'Female', 'Other'],
        drivers: drivers.map(d => ({ _id: d._id, name: d.name }))
      }
    });
  } catch (error) {
    console.error('Filter options error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Export students to CSV
// @route   GET /api/students/export
// @access  Private
router.get('/export', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Build filter (same as list route)
    const filter = { role: 'student', tenantId };

    if (req.user.role === 'teacher') {
      try {
        const legacyClasses = Array.isArray(req.user.assignedClasses) ? req.user.assignedClasses : [];
        const assignmentQuery = { teacherId: req.user._id, tenantId: req.user.tenantId, isActive: true };
        const assignments = await TeacherSubjectAssignment.find(assignmentQuery);

        const criteria = [];
        if (legacyClasses.length > 0) criteria.push({ class: { $in: legacyClasses } });

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
        console.error('Teacher export filter error:', err);
        if (!filter.$and) filter.$and = [];
        filter.$and.push({ _id: null });
      }
    }

    // Apply filters
    if (req.query.class) filter.class = req.query.class;
    if (req.query.section) filter.section = req.query.section;
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
      admissionDate: { label: 'Admission Date', extract: (s) => s.admissionDate ? new Date(s.admissionDate).toLocaleDateString() : '' },
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
      dob: { label: 'DOB', extract: (s) => s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '' },
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

    // ── CSV ─────────────────────────────────────────────────────────────────
    if (format === 'csv') {
      const csvQuote = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csvRows = [
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
      const wsData = [headerLabels, ...rawRows];
      const ws = xlsx.utils.aoa_to_sheet(wsData);

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
      const txtRows = [
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
        headerLabels.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      });
      return res.status(200).json({ success: true, headers: headerLabels, rows: rawRows, data: result });
    }

    res.status(400).json({ success: false, message: `Unsupported format: ${format}` });

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Server error during export' });
  }
});

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
router.get('/:id', protect, canAccessStudent, async (req, res) => {
  try {
    const student = await User.findById(req.params.id)
      .select('-password')
      .populate('subDepartment', 'name');

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Get fee details
    const fees = await Fee.find({ student: student._id }).sort({ dueDate: -1 });

    // Get fee summary
    const totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0);
    const paidFees = fees.filter(fee => fee.status === 'paid').reduce((sum, fee) => sum + fee.amount, 0);
    const pendingFees = fees.filter(fee => fee.status === 'pending').reduce((sum, fee) => sum + fee.amount, 0);
    const overdueFees = fees.filter(fee => fee.status === 'overdue').reduce((sum, fee) => sum + fee.amount, 0);

    // Format fees with currency
    const formattedFees = await Promise.all(
      fees.map(async (fee) => ({
        ...fee.toJSON(),
        formattedAmount: await formatCurrencyWithSettings(fee.amount, fee.currency)
      }))
    );

    res.json({
      success: true,
      data: {
        ...student.toJSON(),
        fees: formattedFees,
        feeSummary: {
          total: await formatCurrencyWithSettings(totalFees),
          paid: await formatCurrencyWithSettings(paidFees),
          pending: await formatCurrencyWithSettings(pendingFees),
          overdue: await formatCurrencyWithSettings(overdueFees)
        }
      }
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student'
    });
  }
});

// @desc    Create new student
// @route   POST /api/students
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), validateStudent, async (req, res) => {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(400).json({ success: false, message: 'User tenant not found.' });
    }

    const {
      fullName, firstName, middleName, lastName, email, phone, password,
      class: studentClass, section, academicYear, rollNumber, admissionDate,
      guardians, address, avatar,
      penNumber, subDepartment, udiseCode, // Legacy fields
      transportMode, driverId
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

    // Generate Admission Number (if not provided)
    let admissionNumber = req.body.admissionNumber ? req.body.admissionNumber.trim() : null;

    if (!admissionNumber) {
      const settings = await Settings.getSettings(tenantId);
      const { mode, prefix, yearFormat, counterPadding } = settings.admission;

      const currentYear = new Date().getFullYear().toString();
      const yearStr = yearFormat === 'YY' ? currentYear.substring(2) : currentYear;
      const effectivePrefix = mode === 'CUSTOM' ? (prefix || 'ADM') : 'ADM';

      const sequence = await Counter.getNextSequence('admission', currentYear, tenantId);
      admissionNumber = `${effectivePrefix}${yearStr}${String(sequence).padStart(counterPadding, '0')}`;
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
        console.error('Error looking up sectionId:', err);
        // Continue without sectionId - will save section string only
      }
    }

    const studentData = {
      fullName: fullName ? fullName.trim() : undefined,
      firstName: firstName ? firstName.trim() : undefined,
      middleName: middleName ? middleName.trim() : undefined,
      lastName: lastName ? lastName.trim() : undefined,
      email: email && email.trim() ? email.toLowerCase().trim() : undefined,
      password: (email && email.trim()) ? (password || 'student123') : undefined,
      role: 'student',
      tenantId,
      admissionNumber,
      class: studentClass,
      section,
      sectionId,  // Add sectionId
      academicYear,
      rollNumber,
      admissionDate: admissionDate || new Date(),
      guardians, address, avatar,
      penNumber: penNumber ? penNumber.trim() : undefined,
      subDepartment,
      udiseCode: udiseCode ? udiseCode.trim() : undefined,
      transportMode: finalTransportMode,
      driverId: finalDriverId
    };

    const student = await User.create(studentData);
    const plainPassword = password || 'student123';

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: {
        id: student._id,
        name: student.name, // Virtual or pre-saved full name
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        admissionNumber: student.admissionNumber,
        credentials: { email: student.email, password: plainPassword }
      }
    });

  } catch (error) {
    console.error('Create student error:', error);
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
  body('email').optional().trim().isEmail().withMessage('Please provide a valid email address'),
  body('phone').optional().custom((value) => {
    // Allow empty string or null
    if (!value || value.trim() === '') return true;
    // Basic phone validation - just check if it's numeric and reasonable length
    const cleaned = value.replace(/[\s\-\(\)]/g, '');
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
], async (req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
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
    if (req.body.rollNumber && req.body.class) {
      const existingRollNumber = await User.findOne({
        rollNumber: req.body.rollNumber?.trim(),
        class: req.body.class?.trim(),
        role: 'student',
        _id: { $ne: req.params.id }
      });
      if (existingRollNumber) {
        return res.status(400).json({
          success: false,
          message: 'Roll number already exists in this class'
        });
      }
    }

    // Update student
    const updatePayload = { ...req.body };
    if (updatePayload.password === '') {
      delete updatePayload.password;
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

    // Debug logging
    console.log('Updating student:', req.params.id);
    console.log('Update payload:', JSON.stringify(updatePayload, null, 2));

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
        console.error('Error looking up sectionId during update:', err);
        // Continue without sectionId - will save section string only
      }
    }

    const updatedStudent = await User.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      message: 'Student updated successfully',
      data: updatedStudent
    });
  } catch (error) {
    console.error('Update student error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
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

// @desc    Deactivate student (mark as inactive with removal details)
// @route   PUT /api/students/:id/deactivate
// @access  Private (Admin)
router.put('/:id/deactivate', protect, authorize('admin'), [
  body('removalDate').optional().isISO8601().withMessage('Invalid removal date'),
  body('removalReason').optional().isIn(['Graduated', 'Transferred', 'Withdrawn', 'Expelled', 'Other', '']).withMessage('Invalid removal reason'),
  body('removalNotes').optional().trim(),
  handleValidationErrors
], async (req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
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
    console.error('Deactivate student error:', error);
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
router.put('/:id/reactivate', protect, authorize('admin'), async (req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
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
    console.error('Reactivate student error:', error);
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
router.delete('/bulk-delete', protect, authorize('admin'), async (req, res) => {
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
    console.error('Bulk delete students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting students'
    });
  }
});

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Check if student has fees
    const hasFees = await Fee.exists({ student: req.params.id });
    if (hasFees) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete student with existing fees. Please clear all fees first.'
      });
    }

    // Delete student
    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Student deleted successfully'
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting student'
    });
  }
});

// @desc    Get student fees
// @route   GET /api/students/:id/fees
// @access  Private
router.get('/:id/fees', protect, canAccessStudent, async (req, res) => {
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
      fees.map(async (fee) => ({
        ...fee.toJSON(),
        formattedAmount: await formatCurrencyWithSettings(fee.amount, fee.currency)
      }))
    );

    res.json({
      success: true,
      data: formattedFees
    });
  } catch (error) {
    console.error('Get student fees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student fees'
    });
  }
});

// @desc    Get student statistics
// @route   GET /api/students/:id/statistics
// @access  Private
router.get('/:id/statistics', protect, canAccessStudent, async (req, res) => {
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
    console.error('Get student statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching student statistics'
    });
  }
});

// @desc    Get filter options (classes, sections, academic years)
// @route   GET /api/students/filters
// @access  Private (Admin, Teacher)
router.get('/filters', protect, authorize('admin', 'teacher'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    // Get unique classes - filter out null, undefined, and empty strings
    const classes = await User.distinct('class', {
      role: 'student',
      tenantId,
      class: { $exists: true, $ne: null, $ne: '' }
    });

    // Get unique sections - filter out null, undefined, and empty strings
    const sections = await User.distinct('section', {
      role: 'student',
      tenantId,
      section: { $exists: true, $ne: null, $ne: '' }
    });

    // Get unique academic years - filter out null, undefined, and empty strings
    const academicYears = await User.distinct('academicYear', {
      role: 'student',
      tenantId,
      academicYear: { $exists: true, $ne: null, $ne: '' }
    });

    // Get active drivers for this tenant
    const drivers = await Driver.find({ tenantId, isActive: true })
      .select('_id name')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: {
        classes: classes.filter(Boolean).sort(),
        sections: sections.filter(Boolean).sort(),
        academicYears: academicYears.filter(Boolean).sort().reverse(),
        drivers: drivers.map(d => ({ _id: d._id, name: d.name }))
      }
    });
  } catch (error) {
    console.error('Get filters error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching filters'
    });
  }
});


// @desc    Toggle student active/inactive status
// @route   PUT /api/students/:id/toggle-status
// @access  Private (Admin)
router.put('/:id/toggle-status', protect, authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
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
    console.error('Toggle status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while toggling student status'
    });
  }
});

// @desc    Reset student password
// @route   PUT /api/students/:id/reset-password
// @access  Private (Admin)
router.put('/:id/reset-password', protect, authorize('admin'), async (req, res) => {
  try {
    const { newPassword, forceChange } = req.body;
    const student = await User.findById(req.params.id);

    if (!student || student.role !== 'student') {
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
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting password'
    });
  }
});

// @desc    Bulk activate students
// @route   POST /api/students/bulk-activate
// @access  Private (Admin)
router.post('/bulk-activate', protect, authorize('admin'), async (req, res) => {
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
    console.error('Bulk activate error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while activating students'
    });
  }
});

// @desc    Bulk deactivate students
// @route   POST /api/students/bulk-deactivate
// @access  Private (Admin)
router.post('/bulk-deactivate', protect, authorize('admin'), async (req, res) => {
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
    console.error('Bulk deactivate error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deactivating students'
    });
  }
});


// @desc    Promote students to next class
// @route   POST /api/students/promote
// @access  Private (Admin)
router.post('/promote', protect, authorize('admin'), async (req, res) => {
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
    console.error('Promote students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while promoting students'
    });
  }
});

// ============================================================================
// IMPORT/EXPORT ROUTES (New Enhanced Version)
// ============================================================================

const { uploadSingleFile, deleteFile } = require('../middleware/fileUpload');
const StudentImportService = require('../services/studentImportService');
const ImportExportService = require('../services/importExportService');

// @desc    Download CSV template for student import
// @route   GET /api/students/import/template
// @access  Private (Admin)
router.get('/import/template', protect, authorize('admin'), async (req, res) => {
  try {
    const template = await StudentImportService.generateTemplate();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=student_import_template.csv');
    res.send(template);
  } catch (error) {
    console.error('Generate template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating template'
    });
  }
});

// @desc    Preview student import (validate without importing)
// @route   POST /api/students/import/preview
// @access  Private (Admin)
router.post('/import/preview', protect, authorize('admin'), (req, res) => {
  uploadSingleFile(req, res, async (err) => {
    try {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload error'
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload a CSV or Excel file'
        });
      }

      const result = await StudentImportService.previewImport(
        req.file.path,
        req.user.tenantId
      );

      // Store file path in session or temp storage for execute step
      // For now, we'll include it in the response
      result.uploadedFile = req.file.filename;

      res.json(result);
    } catch (error) {
      console.error('Preview import error:', error);

      // Clean up uploaded file
      if (req.file) {
        await deleteFile(req.file.path).catch(console.error);
      }

      res.status(500).json({
        success: false,
        message: error.message || 'Server error during import preview'
      });
    }
  });
});

// @desc    Execute student import
// @route   POST /api/students/import/execute
// @access  Private (Admin)
router.post('/import/execute', protect, authorize('admin'), async (req, res) => {
  try {
    const { validData, options } = req.body;

    if (!validData || !Array.isArray(validData) || validData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid data to import'
      });
    }

    const result = await StudentImportService.executeImport(
      validData,
      req.user.tenantId,
      options || {}
    );

    res.json({
      success: true,
      message: `Import completed. Created: ${result.created}, Failed: ${result.failed}`,
      data: result
    });
  } catch (error) {
    console.error('Execute import error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during import execution'
    });
  }
});

// @desc    Export students to CSV
// @route   GET /api/students/export
// @access  Private (Admin, Teacher)
router.get('/export', protect, authorize('admin', 'teacher'), async (req, res) => {
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

    if (req.query.section) {
      filter.section = req.query.section;
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
      { key: 'bloodGroup', header: 'Blood Group' },
      { key: 'address', header: 'Address' },
      { key: 'city', header: 'City' },
      { key: 'state', header: 'State' },
      { key: 'pincode', header: 'Pincode' },
      { key: 'isActive', header: 'Status', format: (val) => val ? 'Active' : 'Inactive' },
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
    console.error('Export students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting students'
    });
  }
});

// --- Class Promotion & Demotion Routes ---
const StudentClassHistory = require('../models/StudentClassHistory');
const classSequence = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const getNextClass = (currentClass) => {
  const index = classSequence.indexOf(currentClass);
  if (index === -1) return null; // Unknown class
  if (index === classSequence.length - 1) return 'GRADUATED';
  return classSequence[index + 1];
};

const getPrevClass = (currentClass) => {
  const index = classSequence.indexOf(currentClass);
  if (index === -1) return null;
  if (index === 0) return 'LOWEST';
  return classSequence[index - 1];
};

// @desc    Get bulk promotion/demotion history for reports
// @route   GET /api/students/promotions/report
// @access  Private (Admin)
router.get('/promotions/report', protect, authorize('admin', 'principal'), async (req, res) => {
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
    console.error('Get promotions report error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching promotion report' });
  }
});

// @desc    Get student class history
// @route   GET /api/students/:id/class-history
// @access  Private
router.get('/:id/class-history', protect, authorize('admin', 'teacher'), async (req, res) => {
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
    console.error('Get class history error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching class history' });
  }
});

// @desc    Promote individual student
// @route   POST /api/students/:id/promote
// @access  Private (Admin)
router.post('/:id/promote', protect, authorize('admin', 'principal'), async (req, res) => {
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

    const history = await StudentClassHistory.create({
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
    console.error('Promote student error:', error);
    res.status(500).json({ success: false, message: 'Server error during promotion' });
  }
});

// @desc    Demote individual student
// @route   POST /api/students/:id/demote
// @access  Private (Admin)
router.post('/:id/demote', protect, authorize('admin', 'principal'), async (req, res) => {
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
    console.error('Demote student error:', error);
    res.status(500).json({ success: false, message: 'Server error during demotion' });
  }
});

// @desc    Bulk Promote/Demote Operations
// @route   POST /api/students/bulk-class-action
// @access  Private (Admin)
router.post('/bulk-class-action', protect, authorize('admin', 'principal'), async (req, res) => {
  try {
    const { studentIds, actionType, toClass, toSection, academicYear, remarks, forceOverride } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No students selected' });
    }

    const students = await User.find({
      _id: { $in: studentIds },
      tenantId: req.user.tenantId,
      role: 'student'
    });

    const classDoc = await Class.findOne({ grade: toClass, tenantId: req.user.tenantId });

    let successCount = 0;
    let errors = [];

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
      } catch (err) {
        errors.push(`Failed for ${student.name || student.fullName}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Successfully ${actionType} ${successCount} students.`,
      successCount,
      errors
    });
  } catch (error) {
    console.error('Bulk class action error:', error);
    res.status(500).json({ success: false, message: 'Server error during bulk operation' });
  }
});

module.exports = router;

