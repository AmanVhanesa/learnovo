const mongoose = require('mongoose');

const backupLogSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  filename: {
    type: String,
    required: true
  },
  sizeBytes: {
    type: Number,
    default: 0
  },
  collectionsCount: {
    type: Number,
    default: 0
  },
  documentsCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success'
  },
  errorMessage: {
    type: String
  },
  type: {
    type: String,
    enum: ['manual', 'scheduled'],
    default: 'manual'
  },
  driveFileId: {
    type: String
  },
  storageLocation: {
    type: String,
    enum: ['local', 'google_drive'],
    default: 'google_drive'
  }
}, {
  timestamps: true
});

// Keep only last 20 backup logs per tenant (auto-cleanup via TTL or manual)
backupLogSchema.index({ tenantId: 1, createdAt: -1 });

module.exports = mongoose.model('BackupLog', backupLogSchema);
