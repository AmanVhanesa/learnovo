const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const superAdminAuth = require('../middleware/superAdminAuth');
const { PLANS, getPlanConfig, getPlanDisplayName } = require('../utils/planConfig');
const { logger } = require('../middleware/errorHandler');

const router = express.Router();

// All routes protected by superAdminAuth
router.use(superAdminAuth);

// ─── Audit Log Helper ────────────────────────────────────────────────────────

const audit = async (req, action, targetType, targetId, changes = {}) => {
    try {
        await SuperAdminAuditLog.create({
            superAdminId: req.superAdmin._id,
            action,
            targetType,
            targetId,
            changes,
            ip: req.ip || req.connection?.remoteAddress,
            timestamp: new Date()
        });
    } catch (err) {
        logger.error('Audit log write failed', err, { requestId: req.requestId, action });
    }
};

// ─── TENANT MANAGEMENT ───────────────────────────────────────────────────────

/**
 * GET /api/super-admin/tenants
 * List all tenants with pagination, search, filter by plan/status
 */
router.get('/tenants', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = { isDeleted: { $ne: true } };

        if (req.query.search) {
            filter.$or = [
                { schoolName: { $regex: req.query.search, $options: 'i' } },
                { schoolCode: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } }
            ];
        }
        if (req.query.plan) filter['subscription.plan'] = req.query.plan;
        if (req.query.status) filter['subscription.status'] = req.query.status;

        const [tenants, total] = await Promise.all([
            Tenant.find(filter)
                .select('-settings.features') // trim large fields
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Tenant.countDocuments(filter)
        ]);

        // Enrich with quick user counts
        const enriched = await Promise.all(tenants.map(async (t) => {
            const [students, teachers] = await Promise.all([
                User.countDocuments({ tenantId: t._id, role: 'student', isActive: true }),
                User.countDocuments({ tenantId: t._id, role: 'teacher', isActive: true })
            ]);
            return { ...t, usage: { students, teachers } };
        }));

        return res.json({
            success: true,
            data: enriched,
            pagination: { current: page, pages: Math.ceil(total / limit), total },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: list tenants error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error listing tenants.', requestId: req.requestId });
    }
});

/**
 * GET /api/super-admin/tenants/:id
 * Full tenant detail with live usage stats
 */
router.get('/tenants/:id', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id).lean();
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const [students, teachers, totalUsers] = await Promise.all([
            User.countDocuments({ tenantId: tenant._id, role: 'student', isActive: true }),
            User.countDocuments({ tenantId: tenant._id, role: 'teacher', isActive: true }),
            User.countDocuments({ tenantId: tenant._id })
        ]);

        const planConfig = getPlanConfig(tenant.subscription?.plan) || {};

        return res.json({
            success: true,
            data: {
                ...tenant,
                usage: { students, teachers, totalUsers },
                planConfig: {
                    limits: planConfig.limits,
                    price: planConfig.price,
                    name: planConfig.name
                }
            },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: get tenant error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error fetching tenant.', requestId: req.requestId });
    }
});

/**
 * PATCH /api/super-admin/tenants/:id/plan
 * Change tenant's subscription plan and/or status
 * Body: { plan, status, customLimits? }
 */
