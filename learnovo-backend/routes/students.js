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
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
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
      filter.section = req.query.section;
    }

    // Add academic year filter
    if (req.query.academicYear) {
      filter.academicYear = req.query.academicYear;
    }

    // Add status filter (active/inactive)
    if (req.query.status) {
      filter.isActive = req.query.status === 'active';
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

      // Column name mappings (CSV column -> expected field name)
      const columnMappings = {
        'name': 'fullName',
        'student_name': 'fullName',
        'studentname': 'fullName',
        'admno': 'admissionNumber',
        'admission_no': 'admissionNumber',
        'admission_number': 'admissionNumber',
        'rollno': 'rollNumber',
        'roll_no': 'rollNumber',
        'roll_number': 'rollNumber',
        'dob': 'dateOfBirth',
        'date_of_birth': 'dateOfBirth',
        'father_name': 'fatherName',
        'father_phone': 'fatherPhone',
        'father_email': 'fatherEmail',
        'mother_name': 'motherName',
        'mother_phone': 'motherPhone',
        'mother_email': 'motherEmail',
        'guardian_name': 'guardianName',
        'guardian_phone': 'guardianPhone',
        'blood_group': 'bloodGroup',
        'sub_department': 'subDepartment',
        'subdepartment': 'subDepartment',
        'pen_number': 'penNumber',
        'academic_year': 'academicYear',
        'admission_date': 'admissionDate',
        'driver': 'driverName',
        'driver_name': 'driverName',
        'drivername': 'driverName'
      };

      // Normalize each field
      for (const [key, value] of Object.entries(row)) {
        const lowerKey = String(key || '').toLowerCase().trim();
        const mappedKey = columnMappings[lowerKey] || key;
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

    // Extract skipDuplicates option (default: false)
    const skipDuplicates = options?.skipDuplicates || false;

    // If skipDuplicates is enabled, filter out students with existing admission numbers
    let dataToImport = validData;
    let skippedCount = 0;

    if (skipDuplicates) {
      // Get existing admission numbers
      const existingAdmissionNumbers = new Set();
      const existingStudents = await User.find({
        tenantId,
        role: 'student'
      }).select('admissionNumber');

      existingStudents.forEach(s => {
        if (s.admissionNumber && s.admissionNumber.trim()) {
          existingAdmissionNumbers.add(s.admissionNumber.toUpperCase());
        }
      });

      // Filter out duplicates
      dataToImport = validData.filter(row => {
        if (row.admissionNumber) {
          const admNo = row.admissionNumber.toString().trim().toUpperCase();
          if (existingAdmissionNumbers.has(admNo)) {
            skippedCount++;
            return false; // Skip this student
          }
        }
        return true; // Import this student
      });

      console.log(`Skip duplicates enabled: ${skippedCount} students will be skipped`);
    }

    const results = { success: 0, failed: 0, skipped: skippedCount, errors: [] };

    for (const row of dataToImport) {
      let studentData = null; // Declare safely for error logging scope
      const rowNum = row._rowNumber || '?';

      try {
        // Log the first row to see data structure
        if (rowNum === 2 || rowNum === '?') {
          console.log('=== FIRST ROW DATA ===');
          console.log('Row keys:', Object.keys(row));
          console.log('Row data:', JSON.stringify(row, null, 2));
          console.log('======================');
        }

        // Double check duplicates (race condition protection) - only if email provided
        if (row.email && row.email.trim()) {
          const email = row.email.toLowerCase().trim();
          const existingStudent = await User.findOne({ email, tenantId });
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

        // Prepare Guardians
        const guardians = [];
        if (row.fatherName) guardians.push({ relation: 'Father', name: row.fatherName, phone: row.fatherPhone, email: row.fatherEmail, isPrimary: true });
        if (row.motherName) guardians.push({ relation: 'Mother', name: row.motherName, phone: row.motherPhone, email: row.motherEmail });

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

        // Handle Driver Assignment
        let driverId = undefined;
        let transportMode = '';

        if (row.driverName) {
          const driverName = row.driverName.toString().trim();

          if (driverName.toLowerCase() === 'self') {
            transportMode = 'Self';
          } else {
            // Case insensitive search for driver
            const driver = await Driver.findOne({
              tenantId,
              name: { $regex: new RegExp(`^${driverName}$`, 'i') },
              isActive: true
            });

            if (driver) {
              driverId = driver._id;
              transportMode = 'School Transport';
            } else {
              console.warn(`Driver not found for import: ${driverName}`);
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
        // Normalize class value to handle variations like "Class 1", "class 1", "1"
        if (row.class && row.class.trim()) {
          let classValue = row.class.trim();
          // Extract number from "Class X" format
          const classMatch = classValue.match(/class\s*(\d+|nursery|lkg|ukg)/i);
          if (classMatch) {
            const extracted = classMatch[1].toLowerCase();
            if (extracted === 'nursery' || extracted === 'lkg' || extracted === 'ukg') {
              classValue = extracted.charAt(0).toUpperCase() + extracted.slice(1);
            } else {
              classValue = extracted;
            }
          }
          studentData.class = classValue;
        }
        if (row.section && row.section.trim()) {
          studentData.section = row.section.trim();
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

        // Use insertOne to bypass Mongoose validation (more lenient)
        await User.collection.insertOne(studentData);
        results.success++;

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
      message: `Import completed. Success: ${results.success}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
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
    const [classes, sections, academicYears] = await Promise.all([
      User.distinct('class', { role: 'student', tenantId }),
      User.distinct('section', { role: 'student', tenantId }),
      User.distinct('academicYear', { role: 'student', tenantId })
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
        genders: ['Male', 'Female', 'Other']
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
    if (req.query.class) filter.class = req.query.class;
    if (req.query.section) filter.section = req.query.section;
    if (req.query.academicYear) filter.academicYear = req.query.academicYear;
    if (req.query.status) filter.isActive = req.query.status === 'active';
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

    // Generate CSV
    const headers = [
      'Admission No', 'Name', 'Class', 'Section', 'Roll No',
      'Father Name', 'Mother Name', 'Mobile', 'Alt Mobile', 'Email',
      'DOB', 'Gender', 'Address', 'Driver', 'Driver Phone', 'Sub Department', 'Status'
    ];

    const csvRows = [headers.join(',')];

    students.forEach(student => {
      const guardian = student.guardians?.[0] || {};
      const mother = student.guardians?.find(g => g.relation === 'Mother') || {};

      const row = [
        student.admissionNumber || '',
        `"${student.fullName}"`,
        student.class || '',
        student.section || '',
        student.rollNumber || '',
        `"${student.fatherOrHusbandName || guardian.name || ''}"`,
        `"${mother.name || ''}"`,
        student.phone || '',
        guardian.phone || '', // Alt mobile
        student.email || '',
        student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : '',
        student.gender || '',
        `"${(student.address || '').replace(/"/g, '""')}"`,
        student.driverId?.name || '',
        student.driverId?.phone || '',
        student.subDepartment?.name || '',
        student.isActive ? 'Active' : 'Inactive'
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=students_export_${new Date().toISOString().split('T')[0]}.csv`);
    res.status(200).send(csvContent);

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
      class: studentClass, section, academicYear, rollNumber,
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

    res.json({
      success: true,
      data: {
        classes: classes.filter(Boolean).sort(),
        sections: sections.filter(Boolean).sort(),
        academicYears: academicYears.filter(Boolean).sort().reverse()
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

module.exports = router;

