const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const SuperAdmin = require('../models/SuperAdmin');
const SuperAdminAuditLog = require('../models/SuperAdminAuditLog');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const PlatformInvoice = require('../models/PlatformInvoice');
const SupportTicket = require('../models/SupportTicket');
const PlatformAnnouncement = require('../models/PlatformAnnouncement');
const EmailTemplate = require('../models/EmailTemplate');
const PlatformSettings = require('../models/PlatformSettings');
const Coupon = require('../models/Coupon');
const KnowledgeBaseArticle = require('../models/KnowledgeBaseArticle');
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

        // Match the actual Tenant model schema enum values
        const validPlans = ['free', 'basic', 'pro', 'enterprise'];
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
 * Pass ?hard=true to permanently remove the tenant and all associated data
 */
router.delete('/tenants/:id', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        if (req.query.hard === 'true') {
            // Hard delete: remove tenant and all associated users
            await User.deleteMany({ tenantId: tenant._id });
            await Tenant.findByIdAndDelete(tenant._id);
            await audit(req, 'HARD_DELETE_TENANT', 'Tenant', tenant._id, { schoolName: tenant.schoolName, schoolCode: tenant.schoolCode });

            return res.json({ success: true, message: 'Tenant and all associated data permanently deleted.', requestId: req.requestId });
        }

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
 * POST /api/super-admin/tenants
 * Create a new tenant with admin user (super admin only, no transaction)
 */
router.post('/tenants', async (req, res) => {
    try {
        const {
            schoolName, schoolCode, subdomain, phone, address, plan,
            // Accept both naming conventions from frontend
            email, password, adminEmail, adminPassword, adminName
        } = req.body;

        const resolvedEmail = (adminEmail || email || '').toLowerCase().trim();
        const resolvedPassword = adminPassword || password;

        if (!schoolName || !resolvedEmail || !resolvedPassword || !schoolCode) {
            return res.status(400).json({ success: false, message: 'schoolName, email, password, and schoolCode are required.', requestId: req.requestId });
        }

        // Check for duplicates
        const existing = await Tenant.findOne({
            $or: [
                { schoolCode: schoolCode.toLowerCase() },
                { email: resolvedEmail }
            ]
        });
        if (existing) {
            return res.status(409).json({ success: false, message: 'A tenant with this school code or email already exists.', requestId: req.requestId });
        }

        const resolvedPlan = plan || 'free';
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

        const tenant = await Tenant.create({
            schoolName: schoolName.trim(),
            email: resolvedEmail,
            schoolCode: schoolCode.toLowerCase(),
            subdomain: (subdomain || schoolCode).toLowerCase(),
            phone: phone || '',
            address: address || {},
            isActive: true,
            subscription: {
                plan: resolvedPlan,
                status: resolvedPlan === 'free' ? 'trial' : 'active',
                trialEndsAt: resolvedPlan === 'free' ? trialEndsAt : undefined,
                maxStudents: resolvedPlan === 'enterprise' ? 10000 : 100,
                maxTeachers: resolvedPlan === 'enterprise' ? 500 : 10,
            },
            settings: { timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY', currency: 'INR', academicYear: '2025-2026' }
        });

        const adminUser = await User.create({
            tenantId: tenant._id,
            fullName: adminName || `${schoolName.trim()} Admin`,
            firstName: adminName || schoolName.trim(),
            lastName: adminName ? '' : 'Admin',
            email: resolvedEmail,
            password: resolvedPassword,
            role: 'admin',
            isActive: true
        });

        await audit(req, 'CREATE_TENANT', 'Tenant', tenant._id, { schoolName, schoolCode, email: resolvedEmail });

        return res.status(201).json({
            success: true,
            message: 'Tenant created successfully.',
            data: { tenant, adminUser: { id: adminUser._id, email: adminUser.email, role: adminUser.role }, schoolCode: tenant.schoolCode },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: create tenant error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: error.message || 'Server error creating tenant.', requestId: req.requestId });
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

// ─── TENANT NOTES ───────────────────────────────────────────────────────────

/**
 * GET /api/super-admin/tenants/:tenantId/notes
 * Get internal notes for a tenant
 */
router.get('/tenants/:tenantId/notes', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.tenantId);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        // Notes stored in audit log with action 'TENANT_NOTE'
        const notes = await SuperAdminAuditLog.find({
            targetId: tenant._id,
            targetType: 'Tenant',
            action: 'TENANT_NOTE'
        }).sort({ timestamp: -1 }).lean();

        const formatted = notes.map(n => ({
            _id: n._id,
            content: n.changes?.content || '',
            createdAt: n.timestamp,
            superAdminId: n.superAdminId
        }));

        return res.json({ success: true, data: formatted, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: get tenant notes error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error fetching notes.', requestId: req.requestId });
    }
});

/**
 * POST /api/super-admin/tenants/:tenantId/notes
 * Add an internal note for a tenant
 */
router.post('/tenants/:tenantId/notes', async (req, res) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Note content is required.', requestId: req.requestId });
        }

        const tenant = await Tenant.findById(req.params.tenantId);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const note = await SuperAdminAuditLog.create({
            superAdminId: req.superAdmin._id,
            action: 'TENANT_NOTE',
            targetType: 'Tenant',
            targetId: tenant._id,
            changes: { content: content.trim() },
            ip: req.ip || req.connection?.remoteAddress,
            timestamp: new Date()
        });

        return res.status(201).json({
            success: true,
            message: 'Note added successfully.',
            data: { _id: note._id, content: content.trim(), createdAt: note.timestamp, superAdminId: req.superAdmin._id },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: add tenant note error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error adding note.', requestId: req.requestId });
    }
});

/**
 * DELETE /api/super-admin/tenants/:tenantId/notes/:noteId
 * Delete an internal note
 */
router.delete('/tenants/:tenantId/notes/:noteId', async (req, res) => {
    try {
        const note = await SuperAdminAuditLog.findOneAndDelete({
            _id: req.params.noteId,
            targetId: req.params.tenantId,
            action: 'TENANT_NOTE'
        });
        if (!note) return res.status(404).json({ success: false, message: 'Note not found.', requestId: req.requestId });

        return res.json({ success: true, message: 'Note deleted.', requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: delete tenant note error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error deleting note.', requestId: req.requestId });
    }
});

// ─── TENANT USERS ───────────────────────────────────────────────────────────

/**
 * GET /api/super-admin/tenants/:tenantId/users
 * List users belonging to a specific tenant
 */
router.get('/tenants/:tenantId/users', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const tenant = await Tenant.findById(req.params.tenantId);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const filter = { tenantId: tenant._id };
        if (req.query.role) filter.role = req.query.role;
        if (req.query.search) {
            filter.$or = [
                { fullName: { $regex: req.query.search, $options: 'i' } },
                { firstName: { $regex: req.query.search, $options: 'i' } },
                { lastName: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const [users, total] = await Promise.all([
            User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            User.countDocuments(filter)
        ]);

        return res.json({
            success: true,
            data: users,
            pagination: { current: page, pages: Math.ceil(total / limit), total },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: get tenant users error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error fetching tenant users.', requestId: req.requestId });
    }
});

// ─── TENANT INVOICES ────────────────────────────────────────────────────────

/**
 * GET /api/super-admin/tenants/:tenantId/invoices
 * List invoices for a specific tenant
 */
router.get('/tenants/:tenantId/invoices', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.tenantId);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const invoices = await PlatformInvoice.find({ tenantId: tenant._id })
            .sort({ createdAt: -1 })
            .lean();

        return res.json({ success: true, data: invoices, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: get tenant invoices error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error fetching tenant invoices.', requestId: req.requestId });
    }
});

// ─── TENANT ACTIVITY ────────────────────────────────────────────────────────

/**
 * GET /api/super-admin/tenants/:tenantId/activity
 * Get recent activity log for a specific tenant
 */
router.get('/tenants/:tenantId/activity', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.tenantId);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const activities = await SuperAdminAuditLog.find({
            targetId: tenant._id,
            targetType: 'Tenant',
            action: { $ne: 'TENANT_NOTE' }
        }).sort({ timestamp: -1 }).limit(50).lean();

        return res.json({ success: true, data: activities, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: get tenant activity error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error fetching tenant activity.', requestId: req.requestId });
    }
});

// ─── RESET ADMIN PASSWORD ───────────────────────────────────────────────────

/**
 * POST /api/super-admin/tenants/:tenantId/reset-admin-password
 * Reset the admin password for a tenant and return the temporary password
 */
router.post('/tenants/:tenantId/reset-admin-password', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.tenantId);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const admin = await User.findOne({ tenantId: tenant._id, role: 'admin', isActive: true });
        if (!admin) return res.status(404).json({ success: false, message: 'No active admin found for this tenant.', requestId: req.requestId });

        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase() + '@1';
        admin.password = tempPassword;
        await admin.save();

        await audit(req, 'RESET_ADMIN_PASSWORD', 'Tenant', tenant._id, { adminEmail: admin.email });

        // Attempt to send email (non-blocking)
        try {
            const emailService = require('../services/emailService');
            await emailService.sendEmail({
                to: admin.email,
                subject: `Password Reset - ${tenant.schoolName}`,
                html: `<p>Hi,</p>
                       <p>Your admin password for <strong>${tenant.schoolName}</strong> has been reset by the platform administrator.</p>
                       <p><strong>Temporary password:</strong> <code>${tempPassword}</code></p>
                       <p>Please log in and change your password immediately.</p>`
            });
        } catch (emailErr) {
            logger.warn('Password reset email could not be sent', { requestId: req.requestId, tenantId: tenant._id });
        }

        return res.json({ success: true, message: 'Admin password has been reset. A notification email has been sent.', requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: reset admin password error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error resetting admin password.', requestId: req.requestId });
    }
});

// ─── MODULE OVERRIDES ───────────────────────────────────────────────────────

/**
 * PATCH /api/super-admin/tenants/:tenantId/module-overrides
 * Override module access for a specific tenant
 */
router.patch('/tenants/:tenantId/module-overrides', async (req, res) => {
    try {
        const { modules } = req.body;
        if (!modules || typeof modules !== 'object') {
            return res.status(400).json({ success: false, message: 'modules object is required.', requestId: req.requestId });
        }

        const tenant = await Tenant.findById(req.params.tenantId);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        // Store module overrides in settings.features
        if (!tenant.settings) tenant.settings = {};
        if (!tenant.settings.features) tenant.settings.features = {};

        Object.entries(modules).forEach(([key, value]) => {
            tenant.settings.features[key] = value;
        });

        tenant.markModified('settings');
        await tenant.save();
        await audit(req, 'OVERRIDE_MODULES', 'Tenant', tenant._id, { modules });

        return res.json({ success: true, message: 'Module overrides applied successfully.', data: tenant.settings.features, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: module overrides error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error applying module overrides.', requestId: req.requestId });
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
                { firstName: { $regex: req.query.search, $options: 'i' } },
                { lastName: { $regex: req.query.search, $options: 'i' } },
                { fullName: { $regex: req.query.search, $options: 'i' } },
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
 * GET /api/super-admin/users/role-distribution
 * Visual breakdown of users by role (must be before /:id to avoid param matching)
 */
router.get('/users/role-distribution', async (req, res) => {
    try {
        const distribution = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        return res.json({ success: true, data: distribution, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: role distribution error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
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

/**
 * PATCH /api/super-admin/users/:id/activate
 * Re-activate a previously deactivated user
 */
router.patch('/users/:id/activate', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found.', requestId: req.requestId });

        user.isActive = true;
        await user.save({ validateBeforeSave: false });
        await audit(req, 'ACTIVATE_USER', 'User', user._id, { email: user.email, role: user.role });

        return res.json({ success: true, message: 'User activated successfully.', requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: activate user error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error activating user.', requestId: req.requestId });
    }
});

// ─── DASHBOARD & ANALYTICS ───────────────────────────────────────────────────

/**
 * GET /api/super-admin/dashboard
 * Platform-wide stats for the super admin dashboard
 */
router.get('/dashboard', async (req, res) => {
    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        logger.info('Super admin dashboard: loading stats', { requestId: req.requestId });
        const [
            totalTenants,
            activeTenants,
            suspendedTenants,
            planBreakdownRaw,
            totalStudents,
            totalTeachers,
            totalUsers,
            recentRegistrations,
            registrationsTrendRaw
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
                .lean(),
            Tenant.aggregate([
                { $match: { isDeleted: { $ne: true }, createdAt: { $gte: sixMonthsAgo } } },
                {
                    $group: {
                        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } }
            ])
        ]);
        logger.info('Super admin dashboard: aggregations complete', { requestId: req.requestId });

        // Build plan breakdown as array (matches chart component expectation)
        const allPlans = ['free', 'basic', 'pro', 'enterprise'];
        const planBreakdown = allPlans.map(plan => {
            const found = planBreakdownRaw.find(r => r._id === plan);
            return { _id: plan, count: found ? found.count : 0 };
        });

        // Calculate estimated revenue from active paid plans
        let monthlyRevenue = 0;
        const activePaidTenants = await Tenant.find({
            isDeleted: { $ne: true },
            'subscription.status': 'active',
            'subscription.plan': { $in: ['basic', 'pro', 'enterprise'] }
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

        // Build Registrations Trend
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const trendLabels = [];
        const trendData = [];

        let curr = new Date(sixMonthsAgo);
        const now = new Date();
        while (curr <= now) {
            const year = curr.getFullYear();
            const month = curr.getMonth() + 1;
            trendLabels.push(monthNames[curr.getMonth()]);

            const found = registrationsTrendRaw.find(r => r._id.year === year && r._id.month === month);
            trendData.push(found ? found.count : 0);

            curr.setMonth(curr.getMonth() + 1);
        }

        logger.info('Super admin dashboard: sending response', { requestId: req.requestId });
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
                registrationsTrend: {
                    labels: trendLabels,
                    data: trendData
                },
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

// ─── AUDIT LOGS ──────────────────────────────────────────────────────────────

/**
 * GET /api/super-admin/audit-logs
 * Paginated audit log of all super admin actions
 * Query: page, limit, action, targetType
 */
router.get('/audit-logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.action) filter.action = req.query.action;
        if (req.query.targetType) filter.targetType = req.query.targetType;

        const [logs, total] = await Promise.all([
            SuperAdminAuditLog.find(filter)
                .populate('superAdminId', 'name email')
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            SuperAdminAuditLog.countDocuments(filter)
        ]);

        return res.json({
            success: true,
            data: logs,
            pagination: { current: page, pages: Math.ceil(total / limit), total },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: audit logs error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error loading audit logs.', requestId: req.requestId });
    }
});

/**
 * PATCH /api/super-admin/tenants/:id
 * Update tenant profile info
 */
router.patch('/tenants/:id', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const allowedFields = ['schoolName', 'email', 'phone', 'address', 'logo', 'primaryColor', 'secondaryColor', 'subdomain'];
        const changes = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                changes[field] = { from: tenant[field], to: req.body[field] };
                tenant[field] = req.body[field];
            }
        });

        // Allow updating settings
        if (req.body.settings && typeof req.body.settings === 'object') {
            Object.assign(tenant.settings, req.body.settings);
            changes.settings = req.body.settings;
        }

        await tenant.save();
        await audit(req, 'UPDATE_TENANT', 'Tenant', tenant._id, changes);

        return res.json({ success: true, message: 'Tenant updated successfully.', data: tenant, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: update tenant error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error updating tenant.', requestId: req.requestId });
    }
});

/**
 * POST /api/super-admin/tenants/bulk-action
 * Bulk actions: suspend, activate, change plan, export
 */
router.post('/tenants/bulk-action', async (req, res) => {
    try {
        const { action, tenantIds, plan } = req.body;
        if (!action || !tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
            return res.status(400).json({ success: false, message: 'action and tenantIds[] are required.', requestId: req.requestId });
        }

        let result;
        switch (action) {
            case 'suspend':
                result = await Tenant.updateMany(
                    { _id: { $in: tenantIds } },
                    { 'subscription.status': 'suspended', isActive: false }
                );
                break;
            case 'activate':
                result = await Tenant.updateMany(
                    { _id: { $in: tenantIds } },
                    { 'subscription.status': 'active', isActive: true }
                );
                break;
            case 'change_plan':
                if (!plan) return res.status(400).json({ success: false, message: 'plan is required for change_plan action.', requestId: req.requestId });
                result = await Tenant.updateMany(
                    { _id: { $in: tenantIds } },
                    { 'subscription.plan': plan }
                );
                break;
            default:
                return res.status(400).json({ success: false, message: `Unknown action: ${action}`, requestId: req.requestId });
        }

        await audit(req, `BULK_${action.toUpperCase()}`, 'Tenant', tenantIds[0], { tenantIds, action, count: tenantIds.length });

        return res.json({ success: true, message: `Bulk ${action} completed for ${tenantIds.length} tenants.`, data: result, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: bulk action error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error performing bulk action.', requestId: req.requestId });
    }
});

/**
 * POST /api/super-admin/tenants/:id/impersonate
 * Generate an impersonation token for a tenant's admin
 */
router.post('/tenants/:id/impersonate', async (req, res) => {
    try {
        const tenant = await Tenant.findById(req.params.id);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found.', requestId: req.requestId });

        const admin = await User.findOne({ tenantId: tenant._id, role: 'admin', isActive: true });
        if (!admin) return res.status(404).json({ success: false, message: 'No active admin found for this tenant.', requestId: req.requestId });

        // Generate impersonation token with limited TTL
        const impersonationToken = jwt.sign(
            { id: admin._id, role: admin.role, tenantId: tenant._id, isImpersonation: true, impersonatedBy: req.superAdmin._id },
            process.env.JWT_SECRET || 'jwt-secret-change-in-production',
            { expiresIn: '2h' }
        );

        await audit(req, 'IMPERSONATE_TENANT', 'Tenant', tenant._id, { adminEmail: admin.email });

        return res.json({
            success: true,
            message: 'Impersonation token generated.',
            data: {
                token: impersonationToken,
                user: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
                tenant: { id: tenant._id, schoolName: tenant.schoolName, schoolCode: tenant.schoolCode }
            },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: impersonate error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error generating impersonation token.', requestId: req.requestId });
    }
});

// ─── USER ROLE DISTRIBUTION ─────────────────────────────────────────────────

// ─── SUBSCRIPTION PLAN MANAGEMENT ───────────────────────────────────────────

/**
 * GET /api/super-admin/plans
 * List all subscription plans
 */
router.get('/plans', async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find().sort({ sortOrder: 1 }).lean();

        // Enrich with subscriber counts
        const enriched = await Promise.all(plans.map(async (plan) => {
            const subscriberCount = await Tenant.countDocuments({
                isDeleted: { $ne: true },
                'subscription.plan': plan.slug
            });
            return { ...plan, subscriberCount };
        }));

        return res.json({ success: true, data: enriched, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: list plans error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

/**
 * POST /api/super-admin/plans
 * Create a new subscription plan
 */
router.post('/plans', async (req, res) => {
    try {
        const plan = await SubscriptionPlan.create(req.body);
        await audit(req, 'CREATE_PLAN', 'SuperAdmin', req.superAdmin._id, { planName: plan.name, slug: plan.slug });
        return res.status(201).json({ success: true, data: plan, requestId: req.requestId });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'A plan with this slug already exists.', requestId: req.requestId });
        logger.error('Super admin: create plan error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

/**
 * PATCH /api/super-admin/plans/:id
 * Update a subscription plan
 */
router.patch('/plans/:id', async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.', requestId: req.requestId });
        await audit(req, 'UPDATE_PLAN', 'SuperAdmin', req.superAdmin._id, { planId: plan._id, changes: req.body });
        return res.json({ success: true, data: plan, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: update plan error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

/**
 * DELETE /api/super-admin/plans/:id
 */
router.delete('/plans/:id', async (req, res) => {
    try {
        const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found.', requestId: req.requestId });
        await audit(req, 'DEACTIVATE_PLAN', 'SuperAdmin', req.superAdmin._id, { planSlug: plan.slug });
        return res.json({ success: true, message: 'Plan deactivated.', requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: delete plan error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

// ─── COUPON MANAGEMENT ──────────────────────────────────────────────────────

router.get('/coupons', async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
        return res.json({ success: true, data: coupons, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: list coupons error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.post('/coupons', async (req, res) => {
    try {
        const coupon = await Coupon.create({ ...req.body, createdBy: req.superAdmin._id });
        await audit(req, 'CREATE_COUPON', 'SuperAdmin', req.superAdmin._id, { code: coupon.code });
        return res.status(201).json({ success: true, data: coupon, requestId: req.requestId });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'Coupon code already exists.', requestId: req.requestId });
        logger.error('Super admin: create coupon error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.patch('/coupons/:id', async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found.', requestId: req.requestId });
        return res.json({ success: true, data: coupon, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: update coupon error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.delete('/coupons/:id', async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: 'Coupon deleted.', requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: delete coupon error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

// ─── BILLING & INVOICES ─────────────────────────────────────────────────────

/**
 * GET /api/super-admin/billing/dashboard
 * Billing overview stats
 */
router.get('/billing/dashboard', async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());

        const [totalCollected, totalPending, totalOverdue, upcomingRenewals] = await Promise.all([
            PlatformInvoice.aggregate([
                { $match: { status: 'paid', paidAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            PlatformInvoice.aggregate([
                { $match: { status: { $in: ['sent', 'draft'] } } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]),
            PlatformInvoice.aggregate([
                { $match: { status: 'overdue' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
            ]),
            Tenant.countDocuments({
                isDeleted: { $ne: true },
                'subscription.status': 'active',
                'subscription.currentPeriodEnd': { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
            })
        ]);

        return res.json({
            success: true,
            data: {
                collectedThisMonth: totalCollected[0]?.total || 0,
                pending: totalPending[0]?.total || 0,
                overdue: totalOverdue[0]?.total || 0,
                overdueCount: totalOverdue[0]?.count || 0,
                upcomingRenewals
            },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: billing dashboard error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

/**
 * GET /api/super-admin/invoices
 * List all platform invoices
 */
router.get('/invoices', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.tenantId) filter.tenantId = req.query.tenantId;
        if (req.query.search) {
            filter.$or = [
                { invoiceNumber: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const [invoices, total] = await Promise.all([
            PlatformInvoice.find(filter)
                .populate('tenantId', 'schoolName schoolCode email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            PlatformInvoice.countDocuments(filter)
        ]);

        return res.json({
            success: true,
            data: invoices,
            pagination: { current: page, pages: Math.ceil(total / limit), total },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: list invoices error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

/**
 * POST /api/super-admin/invoices
 * Create a new invoice for a tenant
 */
router.post('/invoices', async (req, res) => {
    try {
        const invoice = await PlatformInvoice.create(req.body);
        await audit(req, 'CREATE_INVOICE', 'Tenant', invoice.tenantId, { invoiceNumber: invoice.invoiceNumber, amount: invoice.totalAmount });
        return res.status(201).json({ success: true, data: invoice, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: create invoice error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

/**
 * PATCH /api/super-admin/invoices/:id
 * Update invoice (mark as paid, etc.)
 */
router.patch('/invoices/:id', async (req, res) => {
    try {
        const invoice = await PlatformInvoice.findById(req.params.id);
        if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found.', requestId: req.requestId });

        const allowedFields = ['status', 'paymentMethod', 'transactionId', 'paymentReference', 'paidAt', 'notes', 'refundAmount', 'refundReason', 'refundedAt'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) invoice[field] = req.body[field];
        });

        // Auto-set paidAt when marking as paid
        if (req.body.status === 'paid' && !invoice.paidAt) {
            invoice.paidAt = new Date();
        }

        await invoice.save();
        await audit(req, 'UPDATE_INVOICE', 'Tenant', invoice.tenantId, { invoiceNumber: invoice.invoiceNumber, changes: req.body });
        return res.json({ success: true, data: invoice, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: update invoice error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

// ─── COMMUNICATION & ANNOUNCEMENTS ─────────────────────────────────────────

/**
 * GET /api/super-admin/announcements
 */
router.get('/announcements', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [announcements, total] = await Promise.all([
            PlatformAnnouncement.find()
                .populate('createdBy', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            PlatformAnnouncement.countDocuments()
        ]);

        return res.json({
            success: true,
            data: announcements,
            pagination: { current: page, pages: Math.ceil(total / limit), total },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: list announcements error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

/**
 * POST /api/super-admin/announcements
 */
router.post('/announcements', async (req, res) => {
    try {
        const announcement = await PlatformAnnouncement.create({
            ...req.body,
            createdBy: req.superAdmin._id,
            status: req.body.scheduledAt ? 'scheduled' : 'sent',
            sentAt: req.body.scheduledAt ? null : new Date()
        });
        await audit(req, 'CREATE_ANNOUNCEMENT', 'SuperAdmin', req.superAdmin._id, { title: announcement.title });
        return res.status(201).json({ success: true, data: announcement, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: create announcement error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.patch('/announcements/:id', async (req, res) => {
    try {
        const announcement = await PlatformAnnouncement.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found.', requestId: req.requestId });
        return res.json({ success: true, data: announcement, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: update announcement error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.delete('/announcements/:id', async (req, res) => {
    try {
        await PlatformAnnouncement.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: 'Announcement deleted.', requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: delete announcement error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

// ─── EMAIL TEMPLATES ────────────────────────────────────────────────────────

router.get('/email-templates', async (req, res) => {
    try {
        const templates = await EmailTemplate.find().sort({ type: 1 }).lean();
        return res.json({ success: true, data: templates, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: list email templates error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.post('/email-templates', async (req, res) => {
    try {
        const template = await EmailTemplate.create({ ...req.body, lastEditedBy: req.superAdmin._id });
        return res.status(201).json({ success: true, data: template, requestId: req.requestId });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'Template with this slug already exists.', requestId: req.requestId });
        logger.error('Super admin: create email template error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.patch('/email-templates/:id', async (req, res) => {
    try {
        const template = await EmailTemplate.findByIdAndUpdate(
            req.params.id,
            { ...req.body, lastEditedBy: req.superAdmin._id },
            { new: true, runValidators: true }
        );
        if (!template) return res.status(404).json({ success: false, message: 'Template not found.', requestId: req.requestId });
        return res.json({ success: true, data: template, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: update email template error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.delete('/email-templates/:id', async (req, res) => {
    try {
        await EmailTemplate.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: 'Template deleted.', requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: delete email template error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

// ─── SUPPORT TICKETS ────────────────────────────────────────────────────────

router.get('/support-tickets', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        if (req.query.priority) filter.priority = req.query.priority;
        if (req.query.category) filter.category = req.query.category;
        if (req.query.tenantId) filter.tenantId = req.query.tenantId;

        const [tickets, total] = await Promise.all([
            SupportTicket.find(filter)
                .populate('tenantId', 'schoolName schoolCode')
                .populate('assignedTo', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            SupportTicket.countDocuments(filter)
        ]);

        return res.json({
            success: true,
            data: tickets,
            pagination: { current: page, pages: Math.ceil(total / limit), total },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: list tickets error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.get('/support-tickets/:id', async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id)
            .populate('tenantId', 'schoolName schoolCode email')
            .populate('assignedTo', 'name email')
            .populate('createdBy', 'name email role')
            .lean();
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.', requestId: req.requestId });
        return res.json({ success: true, data: ticket, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: get ticket error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.post('/support-tickets', async (req, res) => {
    try {
        const ticket = await SupportTicket.create(req.body);
        return res.status(201).json({ success: true, data: ticket, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: create ticket error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.patch('/support-tickets/:id', async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.', requestId: req.requestId });

        const allowedFields = ['status', 'priority', 'category', 'assignedTo', 'tags'];
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) ticket[field] = req.body[field];
        });

        if (req.body.status === 'resolved' && !ticket.resolvedAt) ticket.resolvedAt = new Date();
        if (req.body.status === 'closed' && !ticket.closedAt) ticket.closedAt = new Date();

        await ticket.save();
        return res.json({ success: true, data: ticket, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: update ticket error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

/**
 * POST /api/super-admin/support-tickets/:id/reply
 * Add a message to a ticket
 */
router.post('/support-tickets/:id/reply', async (req, res) => {
    try {
        const ticket = await SupportTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.', requestId: req.requestId });

        ticket.messages.push({
            sender: 'superadmin',
            senderName: req.superAdmin.name,
            message: req.body.message,
            attachments: req.body.attachments || [],
            isInternal: req.body.isInternal || false
        });

        if (!ticket.firstResponseAt) ticket.firstResponseAt = new Date();

        await ticket.save();
        return res.json({ success: true, data: ticket, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: reply ticket error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

/**
 * GET /api/super-admin/support-tickets/stats/summary
 * SLA Dashboard stats
 */
router.get('/support-tickets/stats/summary', async (req, res) => {
    try {
        const [statusBreakdown, priorityBreakdown, categoryBreakdown, avgResponseTime] = await Promise.all([
            SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
            SupportTicket.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
            SupportTicket.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
            SupportTicket.aggregate([
                { $match: { firstResponseAt: { $ne: null } } },
                { $project: { responseTime: { $subtract: ['$firstResponseAt', '$createdAt'] } } },
                { $group: { _id: null, avg: { $avg: '$responseTime' } } }
            ])
        ]);

        return res.json({
            success: true,
            data: {
                byStatus: statusBreakdown,
                byPriority: priorityBreakdown,
                byCategory: categoryBreakdown,
                avgResponseTimeMs: avgResponseTime[0]?.avg || 0
            },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: ticket stats error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

// ─── KNOWLEDGE BASE ─────────────────────────────────────────────────────────

router.get('/knowledge-base', async (req, res) => {
    try {
        const filter = {};
        if (req.query.category) filter.category = req.query.category;
        if (req.query.published !== undefined) filter.isPublished = req.query.published === 'true';
        const articles = await KnowledgeBaseArticle.find(filter).sort({ sortOrder: 1 }).lean();
        return res.json({ success: true, data: articles, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: list KB articles error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.post('/knowledge-base', async (req, res) => {
    try {
        const article = await KnowledgeBaseArticle.create({ ...req.body, createdBy: req.superAdmin._id, lastEditedBy: req.superAdmin._id });
        return res.status(201).json({ success: true, data: article, requestId: req.requestId });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'Article with this slug already exists.', requestId: req.requestId });
        logger.error('Super admin: create KB article error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.patch('/knowledge-base/:id', async (req, res) => {
    try {
        const article = await KnowledgeBaseArticle.findByIdAndUpdate(
            req.params.id,
            { ...req.body, lastEditedBy: req.superAdmin._id },
            { new: true, runValidators: true }
        );
        if (!article) return res.status(404).json({ success: false, message: 'Article not found.', requestId: req.requestId });
        return res.json({ success: true, data: article, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: update KB article error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.delete('/knowledge-base/:id', async (req, res) => {
    try {
        await KnowledgeBaseArticle.findByIdAndDelete(req.params.id);
        return res.json({ success: true, message: 'Article deleted.', requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: delete KB article error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

// ─── PLATFORM SETTINGS ──────────────────────────────────────────────────────

router.get('/settings', async (req, res) => {
    try {
        let settings = await PlatformSettings.findById('platform_settings').lean();
        if (!settings) {
            settings = await PlatformSettings.create({ _id: 'platform_settings' });
            settings = settings.toObject();
        }
        return res.json({ success: true, data: settings, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: get settings error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

router.patch('/settings', async (req, res) => {
    try {
        const settings = await PlatformSettings.findByIdAndUpdate(
            'platform_settings',
            { $set: req.body },
            { new: true, upsert: true, runValidators: true }
        );
        await audit(req, 'UPDATE_SETTINGS', 'SuperAdmin', req.superAdmin._id, { sections: Object.keys(req.body) });
        return res.json({ success: true, data: settings, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: update settings error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

// ─── MODULE MANAGEMENT ──────────────────────────────────────────────────────

// Master module list (static configuration)
const MODULES = [
    { slug: 'sis', name: 'Student Information System', icon: 'Users', status: 'stable', version: '1.0' },
    { slug: 'staff', name: 'Teacher/Staff Management', icon: 'UserCog', status: 'stable', version: '1.0' },
    { slug: 'attendance', name: 'Attendance Management', icon: 'ClipboardCheck', status: 'stable', version: '1.0' },
    { slug: 'timetable', name: 'Timetable / Schedule', icon: 'Calendar', status: 'stable', version: '1.0' },
    { slug: 'fees', name: 'Fee & Finance Management', icon: 'IndianRupee', status: 'stable', version: '1.0' },
    { slug: 'exams', name: 'Exam & Grade Management', icon: 'FileText', status: 'stable', version: '1.0' },
    { slug: 'homework', name: 'Assignment & Homework', icon: 'BookOpen', status: 'stable', version: '1.0' },
    { slug: 'virtual_classroom', name: 'Online Classes / Virtual Classroom', icon: 'Video', status: 'beta', version: '0.9' },
    { slug: 'library', name: 'Library Management', icon: 'Library', status: 'coming_soon', version: null },
    { slug: 'transport', name: 'Transport / Bus Management', icon: 'Bus', status: 'stable', version: '1.0' },
    { slug: 'hostel', name: 'Hostel / Dormitory Management', icon: 'Building', status: 'coming_soon', version: null },
    { slug: 'parent_portal', name: 'Parent Portal', icon: 'Heart', status: 'stable', version: '1.0' },
    { slug: 'student_portal', name: 'Student Portal', icon: 'GraduationCap', status: 'stable', version: '1.0' },
    { slug: 'hr_payroll', name: 'HR & Payroll', icon: 'Briefcase', status: 'stable', version: '1.0' },
    { slug: 'inventory', name: 'Inventory / Asset Management', icon: 'Package', status: 'coming_soon', version: null },
    { slug: 'events', name: 'Event & Calendar Management', icon: 'CalendarDays', status: 'beta', version: '0.8' },
    { slug: 'notices', name: 'Notice Board / Announcements', icon: 'Megaphone', status: 'stable', version: '1.0' },
    { slug: 'communication', name: 'SMS & Email Communication', icon: 'MessageSquare', status: 'stable', version: '1.0' },
    { slug: 'report_cards', name: 'Report Card Generator', icon: 'FileBarChart', status: 'stable', version: '1.0' },
    { slug: 'certificates', name: 'Certificate Generator', icon: 'Award', status: 'stable', version: '1.0' },
    { slug: 'admissions', name: 'Admission / Enrollment', icon: 'UserPlus', status: 'stable', version: '1.0' },
    { slug: 'visitors', name: 'Visitor Management', icon: 'DoorOpen', status: 'coming_soon', version: null },
    { slug: 'id_cards', name: 'ID Card Generator', icon: 'CreditCard', status: 'coming_soon', version: null },
    { slug: 'front_office', name: 'Front Office / Reception', icon: 'Headphones', status: 'coming_soon', version: null },
    { slug: 'complaints', name: 'Complaint / Grievance', icon: 'AlertTriangle', status: 'coming_soon', version: null },
    { slug: 'gallery', name: 'Gallery / Media Management', icon: 'Image', status: 'beta', version: '0.5' },
    { slug: 'alumni', name: 'Alumni Management', icon: 'Users2', status: 'coming_soon', version: null },
    { slug: 'lesson_plans', name: 'Lesson Plan Management', icon: 'NotebookPen', status: 'coming_soon', version: null }
];

router.get('/modules', async (req, res) => {
    try {
        // Enrich with usage stats
        const moduleUsage = await Promise.all(MODULES.map(async (mod) => {
            const tenantsUsingModule = await Tenant.countDocuments({
                isDeleted: { $ne: true },
                [`settings.features.${mod.slug}`]: true
            });
            return { ...mod, tenantsUsing: tenantsUsingModule };
        }));
        return res.json({ success: true, data: moduleUsage, requestId: req.requestId });
    } catch (error) {
        logger.error('Super admin: list modules error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

// ─── REPORTS & ANALYTICS ────────────────────────────────────────────────────

/**
 * GET /api/super-admin/reports/overview
 * Comprehensive analytics overview
 */
router.get('/reports/overview', async (req, res) => {
    try {
        const now = new Date();
        const twelveMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth(), 1);

        const [
            tenantGrowth,
            revenueByPlan,
            usersByRole,
            tenantsByRegion,
            monthlyRevenue
        ] = await Promise.all([
            // Tenant growth monthly
            Tenant.aggregate([
                { $match: { isDeleted: { $ne: true }, createdAt: { $gte: twelveMonthsAgo } } },
                { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]),
            // Revenue by plan
            Tenant.aggregate([
                { $match: { isDeleted: { $ne: true }, 'subscription.status': 'active' } },
                { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }
            ]),
            // Users by role
            User.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: '$role', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),
            // Tenants by region (city)
            Tenant.aggregate([
                { $match: { isDeleted: { $ne: true }, 'address.city': { $ne: null } } },
                { $group: { _id: '$address.city', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 }
            ]),
            // Monthly revenue estimates
            PlatformInvoice.aggregate([
                { $match: { status: 'paid', paidAt: { $gte: twelveMonthsAgo } } },
                { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, total: { $sum: '$totalAmount' } } },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ])
        ]);

        return res.json({
            success: true,
            data: { tenantGrowth, revenueByPlan, usersByRole, tenantsByRegion, monthlyRevenue },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: reports overview error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

// ─── SYSTEM MONITORING ──────────────────────────────────────────────────────

/**
 * GET /api/super-admin/system/health
 * System health and monitoring data
 */
router.get('/system/health', async (req, res) => {
    try {
        const os = require('os');
        const dbStats = await mongoose.connection.db.stats();
        const adminDb = mongoose.connection.db.admin();
        const serverStatus = await adminDb.serverStatus().catch(() => null);

        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
        const rssMB = Math.round(memUsage.rss / 1024 / 1024);
        const externalMB = Math.round((memUsage.external || 0) / 1024 / 1024);

        // Determine the actual max heap size from --max-old-space-size or V8 defaults
        const v8 = require('v8');
        const heapStats = v8.getHeapStatistics();
        const heapMaxMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);
        const heapPercent = heapMaxMB ? (heapUsedMB / heapMaxMB) * 100 : 0;

        // Format uptime
        const uptimeSec = Math.floor(process.uptime());
        const d = Math.floor(uptimeSec / 86400);
        const h = Math.floor((uptimeSec % 86400) / 3600);
        const m = Math.floor((uptimeSec % 3600) / 60);
        const uptimeFormatted = d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`;

        // Email queue status
        let emailStatus = { status: 'not_configured', queueLength: 0, pending: 0, failed: 0 };
        try {
            const emailService = require('../services/emailService');
            const qs = emailService.getQueueStatus();
            emailStatus = { status: 'configured', ...qs };
        } catch (e) { /* email service may not be loaded */ }

        // Cache stats
        let cacheStats = { keys: 0, hits: 0, misses: 0 };
        try {
            const cacheModule = require('../utils/cache');
            cacheStats = cacheModule.getStats();
        } catch (e) { /* ignore */ }

        // Service configuration checks
        const cloudinaryConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);
        const s3Configured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
        const razorpayConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

        // Build alerts
        const alerts = [];
        if (heapPercent > 85) {
            alerts.push({ level: 'critical', title: 'High Memory Usage', message: `Heap memory is at ${heapPercent.toFixed(1)}% (${heapUsedMB} MB / ${heapMaxMB} MB). Server may become unstable.` });
        } else if (heapPercent > 70) {
            alerts.push({ level: 'warning', title: 'Elevated Memory Usage', message: `Heap memory is at ${heapPercent.toFixed(1)}% (${heapUsedMB} MB / ${heapMaxMB} MB).` });
        }
        if (emailStatus.failed > 0) {
            alerts.push({ level: 'warning', title: 'Failed Emails', message: `${emailStatus.failed} failed emails in queue` });
        }
        if (mongoose.connection.readyState !== 1) {
            alerts.push({ level: 'critical', title: 'Database Disconnected', message: 'MongoDB connection is not active.' });
        }

        const overallStatus = alerts.some(a => a.level === 'critical') ? 'critical' : alerts.some(a => a.level === 'warning') ? 'warning' : 'healthy';

        // CPU usage
        const cpuUsage = process.cpuUsage();
        const loadAvg = os.loadavg();

        // Database connections
        const connections = serverStatus?.connections || {};

        // Read package.json version
        let appVersion = '1.0.0';
        try {
            const pkg = require('../package.json');
            appVersion = pkg.version || '1.0.0';
        } catch (e) { /* ignore */ }

        return res.json({
            success: true,
            data: {
                status: overallStatus,
                lastChecked: new Date(),

                server: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    pid: process.pid,
                    uptime: uptimeSec,
                    uptimeFormatted,
                    memory: {
                        rss: rssMB,
                        heapTotal: heapTotalMB,
                        heapUsed: heapUsedMB,
                        heapMax: heapMaxMB,
                        external: externalMB,
                        heapUsedPercent: Math.round(heapPercent * 10) / 10,
                    },
                    cpu: {
                        user: cpuUsage.user,
                        system: cpuUsage.system,
                        loadAvg,
                    },
                    os: {
                        type: os.type(),
                        release: os.release(),
                        totalMemory: Math.round(os.totalmem() / 1024 / 1024),
                        freeMemory: Math.round(os.freemem() / 1024 / 1024),
                    },
                },

                database: {
                    status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                    readyState: mongoose.connection.readyState,
                    host: mongoose.connection.host,
                    name: mongoose.connection.name,
                    stats: {
                        dataSize: Math.round((dbStats.dataSize || 0) / 1024 / 1024),
                        storageSize: Math.round((dbStats.storageSize || 0) / 1024 / 1024),
                        collections: dbStats.collections,
                        objects: dbStats.objects,
                        indexes: dbStats.indexes,
                        avgObjSize: dbStats.avgObjSize ? Math.round(dbStats.avgObjSize) : 0,
                    },
                    connections: {
                        current: connections.current || 0,
                        available: connections.available || 0,
                        totalCreated: connections.totalCreated || 0,
                    },
                },

                services: {
                    email: emailStatus,
                    cache: {
                        keys: cacheStats.keys || 0,
                        hits: cacheStats.hits || 0,
                        misses: cacheStats.misses || 0,
                        hitRate: (cacheStats.hits + cacheStats.misses) > 0
                            ? Math.round((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100)
                            : 0,
                    },
                    storage: {
                        cloudinary: cloudinaryConfigured ? 'configured' : 'not_configured',
                        s3: s3Configured ? 'configured' : 'not_configured',
                    },
                    payment: {
                        razorpay: razorpayConfigured ? 'configured' : 'not_configured',
                    },
                },

                alerts,

                platform: {
                    version: appVersion,
                    environment: process.env.NODE_ENV || 'development',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
            },
            requestId: req.requestId
        });
    } catch (error) {
        logger.error('Super admin: system health error', error, { requestId: req.requestId });
        return res.status(500).json({ success: false, message: 'Server error.', requestId: req.requestId });
    }
});

module.exports = router;
