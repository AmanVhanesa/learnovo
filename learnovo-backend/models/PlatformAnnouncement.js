const mongoose = require('mongoose');

const platformAnnouncementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  body: { type: String, required: true }, // Rich text / HTML

  // Targeting
  targetType: {
    type: String,
    enum: ['all', 'selected', 'plan_based'],
    default: 'all'
  },
  targetTenants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }],
  targetPlans: [{ type: String }], // e.g. ['basic', 'pro']

  // Delivery channels
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },

  attachments: [{ type: String }], // file URLs

  // Scheduling
  scheduledAt: { type: Date }, // null = send immediately
  sentAt: { type: Date },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sent', 'cancelled'],
    default: 'draft'
  },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
  deliveryStats: {
    totalRecipients: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 }
  }
}, { timestamps: true });

platformAnnouncementSchema.index({ status: 1, scheduledAt: 1 });
platformAnnouncementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PlatformAnnouncement', platformAnnouncementSchema);
