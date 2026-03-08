const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const SuperAdmin = require('../models/SuperAdmin');
const { logger } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @route   POST /api/super-admin/auth/login
 * @desc    Super admin login — returns JWT signed with SUPER_ADMIN_JWT_SECRET
 * @access  Public
 */
router.post('/login', [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
    try {
        // Validate request body
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array(),
                requestId: req.requestId
            });
        }

        const { email, password } = req.body;

        // Find super admin by email (include password for comparison)
        const superAdmin = await SuperAdmin.findOne({ email: email.toLowerCase() }).select('+password');

        if (!superAdmin) {
            logger.warn('Super admin login attempt with unknown email', {
                requestId: req.requestId,
                email
            });
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.',
                requestId: req.requestId
            });
        }

        if (!superAdmin.isActive) {
            return res.status(403).json({
                success: false,
                message: 'Super admin account has been deactivated.',
                requestId: req.requestId
            });
        }

        // Compare password
        const isMatch = await superAdmin.comparePassword(password);
        if (!isMatch) {
            logger.warn('Super admin login failed — wrong password', {
                requestId: req.requestId,
                superAdminId: superAdmin._id,
                email
            });
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.',
                requestId: req.requestId
            });
        }

        // Sign JWT with dedicated SUPER_ADMIN_JWT_SECRET
        const secret = process.env.SUPER_ADMIN_JWT_SECRET || 'super-admin-secret-key-change-in-production';
        const token = jwt.sign(
            {
                id: superAdmin._id,
                role: 'superadmin',
                email: superAdmin.email
            },
            secret,
            { expiresIn: '24h' }
        );

        // Update last login (non-blocking)
        SuperAdmin.findByIdAndUpdate(superAdmin._id, { lastLogin: new Date() }).catch(() => { });

        logger.info('Super admin logged in', {
            requestId: req.requestId,
            superAdminId: superAdmin._id,
            email: superAdmin.email
        });

        return res.status(200).json({
            success: true,
            message: 'Login successful.',
            token,
            data: {
                id: superAdmin._id,
                name: superAdmin.name,
                email: superAdmin.email,
                isSuperAdmin: superAdmin.isSuperAdmin
            },
            requestId: req.requestId
        });

    } catch (error) {
        logger.error('Super admin login error', error, {
            requestId: req.requestId
        });
        return res.status(500).json({
            success: false,
            message: 'Server error during login.',
            requestId: req.requestId
        });
    }
});

module.exports = router;
