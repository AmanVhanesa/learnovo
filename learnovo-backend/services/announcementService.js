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

        // Fire-and-forget: broadcast notifications in background
        // Response returns immediately, notifications are sent async
        setImmediate(async () => {
            try {
                const notificationCount = await broadcastAnnouncementNotifications(announcement);
                await Announcement.updateOne(
                    { _id: announcement._id },
                    { $set: { notificationsSent: notificationCount, sentAt: new Date() } }
                );
            } catch (broadcastError) {
                console.error('Background broadcast failed:', broadcastError.message);
                await Announcement.updateOne(
                    { _id: announcement._id },
                    { $set: { notificationsSent: 0, sentAt: new Date() } }
                ).catch(() => {});
            }
        });

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

        // Get all targeted user IDs only (lean + select for speed)
        const users = await User.find(userQuery).select('_id').lean();

        if (users.length === 0) {
            console.log('No users found matching announcement criteria');
            return 0;
        }

        // Determine notification type based on priority
        const notificationType = priority === 'high' ? 'warning' : 'info';

        // Build notifications array
        const notifTitle = `📢 ${title}`;
        const notifMeta = { announcementId: announcement._id, priority };
        const notifications = users.map(u => ({
            tenantId,
            userId: u._id,
            title: notifTitle,
            message,
            type: notificationType,
            category: 'announcement',
            metadata: notifMeta
        }));

        // Bulk create - batched for very large audiences
        const BATCH_SIZE = 500;
        let totalCreated = 0;

        for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
            const batch = notifications.slice(i, i + BATCH_SIZE);
            const created = await notificationService.createBulkNotifications(batch);
            totalCreated += created.length;
        }

        console.log(`Announcement broadcast: ${totalCreated} notifications sent to ${users.length} users`);
        return totalCreated;
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

    // Default to only showing active announcements unless explicitly set to false/null
    if (isActive === false) {
        query.isActive = false;
    } else if (isActive !== null) {
        query.isActive = { $ne: false };
    } else {
        query.isActive = { $ne: false };
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
