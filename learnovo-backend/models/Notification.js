const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // User association
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Notification content
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },

    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },

    type: {
        type: String,
        enum: ['info', 'success', 'warning', 'error'],
        required: [true, 'Type is required'],
        default: 'info'
    },

    // Categorization
    category: {
        type: String,
        enum: [
            // Admin-only categories
            'fee_collection', 'payment_received', 'financial_report', 'salary_disbursed',
            // Teacher categories
            'assignment_submitted', 'attendance_marked', 'exam_scheduled', 'class_assigned',
            // Student categories
            'assignment_graded', 'fee_due', 'exam_result', 'attendance_alert',
            // Parent categories
            'report_card', 'parent_meeting', 'fee_reminder',
            // General categories
            'admission', 'admission_status', 'announcement', 'system', 'academic', 'employee', 'exam'
        ],
        required: [true, 'Category is required']
    },

    // Role-based visibility
    visibility: {
        type: [String],
        enum: ['admin', 'teacher', 'student', 'parent'],
        default: function () {
            // Auto-set visibility based on category
            const adminOnly = ['fee_collection', 'payment_received', 'financial_report', 'salary_disbursed'];
            const teacherCategories = ['assignment_submitted', 'attendance_marked', 'exam_scheduled', 'class_assigned'];
            const studentCategories = ['assignment_graded', 'fee_due', 'exam_result', 'attendance_alert'];
            const parentCategories = ['report_card', 'parent_meeting', 'fee_reminder', 'fee_due', 'attendance_alert', 'exam_result'];

            if (adminOnly.includes(this.category)) return ['admin'];
            if (teacherCategories.includes(this.category)) return ['admin', 'teacher'];
            if (studentCategories.includes(this.category)) return ['admin', 'student'];
            if (parentCategories.includes(this.category)) return ['admin', 'parent'];
            return ['admin']; // Default to admin-only
        }
    },

    // State management
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },

    readAt: {
        type: Date,
        default: null
    },

    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },

    deletedAt: {
        type: Date,
        default: null
    },

    // Navigation
    actionUrl: {
        type: String,
        trim: true,
        default: null
    },

    actionLabel: {
        type: String,
        trim: true,
        default: null,
        maxlength: [50, 'Action label cannot exceed 50 characters']
    },

    // Metadata (flexible JSON for module-specific data)
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Delivery channels (future-ready)
    channels: {
        inApp: {
            enabled: { type: Boolean, default: true },
            deliveredAt: { type: Date, default: Date.now }
        },
        email: {
            enabled: { type: Boolean, default: false },
            sentAt: { type: Date, default: null },
            status: {
                type: String,
                enum: ['pending', 'sent', 'failed', 'delivered', null],
                default: null
            }
        },
        whatsapp: {
            enabled: { type: Boolean, default: false },
            sentAt: { type: Date, default: null },
            status: {
                type: String,
                enum: ['pending', 'sent', 'failed', 'delivered', null],
                default: null
            }
        }
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
notificationSchema.index({ tenantId: 1, userId: 1, isRead: 1, isDeleted: 1 });
notificationSchema.index({ tenantId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ tenantId: 1, category: 1 });
notificationSchema.index({ tenantId: 1, userId: 1, category: 1, isDeleted: 1 });

// Instance methods
notificationSchema.methods.markAsRead = function () {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
};

notificationSchema.methods.markAsUnread = function () {
    this.isRead = false;
    this.readAt = null;
    return this.save();
};

notificationSchema.methods.softDelete = function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    return this.save();
};

// Static methods
notificationSchema.statics.getUnreadCount = function (userId, tenantId) {
    return this.countDocuments({
        userId,
        tenantId,
        isRead: false,
        isDeleted: false
    });
};

notificationSchema.statics.getRecentNotifications = function (userId, tenantId, limit = 5) {
    return this.find({
        userId,
        tenantId,
        isDeleted: false
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
};

notificationSchema.statics.markAllAsRead = async function (userId, tenantId) {
    const result = await this.updateMany(
        {
            userId,
            tenantId,
            isRead: false,
            isDeleted: false
        },
        {
            $set: {
                isRead: true,
                readAt: new Date()
            }
        }
    );
    return result;
};

// Virtual for user-friendly display
notificationSchema.virtual('timeAgo').get(function () {
    const now = new Date();
    const diff = now - this.createdAt;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    return this.createdAt.toLocaleDateString();
});

// Ensure virtuals are included in JSON
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);
