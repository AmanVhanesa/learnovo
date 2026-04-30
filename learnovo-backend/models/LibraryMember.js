const mongoose = require('mongoose');

const libraryMemberSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  membershipNumber: { type: String, required: true, trim: true, uppercase: true },
  memberType: {
    type: String,
    enum: ['student', 'teacher', 'staff', 'employee'],
    required: true
  },

  joinDate: { type: Date, default: Date.now },
  expiryDate: { type: Date },

  maxBooksAllowed: { type: Number, default: 3, min: 0 },
  currentBooksIssued: { type: Number, default: 0, min: 0 },
  totalBooksIssued: { type: Number, default: 0, min: 0 },
  totalFinesPaid: { type: Number, default: 0, min: 0 },

  status: {
    type: String,
    enum: ['active', 'suspended', 'expired', 'inactive'],
    default: 'active',
    index: true
  }
}, { timestamps: true });

libraryMemberSchema.index({ tenantId: 1, userId: 1 }, { unique: true });
libraryMemberSchema.index({ tenantId: 1, membershipNumber: 1 }, { unique: true });

module.exports = mongoose.model('LibraryMember', libraryMemberSchema);
