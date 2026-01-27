const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema({
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

    // Notification preferences by category
    preferences: {
        admission: {
            inApp: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            whatsapp: { type: Boolean, default: false }
        },
        fee: {
            inApp: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            whatsapp: { type: Boolean, default: false }
        },
        academic: {
            inApp: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            whatsapp: { type: Boolean, default: false }
        },
        attendance: {
            inApp: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            whatsapp: { type: Boolean, default: false }
        },
        employee: {
            inApp: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            whatsapp: { type: Boolean, default: false }
        },
        exam: {
            inApp: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            whatsapp: { type: Boolean, default: false }
        },
        system: {
            inApp: { type: Boolean, default: true },
            email: { type: Boolean, default: false },
            whatsapp: { type: Boolean, default: false }
        }
    }
}, {
    timestamps: true
});

// Unique index: one preference document per user per tenant
notificationPreferenceSchema.index({ userId: 1, tenantId: 1 }, { unique: true });

// Static method to get or create preferences for a user
notificationPreferenceSchema.statics.getOrCreate = async function (userId, tenantId) {
    let preferences = await this.findOne({ userId, tenantId });

    if (!preferences) {
        preferences = await this.create({ userId, tenantId });
    }

    return preferences;
};

// Static method to check if notification should be sent for a category
notificationPreferenceSchema.statics.shouldNotify = async function (userId, tenantId, category, channel = 'inApp') {
    const preferences = await this.getOrCreate(userId, tenantId);

    // Default to true if category doesn't exist
    if (!preferences.preferences[category]) {
        return true;
    }

    return preferences.preferences[category][channel] === true;
};

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
