const express = require('express');
const router = express.Router();
const FeeStructure = require('../models/FeeStructure');
const Class = require('../models/Class');
const { protect, authorize } = require('../middleware/auth');
const planGate = require('../middleware/planGate');
const ImportExportService = require('../services/importExportService');

// All fee structure routes require fees/finance feature (Basic+)
router.use(planGate.requireActiveSubscription);
router.use(planGate.checkFeesAndFinance);

// @desc    Export fee structures as CSV
// @route   GET /api/fee-structures/export
// @access  Private (Admin, Accountant)
router.get('/export', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const filter = { tenantId: req.user.tenantId };
    if (req.query.academicSessionId) filter.academicSessionId = req.query.academicSessionId;
    if (req.query.classId) filter.classId = req.query.classId;

    const feeStructures = await FeeStructure.find(filter)
      .populate('classId', 'name grade')
      .populate('sectionId', 'name')
      .populate('academicSessionId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    // Flatten fee heads into one row per fee head
    const rows = [];
    for (const fs of feeStructures) {
      const className = fs.classId?.name || '';
      const sectionName = fs.sectionId?.name || 'All Sections';
      const sessionName = fs.academicSessionId?.name || '';
      const status = fs.isActive ? 'Active' : 'Inactive';
      const lateFee = fs.lateFeeConfig?.enabled ? `${fs.lateFeeConfig.type === 'percentage' ? fs.lateFeeConfig.amount + '%' : fs.lateFeeConfig.amount} after ${fs.lateFeeConfig.gracePeriodDays} days` : 'Disabled';

      if (fs.feeHeads && fs.feeHeads.length > 0) {
        for (const head of fs.feeHeads) {
          rows.push({
            className,
            sectionName,
            sessionName,
            feeHeadName: head.name || '',
            type: head.type || '',
            annualAmount: head.annualAmount || head.amount || 0,
            isOptional: head.isOptional ? 'Yes' : 'No',
            isAdmissionFee: head.isAdmissionFee ? 'Yes' : 'No',
            lateFee,
            status
          });
        }
      } else {
        rows.push({ className, sectionName, sessionName, feeHeadName: '', type: '', annualAmount: 0, isOptional: '', isAdmissionFee: '', lateFee, status });
      }
    }

    const columns = [
      { key: 'className', header: 'Class' },
      { key: 'sectionName', header: 'Section' },
      { key: 'sessionName', header: 'Academic Session' },
      { key: 'feeHeadName', header: 'Fee Head' },
      { key: 'type', header: 'Type' },
      { key: 'annualAmount', header: 'Annual Amount' },
      { key: 'isOptional', header: 'Optional' },
      { key: 'isAdmissionFee', header: 'Admission Fee' },
      { key: 'lateFee', header: 'Late Fee' },
      { key: 'status', header: 'Status' }
    ];

    const csvBuffer = await ImportExportService.exportToCSV(rows, columns);
    const filename = `fee_structures_export_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvBuffer);
  } catch (error) {
    console.error('Export fee structures error:', error);
    res.status(500).json({ success: false, message: 'Server error while exporting fee structures' });
  }
});

// @desc    Get all fee structures
// @route   GET /api/fee-structures
// @access  Private (Admin, Accountant)
router.get('/', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const { academicSessionId, classId, isActive } = req.query;

    const filter = { tenantId: req.user.tenantId };

    if (academicSessionId) filter.academicSessionId = academicSessionId;
    if (classId) filter.classId = classId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const feeStructures = await FeeStructure.find(filter)
      .populate('classId', 'name grade')
      .populate('sectionId', 'name')
      .populate('academicSessionId', 'name')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: feeStructures
    });
  } catch (error) {
    // Error handled by response below
    res.status(500).json({
      success: false,
      message: 'Server error while fetching fee structures'
    });
  }
});

// @desc    Get single fee structure
// @route   GET /api/fee-structures/:id
// @access  Private (Admin, Accountant)
router.get('/:id', protect, authorize('admin', 'accountant'), async(req, res) => {
  try {
    const feeStructure = await FeeStructure.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    })
      .populate('classId', 'name grade')
      .populate('sectionId', 'name')
      .populate('academicSessionId', 'name')
      .populate('createdBy', 'name');

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    res.json({
      success: true,
      data: feeStructure
    });
  } catch (error) {
    // Error handled by response below
    res.status(500).json({
      success: false,
      message: 'Server error while fetching fee structure'
    });
  }
});

// @desc    Create fee structure
// @route   POST /api/fee-structures
// @access  Private (Admin only)
router.post('/', protect, authorize('admin'), async(req, res) => {
  try {
    const { classId, sectionId, academicSessionId, feeHeads, lateFeeConfig, isActive } = req.body;

    // Validate class exists
    const classExists = await Class.findOne({
      _id: classId,
      tenantId: req.user.tenantId
    });

    if (!classExists) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }

    // Validate fee heads
    if (!feeHeads || !Array.isArray(feeHeads) || feeHeads.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one fee head is required'
      });
    }

    // Normalize fee heads: set annualAmount, type, and backward-compat fields
    feeHeads.forEach(head => {
      // Auto-detect admission fee by name
      if (!head.isAdmissionFee && head.name && head.name.toLowerCase().trim() === 'admission fee') {
        head.isAdmissionFee = true;
      }

      // Determine type: admission fees and explicit one-time are 'one_time', everything else is 'recurring'
      if (head.isAdmissionFee || head.type === 'one_time') {
        head.type = 'one_time';
        head.frequency = 'one-time'; // backward compat
      } else {
        head.type = head.type || 'recurring';
        head.frequency = 'yearly'; // deprecated — all amounts are now annual
      }

      // Set annualAmount: prefer explicit annualAmount, fall back to amount
      // The frontend now sends the annual amount in the 'amount' field (label says "Annual Amount")
      head.annualAmount = Number(head.annualAmount || head.amount || 0);
      head.amount = head.annualAmount; // Keep backward compat: amount = annualAmount
    });

    // Check for duplicate fee structure
    const existingStructure = await FeeStructure.findOne({
      tenantId: req.user.tenantId,
      classId,
      sectionId: sectionId || null,
      academicSessionId,
      isActive: true
    });

    if (existingStructure) {
      return res.status(400).json({
        success: false,
        message: 'An active fee structure already exists for this class/section'
      });
    }

    // Create fee structure
    const feeStructure = await FeeStructure.create({
      tenantId: req.user.tenantId,
      classId,
      sectionId,
      academicSessionId,
      feeHeads,
      lateFeeConfig,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });

    await feeStructure.populate('classId', 'name grade');
    await feeStructure.populate('sectionId', 'name');
    await feeStructure.populate('academicSessionId', 'name');

    res.status(201).json({
      success: true,
      message: 'Fee structure created successfully',
      data: feeStructure
    });
  } catch (error) {
    // Error handled by response below
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating fee structure'
    });
  }
});

// @desc    Update fee structure
// @route   PUT /api/fee-structures/:id
// @access  Private (Admin only)
router.put('/:id', protect, authorize('admin'), async(req, res) => {
  try {
    const { classId, sectionId, feeHeads, lateFeeConfig, isActive } = req.body;

    const feeStructure = await FeeStructure.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    // Validate fee heads if provided
    if (feeHeads && (!Array.isArray(feeHeads) || feeHeads.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'At least one fee head is required'
      });
    }

    // Normalize fee heads: set annualAmount, type, and backward-compat fields
    if (feeHeads) {
      feeHeads.forEach(head => {
        if (!head.isAdmissionFee && head.name && head.name.toLowerCase().trim() === 'admission fee') {
          head.isAdmissionFee = true;
        }

        if (head.isAdmissionFee || head.type === 'one_time') {
          head.type = 'one_time';
          head.frequency = 'one-time';
        } else {
          head.type = head.type || 'recurring';
          head.frequency = 'yearly';
        }

        head.annualAmount = Number(head.annualAmount || head.amount || 0);
        head.amount = head.annualAmount;
      });
    }

    // Update fields
    if (classId) feeStructure.classId = classId;
    if (sectionId !== undefined) feeStructure.sectionId = sectionId;
    if (feeHeads) feeStructure.feeHeads = feeHeads;
    if (lateFeeConfig) feeStructure.lateFeeConfig = lateFeeConfig;
    if (isActive !== undefined) feeStructure.isActive = isActive;

    await feeStructure.save();

    await feeStructure.populate('classId', 'name grade');
    await feeStructure.populate('sectionId', 'name');
    await feeStructure.populate('academicSessionId', 'name');

    res.json({
      success: true,
      message: 'Fee structure updated successfully',
      data: feeStructure
    });
  } catch (error) {
    // Error handled by response below
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating fee structure'
    });
  }
});

// @desc    Delete fee structure
// @route   DELETE /api/fee-structures/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), async(req, res) => {
  try {
    const feeStructure = await FeeStructure.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });

    if (!feeStructure) {
      return res.status(404).json({
        success: false,
        message: 'Fee structure not found'
      });
    }

    // Check if any invoices have been generated using this structure
    const FeeInvoice = require('../models/FeeInvoice');
    const invoiceCount = await FeeInvoice.countDocuments({
      feeStructureId: feeStructure._id
    });

    if (invoiceCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete fee structure. ${invoiceCount} invoice(s) have been generated using this structure. Consider deactivating it instead.`
      });
    }

    await feeStructure.deleteOne();

    res.json({
      success: true,
      message: 'Fee structure deleted successfully'
    });
  } catch (error) {
    // Error handled by response below
    res.status(500).json({
      success: false,
      message: 'Server error while deleting fee structure'
    });
  }
});

module.exports = router;
