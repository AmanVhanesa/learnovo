const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  // Multi-tenant support
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },

  name: {
    type: String,
    required: [true, 'Room name is required'],
    trim: true
  },
  code: {
    type: String,
    trim: true,
    uppercase: true
  },
  type: {
    type: String,
    enum: ['classroom', 'lab', 'auditorium', 'library', 'sports', 'other'],
    default: 'classroom'
  },
  building: {
    type: String,
    trim: true
  },
  floor: {
    type: Number
  },
  capacity: {
    type: Number,
    min: 1,
    default: 40
  },
  facilities: {
    type: [String]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
roomSchema.index({ tenantId: 1, name: 1 }, { unique: true });
roomSchema.index({ tenantId: 1, type: 1 });
roomSchema.index({ tenantId: 1, isActive: 1 });

module.exports = mongoose.model('Room', roomSchema);
