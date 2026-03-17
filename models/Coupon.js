const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  description: { type: String, trim: true },

  discountType: { type: String, enum: ['percentage', 'flat'], required: true },
  discountValue: { type: Number, required: true },

  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },

  maxUsageCount: { type: Number, default: null }, // null = unlimited
  currentUsageCount: { type: Number, default: 0 },

  applicablePlans: [{ type: String }], // empty = all plans
  specificTenants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }], // empty = all tenants

  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'SuperAdmin' }
}, { timestamps: true });

couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
