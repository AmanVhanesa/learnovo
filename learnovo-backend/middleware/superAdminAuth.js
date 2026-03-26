const jwt = require('jsonwebtoken');
const SuperAdmin = require('../models/SuperAdmin');
const { logger } = require('./errorHandler');

/**
 * Super Admin Auth Middleware
 * Verifies JWT signed with SUPER_ADMIN_JWT_SECRET and checks role === 'superadmin'.
 * Attaches req.superAdmin to the request.
 */
const superAdminAuth = async (req, res, next) => {
    try {
        let token;

        // Extract Bearer token
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.',
                requestId: req.requestId
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.SUPER_ADMIN_JWT_SECRET || 'super-admin-secret-key');
        } catch (err) {
            const message = err.name === 'TokenExpiredError' ? 'Super admin token has expired.' : 'Invalid super admin token.';
            return res.status(401).json({
                success: false,
                message,
                requestId: req.requestId
            });
        }

        // Verify role in the token payload
        if (decoded.role !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Super admin privileges required.',
                requestId: req.requestId
            });
        }

        // Fetch the SuperAdmin document to ensure it still exists and is active
        const superAdmin = await SuperAdmin.findById(decoded.id);
        if (!superAdmin) {
            return res.status(401).json({
                success: false,
                message: 'Super admin account not found.',
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

        // Attach super admin to request
        req.superAdmin = superAdmin;

        logger.info('Super admin access', {
            requestId: req.requestId,
            route: req.originalUrl,
            superAdminId: superAdmin._id,
            superAdminEmail: superAdmin.email
        });

        next();
    } catch (error) {
        logger.error('Super admin auth middleware error', error, {
            requestId: req.requestId,
            route: req.originalUrl
        });
        return res.status(500).json({
            success: false,
            message: 'Server error in super admin authentication.',
            requestId: req.requestId
        });
    }
};

module.exports = superAdminAuth;
