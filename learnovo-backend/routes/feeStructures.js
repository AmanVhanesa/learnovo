const express = require('express');
const router = express.Router();
const FeeStructure = require('../models/FeeStructure');
const Class = require('../models/Class');
const { protect, authorize } = require('../middleware/auth');

// @desc    Get all fee structures
// @route   GET /api/fee-structures
// @access  Private (Admin, Accountant)
router.get('/', protect, authorize('admin', 'accountant'), async (req, res) => {
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
        console.error('Get fee structures error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching fee structures'
        });
    }
});

// @desc    Get single fee structure
// @route   GET /api/fee-structures/:id
// @access  Private (Admin, Accountant)
router.get('/:id', protect, authorize('admin', 'accountant'), async (req, res) => {
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
        console.error('Get fee structure error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching fee structure'
        });
    }
});

// @desc    Create fee structure
// @route   POST /api/fee-structures
// @access  Private (Admin only)
router.post('/', protect, authorize('admin'), async (req, res) => {
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
        console.error('Create fee structure error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while creating fee structure'
        });
    }
});

// @desc    Update fee structure
// @route   PUT /api/fee-structures/:id
// @access  Private (Admin only)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { classId, sectionId, feeHeads, lateFeeConfig, isActive } = req.body;

        let feeStructure = await FeeStructure.findOne({
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
        console.error('Update fee structure error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while updating fee structure'
        });
    }
});

// @desc    Delete fee structure
// @route   DELETE /api/fee-structures/:id
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
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
        console.error('Delete fee structure error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting fee structure'
        });
    }
});

module.exports = router;
