const express = require('express');
const router = express.Router();
const SubDepartment = require('../models/SubDepartment');
const { protect, authorize } = require('../middleware/auth');
const { logger } = require('../middleware/errorHandler');

// @desc    Get all active sub-departments (dropdown list)
// @route   GET /api/sub-departments
// @access  Private (Teacher, Admin)
router.get('/', protect, async (req, res) => {
    try {
        const filter = { tenantId: req.user.tenantId };

        // If querying for dropdown (active only), allow filtering
        if (req.query.active === 'true') {
            filter.isActive = true;
        }

        const subDepartments = await SubDepartment.find(filter)
            .sort({ name: 1 })
            .lean();

        res.json({
            success: true,
            count: subDepartments.length,
            data: subDepartments
        });
    } catch (error) {
        logger.error('Error fetching sub-departments', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Create a new sub-department
// @route   POST /api/sub-departments
// @access  Private (Admin)
router.post('/', protect, authorize('admin'), async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Please provide a name' });
        }

        const subDepartment = await SubDepartment.create({
            tenantId: req.user.tenantId,
            name,
            description
        });

        res.status(201).json({
            success: true,
            data: subDepartment
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Sub-department already exists' });
        }
        logger.error('Error creating sub-department', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Update sub-department
// @route   PUT /api/sub-departments/:id
// @access  Private (Admin)
router.put('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const { name, description } = req.body;

        let subDepartment = await SubDepartment.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!subDepartment) {
            return res.status(404).json({ success: false, message: 'Sub-department not found' });
        }

        subDepartment.name = name || subDepartment.name;
        subDepartment.description = description !== undefined ? description : subDepartment.description;

        await subDepartment.save();

        res.json({
            success: true,
            data: subDepartment
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Sub-department name already exists' });
        }
        logger.error('Error updating sub-department', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Toggle active status (disable/enable)
// @route   PATCH /api/sub-departments/:id/toggle-status
// @access  Private (Admin)
router.patch('/:id/toggle-status', protect, authorize('admin'), async (req, res) => {
    try {
        const subDepartment = await SubDepartment.findOne({
            _id: req.params.id,
            tenantId: req.user.tenantId
        });

        if (!subDepartment) {
            return res.status(404).json({ success: false, message: 'Sub-department not found' });
        }

        subDepartment.isActive = !subDepartment.isActive;
        await subDepartment.save();

        res.json({
            success: true,
            data: subDepartment
        });
    } catch (error) {
        logger.error('Error toggling status', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
