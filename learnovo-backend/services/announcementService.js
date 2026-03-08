const Announcement = require('../models/Announcement');
const User = require('../models/User');
const Class = require('../models/Class');
const notificationService = require('./notificationService');

/**
 * Announcement Service
 * Service for creating and managing announcements and broadcasting them as notifications
 */

/**
 * Create announcement and broadcast notifications
 */
async function createAnnouncement({
    tenantId,
    createdBy,
    title,
    message,
    targetAudience = ['all'],
    targetClasses = [],
    priority = 'medium',
    expiresAt = null
}) {
    try {
        // Create announcement
        const announcement = await Announcement.create({
            tenantId,
            createdBy,
            title,
            message,
            targetAudience,
            targetClasses,
            priority,
            expiresAt,
            isActive: true
        });

        // Broadcast notifications
        const notificationCount = await broadcastAnnouncementNotifications(announcement);

        // Update announcement with notification count
        announcement.notificationsSent = notificationCount;
        announcement.sentAt = new Date();
        await announcement.save();

        return announcement;
    } catch (error) {
        console.error('Error creating announcement:', error);
        throw error;
    }
}

/**
 * Broadcast announcement as notifications to targeted users
 */
async function broadcastAnnouncementNotifications(announcement) {
    try {
        const { tenantId, targetAudience, targetClasses, title, message, priority } = announcement;

        // Build query for targeted users
        const userQuery = {
            tenantId,
            isActive: true
        };

        // Determine roles to target
        if (targetAudience.includes('all')) {
            // Target all roles except system roles
            userQuery.role = { $in: ['student', 'teacher', 'parent', 'admin'] };
        } else {
            userQuery.role = { $in: targetAudience };
        }

        // If specific classes are targeted, filter students by class
        if (targetClasses && targetClasses.length > 0) {
            // Get class details
            const classes = await Class.find({ _id: { $in: targetClasses } }).select('name');
            const classNames = classes.map(c => c.name);

            // Add class filter for students
            if (userQuery.role === 'student' || (Array.isArray(userQuery.role.$in) && userQuery.role.$in.includes('student'))) {
                userQuery.$or = [
                    { classId: { $in: targetClasses } },
                    { class: { $in: classNames } }
                ];
            }
        }

        // Get all targeted users
        const users = await User.find(userQuery).select('_id');

        if (users.length === 0) {
            console.log('No users found matching announcement criteria');
            return 0;
        }

        // Determine notification type based on priority
        const notificationType = priority === 'high' ? 'warning' : priority === 'low' ? 'info' : 'info';

        // Create notifications for all targeted users
        const notifications = users.map(user => ({
            tenantId,
            userId: user._id,
            title: `📢 ${title}`,
            message,
            type: notificationType,
            category: 'announcement',
            metadata: {
                announcementId: announcement._id,
                priority
            }
        }));

        // Bulk create notifications
        const createdNotifications = await notificationService.createBulkNotifications(notifications);

        console.log(`Announcement broadcast: ${createdNotifications.length} notifications sent`);
        return createdNotifications.length;
    } catch (error) {
        console.error('Error broadcasting announcement notifications:', error);
        throw error;
    }
}

/**
 * Get announcements with filtering
 */
async function getAnnouncements(tenantId, options = {}) {
    const {
        page = 1,
        limit = 20,
        isActive = null,
        includeExpired = false
    } = options;

    const query = { tenantId };

    if (isActive !== null) {
        query.isActive = isActive;
    }

    if (!includeExpired) {
        query.$or = [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
        ];
    }

    const skip = (page - 1) * limit;

    const [announcements, total] = await Promise.all([
        Announcement.find(query)
            .populate('createdBy', 'name role')
            .populate('targetClasses', 'name grade')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Announcement.countDocuments(query)
    ]);

    return {
        announcements,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        }
    };
}

/**
 * Get single announcement
 */
async function getAnnouncement(announcementId, tenantId) {
    const announcement = await Announcement.findOne({
        _id: announcementId,
        tenantId
    })
        .populate('createdBy', 'name role email')
        .populate('targetClasses', 'name grade');

    if (!announcement) {
        throw new Error('Announcement not found');
    }

    return announcement;
}

/**
 * Update announcement
 */
async function updateAnnouncement(announcementId, tenantId, updates) {
    const announcement = await Announcement.findOne({
        _id: announcementId,
        tenantId
    });

    if (!announcement) {
        throw new Error('Announcement not found');
    }

    // Update fields
    Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
            announcement[key] = updates[key];
        }
    });

    await announcement.save();
    return announcement;
}

/**
 * Delete announcement (soft delete)
 */
async function deleteAnnouncement(announcementId, tenantId) {
    const announcement = await Announcement.findOne({
        _id: announcementId,
        tenantId
    });

    if (!announcement) {
        throw new Error('Announcement not found');
    }

    announcement.isActive = false;
    await announcement.save();

    return announcement;
}

module.exports = {
    createAnnouncement,
    broadcastAnnouncementNotifications,
    getAnnouncements,
    getAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
};
