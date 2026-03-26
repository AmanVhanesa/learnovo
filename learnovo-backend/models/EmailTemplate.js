const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  subject: { type: String, required: true, trim: true },
  body: { type: String, required: true }, // HTML content with {{variable}} placeholders

  type: {
    type: String,
    enum: ['welcome', 'trial_expiry', 'payment_receipt', 'payment_overdue', 'password_reset',
           'account_suspended', 'account_activated', 'maintenance', 'feature_update', 'newsletter', 'custom'],
    default: 'custom'
  },

  // Available template variables for this template
  variables: [{ type: String }], // e.g. ['school_name', 'admin_name', 'plan_name']

  isActive: { type: Boolean, default: true },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' }
}, { timestamps: true });

emailTemplateSchema.index({ slug: 1 });
emailTemplateSchema.index({ type: 1 });

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);
