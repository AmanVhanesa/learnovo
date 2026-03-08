const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    // Multi-tenant support
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // Creator
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Content
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
        maxlength: [2000, 'Message cannot exceed 2000 characters']
    },

    // Targeting
    targetAudience: {
        type: [String],
        enum: ['student', 'teacher', 'parent', 'admin', 'all'],
        required: [true, 'Target audience is required'],
        default: ['all']
    },

    // Optional: target specific classes
    targetClasses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],

    // Priority
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },

    // Expiration
    expiresAt: {
        type: Date,
        default: null
    },

    // Status
    isActive: {
        type: Boolean,
        default: true
    },

    // Metadata
    notificationsSent: {
        type: Number,
        default: 0
    },

    sentAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Indexes
announcementSchema.index({ tenantId: 1, isActive: 1, createdAt: -1 });
announcementSchema.index({ tenantId: 1, expiresAt: 1 });

// Instance method to check if announcement is expired
announcementSchema.methods.isExpired = function () {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
};

// Static method to get active announcements
announcementSchema.statics.getActiveAnnouncements = function (tenantId) {
    return this.find({
        tenantId,
        isActive: true,
        $or: [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
        ]
    })
        .sort({ createdAt: -1 })
        .populate('createdBy', 'name role')
        .lean();
};

module.exports = mongoose.model('Announcement', announcementSchema);
