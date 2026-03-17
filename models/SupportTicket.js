const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, enum: ['tenant', 'superadmin'], required: true },
  senderName: { type: String, trim: true },
  message: { type: String, required: true, trim: true },
  attachments: [{ type: String }],
  isInternal: { type: Boolean, default: false }, // Internal notes not visible to tenant
  createdAt: { type: Date, default: Date.now }
});

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true, unique: true, trim: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  subject: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },

  category: {
    type: String,
    enum: ['billing', 'technical', 'feature_request', 'general', 'data_request', 'account'],
    default: 'general',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed'],
    default: 'open',
    index: true
  },

  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' },
  messages: [messageSchema],

  // Timing
  firstResponseAt: { type: Date },
  resolvedAt: { type: Date },
  closedAt: { type: Date },

  tags: [{ type: String, trim: true }]
}, { timestamps: true });

supportTicketSchema.index({ tenantId: 1, status: 1 });
supportTicketSchema.index({ createdAt: -1 });

// Auto-generate ticket number
supportTicketSchema.pre('save', async function (next) {
  if (this.isNew && !this.ticketNumber) {
    const count = await this.constructor.countDocuments();
    this.ticketNumber = `TKT-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
