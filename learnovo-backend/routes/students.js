const express = require('express');
const { body, query } = require('express-validator');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Counter = require('../models/Counter');
const { protect, authorize, canAccessStudent } = require('../middleware/auth');
const { handleValidationErrors, validateStudent } = require('../middleware/validation');
const Settings = require('../models/Settings'); // Import Settings model
const { formatCurrencyWithSettings } = require('../utils/currency');
const upload = require('../middleware/upload');
const { parseCSV } = require('../utils/csvHandler');
const fs = require('fs');

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
    if (req.user.role === 'teacher' && req.user.assignedClasses) {
      filter.class = { $in: req.user.assignedClasses };
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
        { admissionNumber: { $regex: req.query.search, $options: 'i' } },
        { rollNumber: { $regex: req.query.search, $options: 'i' } },
        { studentId: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Get students
    const students = await User.find(filter)
      .select('-password')
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

// @desc    Bulk import students from CSV
// @route   POST /api/students/import
// @access  Private (Admin)
router.post('/import', protect, authorize('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
    }

    const rows = await parseCSV(req.file.path);
    const results = { success: 0, failed: 0, errors: [] };

    if (!rows || rows.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'CSV file is empty' });
    }

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        // 1. Basic Validation
        if (!row.firstName || !row.lastName || !row.email) {
          throw new Error('First Name, Last Name, and Email are required');
        }

        const email = row.email.toLowerCase().trim();
        const tenantId = req.user.tenantId;

        // 2. Check duplicates (DB)
        const existingStudent = await User.findOne({ email, tenantId });
        if (existingStudent) {
          throw new Error(`Student with email ${email} already exists`);
        }

        // 3. Generate Admission Number (only if not provided)
        let admissionNumber = row.admissionNumber ? row.admissionNumber.toString().trim() : null;

        if (!admissionNumber) {
          const settings = await Settings.getSettings(tenantId);
          const { mode, prefix, yearFormat, counterPadding, startFrom } = settings.admission;

          const currentYear = new Date().getFullYear().toString();
          const yearStr = yearFormat === 'YY' ? currentYear.substring(2) : currentYear;
          const effectivePrefix = mode === 'CUSTOM' ? (prefix || 'ADM') : 'ADM';

          // Use tenant-specific counter
          const sequence = await Counter.getNextSequence('admission', currentYear, tenantId);
          const finalSequence = sequence + (startFrom - 1); // Adjust for startFrom if needed (basic implementation uses raw sequence usually, but let's stick to sequence)

          admissionNumber = `${effectivePrefix}${yearStr}${String(sequence).padStart(counterPadding, '0')}`;
        }

        // 4. Prepare Guardians
        const guardians = [];
        if (row.fatherName) guardians.push({ relation: 'Father', name: row.fatherName, phone: row.fatherPhone, email: row.fatherEmail, isPrimary: true });
        if (row.motherName) guardians.push({ relation: 'Mother', name: row.motherName, phone: row.motherPhone, email: row.motherEmail });

        // Fallback for old CSV format
        if (guardians.length === 0 && row.guardianName) {
          guardians.push({ relation: 'Guardian', name: row.guardianName, phone: row.guardianPhone, isPrimary: true });
        }

        // 5. Construct Data
        const studentData = {
          firstName: row.firstName.trim(),
          middleName: row.middleName ? row.middleName.trim() : undefined,
          lastName: row.lastName.trim(),
          email: email,
          password: row.password || 'student123',
          role: 'student',
          tenantId: tenantId,
          admissionNumber,
          class: row.class ? row.class.trim() : undefined,
          section: row.section ? row.section.trim() : undefined,
          academicYear: row.academicYear || `${currentYear}-${parseInt(currentYear) + 1}`, // Default to current-next
          rollNumber: row.rollNumber ? row.rollNumber.trim() : undefined,
          phone: row.phone ? row.phone.trim() : undefined,
          address: row.address ? row.address.trim() : undefined,
          admissionDate: row.admissionDate ? new Date(row.admissionDate) : new Date(),
          guardians
        };

        await User.create(studentData);
        results.success++;

      } catch (error) {
        // console.error(`Row ${rowNum} Error:`, error.message);
        results.failed++;
        results.errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }

    fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      message: `Import completed. Success: ${results.success}, Failed: ${results.failed}`,
      data: results
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, message: 'Server error during import' });
  }
});

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
router.get('/:id', protect, canAccessStudent, async (req, res) => {
  try {
    const student = await User.findById(req.params.id).select('-password');

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
      firstName, middleName, lastName, email, phone, password,
      class: studentClass, section, academicYear, rollNumber, admissionDate,
      guardians, address, avatar
    } = req.body;

    const tenantId = req.user.tenantId;

    // Check email uniqueness within tenant
    if (await User.findOne({ email: email.toLowerCase().trim(), tenantId })) {
      return res.status(400).json({ success: false, message: 'Student with this email already exists' });
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
      firstName, middleName, lastName, email: email.toLowerCase().trim(),
      password, role: 'student', tenantId,
      admissionNumber,
      class: studentClass, section, academicYear, rollNumber,
      admissionDate: admissionDate || new Date(),
      guardians, address, avatar
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
  body('phone').optional().isMobilePhone().withMessage('Please provide a valid phone number'),
  body('class').optional().trim().notEmpty().withMessage('Class cannot be empty'),
  body('rollNumber').optional().trim().notEmpty().withMessage('Roll number cannot be empty'),
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
    res.status(500).json({
      success: false,
      message: 'Server error while updating student'
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

    // Get unique classes
    const classes = await User.distinct('class', { role: 'student', tenantId, class: { $ne: null } });

    // Get unique sections
    const sections = await User.distinct('section', { role: 'student', tenantId, section: { $ne: null } });

    // Get unique academic years
    const academicYears = await User.distinct('academicYear', { role: 'student', tenantId, academicYear: { $ne: null } });

    res.json({
      success: true,
      data: {
        classes: classes.sort(),
        sections: sections.sort(),
        academicYears: academicYears.sort().reverse()
      }
    });
  } catch (error) {
    console.error('Get filters error:', error);
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

    // Generate CSV
    const csvBuffer = await ImportExportService.exportToCSV(students, columns);

    const filename = `students_export_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvBuffer);
  } catch (error) {
    console.error('Export students error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting students'
    });
  }
});

module.exports = router;

