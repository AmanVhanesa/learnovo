const mongoose = require('mongoose');

const librarySettingsSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true, index: true },

  finePerDay: { type: Number, default: 2, min: 0 },
  maxIssuePeriodDays: { type: Number, default: 30, min: 1 },
  maxRenewalsAllowed: { type: Number, default: 1, min: 0 },

  maxBooksPerStudent: { type: Number, default: 3, min: 0 },
  maxBooksPerTeacher: { type: Number, default: 5, min: 0 },
  maxBooksPerStaff: { type: Number, default: 3, min: 0 },

  reservationExpiryDays: { type: Number, default: 3, min: 1 },
  allowSelfReservation: { type: Boolean, default: true },

  sendDueReminders: { type: Boolean, default: true },
  reminderDaysBeforeDue: { type: Number, default: 3, min: 0 },

  autoSyncFinesToIncome: { type: Boolean, default: true },

  libraryName: { type: String, trim: true, default: 'School Library' }
}, { timestamps: true });

librarySettingsSchema.statics.getSettings = async function(tenantId) {
  let s = await this.findOne({ tenantId });
  if (!s) s = await this.create({ tenantId });
  return s;
};

module.exports = mongoose.model('LibrarySettings', librarySettingsSchema);
