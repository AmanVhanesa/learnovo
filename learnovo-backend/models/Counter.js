const mongoose = require('mongoose')

/**
 * Counter Model
 * Tracks sequential numbers for various entities (admission numbers, receipt numbers, etc.)
 */
const counterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Counter name is required'],
    trim: true
  },
  year: {
    type: String,
    required: [true, 'Year is required'],
    trim: true
  },
  sequence: {
    type: Number,
    required: [true, 'Sequence number is required'],
    default: 0
  },
  // Optional: Track per-tenant if needed
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  }
}, {
  timestamps: true
})

// Compound index for efficient lookups
counterSchema.index({ name: 1, year: 1 })
counterSchema.index({ name: 1, year: 1, tenantId: 1 })

/**
 * Get next sequence number for a given counter and year
 * Creates counter if it doesn't exist
 */
counterSchema.statics.getNextSequence = async function(name, year, tenantId = null) {
  const filter = { name, year }
  if (tenantId) filter.tenantId = tenantId

  const counter = await this.findOneAndUpdate(
    filter,
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  )

  return counter.sequence
}

/**
 * Format admission number from sequence
 */
counterSchema.statics.formatAdmissionNumber = (sequence, year) => {
  const paddedSequence = String(sequence).padStart(4, '0')
  return `ADM-${year}-${paddedSequence}`
}

/**
 * Format receipt number from sequence
 */
counterSchema.statics.formatReceiptNumber = (sequence, year) => {
  const paddedSequence = String(sequence).padStart(6, '0')
  return `REC-${year}-${paddedSequence}`
}

module.exports = mongoose.model('Counter', counterSchema)

