const express = require('express');
const { body, query } = require('express-validator');
const Admission = require('../models/Admission');
const { protect, authorize } = require('../middleware/auth');
const { handleValidationErrors, validateAdmission } = require('../middleware/validation');
const ImportExportService = require('../services/importExportService');

const router = express.Router();

// @desc    Export admissions as CSV
// @route   GET /api/admissions/export
// @access  Private (Admin)
router.get('/export', protect, authorize('admin'), async(req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    if (req.query.status) filter.status = req.query.status;

    const admissions = await Admission.find(filter).sort({ createdAt: -1 }).lean();

    const columns = [
      { key: 'applicationNumber', header: 'Application Number' },
      { key: 'personalInfo', header: 'First Name', format: (val) => val?.firstName || '' },
      { key: 'personalInfo', header: 'Last Name', format: (val) => val?.lastName || '' },
      { key: 'personalInfo', header: 'Date of Birth', format: (val) => val?.dateOfBirth ? new Date(val.dateOfBirth).toLocaleDateString() : '' },
      { key: 'personalInfo', header: 'Gender', format: (val) => val?.gender || '' },
      { key: 'contactInfo', header: 'Email', format: (val) => val?.email || '' },
      { key: 'contactInfo', header: 'Phone', format: (val) => val?.phone || '' },
      { key: 'contactInfo', header: 'City', format: (val) => val?.address?.city || '' },
      { key: 'contactInfo', header: 'State', format: (val) => val?.address?.state || '' },
      { key: 'guardianInfo', header: 'Father Name', format: (val) => val?.fatherName || '' },
      { key: 'guardianInfo', header: 'Mother Name', format: (val) => val?.motherName || '' },
      { key: 'guardianInfo', header: 'Father Phone', format: (val) => val?.fatherPhone || '' },
      { key: 'academicInfo', header: 'Class Applied', format: (val) => val?.classApplied || '' },
      { key: 'academicInfo', header: 'Previous School', format: (val) => val?.previousSchool || '' },
      { key: 'status', header: 'Status' },
      { key: 'createdAt', header: 'Applied On', format: (val) => val ? new Date(val).toLocaleDateString() : '' }
    ];

    const headerInfo = await ImportExportService.getExportHeaderInfo(req.user.tenantId, 'Admissions List');
    const csvBuffer = await ImportExportService.exportToCSV(admissions, columns, headerInfo);
    const filename = `admissions_export_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvBuffer);
  } catch (error) {
    console.error('Export admissions error:', error);
    res.status(500).json({ success: false, message: 'Server error while exporting admissions' });
  }
});

// @desc    Get all admissions
// @route   GET /api/admissions
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['pending', 'under_review', 'approved', 'rejected', 'waitlisted']).withMessage('Invalid status'),
  handleValidationErrors
], async(req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const admissions = await Admission.find(filter)
      .populate('student', 'name email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Admission.countDocuments(filter);

    res.json({
      success: true,
      data: admissions,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get admissions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching admissions'
    });
  }
});

// @desc    Create admission application
// @route   POST /api/admissions
// @access  Public
router.post('/', validateAdmission, async(req, res) => {
  try {
    const admission = await Admission.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Admission application submitted successfully',
      data: {
        applicationNumber: admission.applicationNumber,
        status: admission.status
      }
    });
  } catch (error) {
    console.error('Create admission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating admission application'
    });
  }
});

// @desc    Approve admission
// @route   PUT /api/admissions/:id/approve
// @access  Private (Admin)
router.put('/:id/approve', protect, authorize('admin'), [
  body('comments').optional().trim().isLength({ max: 500 }).withMessage('Comments must be less than 500 characters'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { comments } = req.body;

    const admission = await Admission.findById(req.params.id);
    if (!admission) {
      return res.status(404).json({
        success: false,
        message: 'Admission application not found'
      });
    }

    await admission.approve(req.user._id, comments);

    res.json({
      success: true,
      message: 'Admission approved successfully',
      data: admission
    });
  } catch (error) {
    console.error('Approve admission error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while approving admission'
    });
  }
});

// @desc    Reject admission
// @route   PUT /api/admissions/:id/reject
// @access  Private (Admin)
router.put('/:id/reject', protect, authorize('admin'), [
  body('reason').trim().isLength({ min: 2, max: 200 }).withMessage('Reason must be between 2 and 200 characters'),
  body('comments').optional().trim().isLength({ max: 500 }).withMessage('Comments must be less than 500 characters'),
  handleValidationErrors
], async(req, res) => {
  try {
    const { reason, comments } = req.body;
    const admission = await Admission.findById(req.params.id);
    if (!admission) {
      return res.status(404).json({ success: false, message: 'Admission application not found' });
    }
    await admission.reject(req.user._id, reason, comments);
    res.json({ success: true, message: 'Admission rejected successfully', data: admission });
  } catch (error) {
    console.error('Reject admission error:', error);
    res.status(500).json({ success: false, message: 'Server error while rejecting admission' });
  }
});

module.exports = router;