router.patch('/tenants/:id/plan', async (req, res) => {
    try {
        const { plan, status, customLimits } = req.body;

        const validPlans = ['free_trial', 'basic', 'premium', 'enterprise'];
        const validStatuses = ['trial', 'active', 'suspended', 'cancelled'];

        if (plan && !validPlans.includes(plan)) {
            return res.status(400).json({ success: false, message: `Invalid plan. Must be one of: ${validPlans.join(', ')}`, requestId: req.requestId });
        }
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`, requestId: req.requestId });
        }

        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const changes = {};
        if (plan) { changes['subscription.plan'] = { from: tenant.subscription.plan, to: plan }; tenant.subscription.plan = plan; }
        if (status) { changes['subscription.status'] = { from: tenant.subscription.status, to: status }; tenant.subscription.status = status; }
        if (customLimits) {
            changes['subscription.customLimits'] = customLimits;
            tenant.subscription.customLimits = customLimits;
            if (!tenant.subscription.isManualOverride) tenant.subscription.isManualOverride = true;
        }

        // Set currentPeriodEnd based on billing cycle when activating
        if (status === 'active') {
            const days = tenant.subscription.billingCycle === 'yearly' ? 365 : 30;
            tenant.subscription.currentPeriodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        }

        await tenant.save();
        await audit(req, 'CHANGE_PLAN', 'Tenant', tenant._id, changes);

        return res.json({
            success: true,
            message: 'Subscription updated successfully.',
            data: tenant,
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: change plan error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error updating plan.', requestId: req.requestId });
    }
});

/**
 * PATCH /api/super-admin/tenants/:id/suspend
 * Suspend a tenant account
 */
router.patch('/tenants/:id/suspend', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const prevStatus = tenant.subscription.status;
        tenant.subscription.status = 'suspended';
        tenant.isActive = false;
        await tenant.save();
        await audit(req, 'SUSPEND_TENANT', 'Tenant', tenant._id, { status: { from: prevStatus, to: 'suspended' } });

        return res.json({ success: true, message: 'Tenant suspended successfully.', data: tenant, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: suspend tenant error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error suspending tenant.', requestId: req.requestId });
    }
});

/**
 * PATCH /api/super-admin/tenants/:id/activate
 * Reactivate a tenant account
 */
router.patch('/tenants/:id/activate', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const prevStatus = tenant.subscription.status;
        tenant.subscription.status = 'active';
        tenant.isActive = true;
        await tenant.save();
        await audit(req, 'ACTIVATE_TENANT', 'Tenant', tenant._id, { status: { from: prevStatus, to: 'active' } });

        return res.json({ success: true, message: 'Tenant activated successfully.', data: tenant, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: activate tenant error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error activating tenant.', requestId: req.requestId });
    }
});

/**
 * DELETE /api/super-admin/tenants/:id
 * Soft delete a tenant (set isDeleted: true)
 */
router.delete('/tenants/:id', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        tenant.isDeleted = true;
        tenant.isActive = false;
        tenant.subscription.status = 'cancelled';
        await tenant.save();
        await audit(req, 'DELETE_TENANT', 'Tenant', tenant._id, { isDeleted: true });

        return res.json({ success: true, message: 'Tenant soft-deleted successfully.', requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: delete tenant error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error deleting tenant.', requestId: req.requestId });
    }
});

/**
 * POST /api/super-admin/tenants/:id/extend-trial
 * Extend trial by N days
 * Body: { days }
 */
router.post('/tenants/:id/extend-trial', async (req, res) => {
    try {
        const days = parseInt(req.body.days);
        if (!days || days < 1 || days > 365) {
            return res.status(400).json({ success: false, message: 'days must be between 1 and 365.', requestId: req.requestId });
        }

        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        // Extend from current trialEndsAt or today, whichever is later
        const base = tenant.subscription.trialEndsAt && tenant.subscription.trialEndsAt > new Date()
            ? tenant.subscription.trialEndsAt
            : new Date();

        const newTrialEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
        const prevTrialEnd = tenant.subscription.trialEndsAt;

        tenant.subscription.trialEndsAt = newTrialEnd;
        // Reactivate if it was suspended due to trial expiry
        if (tenant.subscription.status === 'suspended') {
            tenant.subscription.status = 'trial';
            tenant.isActive = true;
        }
        await tenant.save();
        await audit(req, 'EXTEND_TRIAL', 'Tenant', tenant._id, { trialEndsAt: { from: prevTrialEnd, to: newTrialEnd }, days });

        return res.json({
            success: true,
            message: `Trial extended by ${days} day(s). New expiry: ${newTrialEnd.toISOString().split('T')[0]}.`,
            data: { trialEndsAt: newTrialEnd },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: extend trial error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error extending trial.', requestId: req.requestId });
    }
});

/**
 * PATCH /api/super-admin/tenants/:id/override-features
 * Manually override specific features/limits for a tenant
 * Body: { featureOverrides, customLimits }
 */
router.patch('/tenants/:id/override-features', async (req, res) => {
    try {
        const { featureOverrides, customLimits } = req.body;

        if (!featureOverrides && !customLimits) {
            return res.status(400).json({ success: false, message: 'featureOverrides or customLimits are required.', requestId: req.requestId });
        }

        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const changes = {};

        if (featureOverrides && typeof featureOverrides === 'object') {
            tenant.subscription.featureOverrides = {
                ...(tenant.subscription.featureOverrides || {}),
                ...featureOverrides
            };
            changes.featureOverrides = featureOverrides;
        }

        if (customLimits && typeof customLimits === 'object') {
            tenant.subscription.customLimits = {
                ...(tenant.subscription.customLimits || {}),
                ...customLimits
            };
            changes.customLimits = customLimits;
        }

        tenant.subscription.isManualOverride = true;
        await tenant.save();
        await audit(req, 'OVERRIDE_FEATURES', 'Tenant', tenant._id, changes);

        return res.json({
            success: true,
            message: 'Feature overrides applied successfully.',
            data: {
                featureOverrides: tenant.subscription.featureOverrides,
                customLimits: tenant.subscription.customLimits,
                isManualOverride: tenant.subscription.isManualOverride
            },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: override features error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error overriding features.', requestId: req.requestId });
    }
});

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

/**
 * GET /api/super-admin/users
 * List all users across tenants
 */
router.get('/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.tenantId) {
            if (!mongoose.Types.ObjectId.isValid(req.query.tenantId)) {
                return res.status(400).json({ success: false, message: 'Invalid tenantId.', requestId: req.requestId });
            }
            filter.tenantId = req.query.tenantId;
        }
        if (req.query.role) filter.role = req.query.role;
        if (req.query.search) {
            filter.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const [users, total] = await Promise.all([
            User.find(filter)
                .select('-password')
                .populate('tenantId', 'schoolName schoolCode')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(filter)
        ]);

        return res.json({
            success: true,
            data: users,
            pagination: { current: page, pages: Math.ceil(total / limit), total },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: list users error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error listing users.', requestId: req.requestId });
    }
});

/**
 * GET /api/super-admin/users/:id
 * Get user detail
 */
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password')
            .populate('tenantId', 'schoolName schoolCode subscription')
            .lean();

        if (!user) return res.status(404).json({ success: false, message: 'User not found.', requestId: req.requestId });

        return res.json({ success: true, data: user, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: get user error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error fetching user.', requestId: req.requestId });
    }
});

/**
 * PATCH /api/super-admin/users/:id/reset-password
 * Force password reset for a user
 */
router.patch('/users/:id/reset-password', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.', requestId: req.requestId });

        // Generate a secure temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase() + '@1';
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(tempPassword, salt);
        user.updatedAt = new Date();
        await user.save({ validateBeforeSave: false });

        // Attempt to send email notification (non-blocking — skip if emailService unavailable)
        try {
            const emailService = require('../services/emailService');
            await emailService.sendEmail({
                to: user.email,
                subject: 'Your Learnovo password has been reset',
                html: `<p>Hi ${user.name},</p>
               <p>Your password has been reset by the Learnovo admin team.</p>
               <p><strong>Temporary password:</strong> <code>${tempPassword}</code></p>
               <p>Please log in and change your password immediately.</p>`
            });
        } catch (emailErr) {
            logger.warn('Password reset email could not be sent', { requestId: req.requestId, userId: user._id });
        }

        await audit(req, 'RESET_USER_PASSWORD', 'User', user._id, { email: user.email });

        return res.json({
            success: true,
            message: 'Password reset successfully.',
            data: { tempPassword, userId: user._id, email: user.email },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: reset password error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error resetting password.', requestId: req.requestId });
    }
});

/**
 * DELETE /api/super-admin/users/:id
 * Deactivate a user (soft delete)
 */
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.', requestId: req.requestId });

        user.isActive = false;
        await user.save({ validateBeforeSave: false });
        await audit(req, 'DEACTIVATE_USER', 'User', user._id, { email: user.email, role: user.role });

        return res.json({ success: true, message: 'User deactivated successfully.', requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: deactivate user error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error deactivating user.', requestId: req.requestId });
    }
});

// ─── DASHBOARD & ANALYTICS ───────────────────────────────────────────────────

/**
 * GET /api/super-admin/dashboard
 * Platform-wide stats for the super admin dashboard
 */
router.get('/dashboard', async (req, res) => {
    try {
        const [
            totalTenants,
            activeTenants,
            suspendedTenants,
            planBreakdownRaw,
            totalStudents,
            totalTeachers,
            totalUsers,
            recentRegistrations
        ] = await Promise.all([
            Tenant.countDocuments({ isDeleted: { $ne: true } }),
            Tenant.countDocuments({ isDeleted: { $ne: true }, 'subscription.status': 'active' }),
            Tenant.countDocuments({ isDeleted: { $ne: true }, 'subscription.status': 'suspended' }),
            Tenant.aggregate([
                { $match: { isDeleted: { $ne: true } } },
                { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }
            ]),
            User.countDocuments({ role: 'student', isActive: true }),
            User.countDocuments({ role: 'teacher', isActive: true }),
            User.countDocuments({}),
            Tenant.find({ isDeleted: { $ne: true } })
                .select('schoolName schoolCode email subscription.plan subscription.status createdAt')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean()
        ]);

        // Build plan breakdown object
        const planBreakdown = { free_trial: 0, basic: 0, premium: 0, enterprise: 0 };
        planBreakdownRaw.forEach(({ _id, count }) => {
            if (_id && planBreakdown[_id] !== undefined) planBreakdown[_id] = count;
        });

        // Calculate estimated revenue from active paid plans
        let monthlyRevenue = 0;
        const activePaidTenants = await Tenant.find({
            isDeleted: { $ne: true },
            'subscription.status': 'active',
            'subscription.plan': { $in: ['basic', 'premium', 'enterprise'] }
        }).select('subscription.plan subscription.billingCycle').lean();

        activePaidTenants.forEach(t => {
            const planCfg = getPlanConfig(t.subscription?.plan);
            if (planCfg?.price) {
                const monthly = t.subscription?.billingCycle === 'yearly'
                    ? Math.round(planCfg.price * 0.85) // ~15% annual discount
                    : planCfg.price;
                monthlyRevenue += monthly;
            }
        });

        return res.json({
            success: true,
            data: {
                totalTenants,
                activeTenants,
                suspendedTenants,
                trialTenants: await Tenant.countDocuments({ isDeleted: { $ne: true }, 'subscription.status': 'trial' }),
                planBreakdown,
                totalStudents,
                totalTeachers,
                totalUsers,
                recentRegistrations,
                revenue: {
                    monthly: monthlyRevenue,
                    annual: monthlyRevenue * 12
                }
            },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: dashboard error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error loading dashboard.', requestId: req.requestId });
    }
});

module.exports = router;
