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
 * Get next sequence number for a given counter and year.
 *
 * SMART SEEDING: If this is the FIRST time a counter is created for an
 * admission sequence on a tenant (counter doesn't exist yet), we first
 * scan all existing students for that tenant and seed the counter at the
 * highest numeric portion found in any admissionNumber. This ensures that
 * bulk-imported students (e.g. with ADM4000) are picked up automatically
 * and the next student gets ADM4001 — not ADM0001.
 *
 * @param {string} name - e.g. 'admission'
 * @param {string} year - e.g. '2025'
 * @param {ObjectId|null} tenantId
 */
counterSchema.statics.getNextSequence = async function (name, year, tenantId = null) {
  const filter = { name, year }
  if (tenantId) filter.tenantId = tenantId

  // ── Smart seed on first use ──────────────────────────────────────────────
  // Only applies to admission counters. If the counter doesn't exist yet,
  // scan all existing students and seed at the highest admission number found.
  if (name === 'admission' && tenantId) {
    const exists = await this.findOne(filter).lean()

    if (!exists) {
      // Find the highest trailing number in any existing admissionNumber
      const User = mongoose.model('User')
      const students = await User.find(
        { tenantId, role: 'student', admissionNumber: { $exists: true, $nin: [null, ''] } },
        { admissionNumber: 1 }
      ).lean()

      let maxSeq = 0
      for (const s of students) {
        // Matches trailing digits: handles ADM001, ADM20250001, 4000, 1500, etc.
        const match = s.admissionNumber && s.admissionNumber.match(/(\d+)$/)
        if (match) {
          const num = parseInt(match[1], 10)
          if (num > maxSeq) maxSeq = num
        }
      }

      // Seed the counter at maxSeq. Use insertOne; if another request beat us
      // here (race condition), ignore the duplicate key error and fall through.
      try {
        await this.collection.insertOne({
          name,
          year,
          tenantId,
          sequence: maxSeq,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      } catch (dupErr) {
        // Counter was created by a concurrent request — that's fine, fall through
        if (dupErr.code !== 11000) throw dupErr
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  // Standard atomic increment
  const counter = await this.findOneAndUpdate(
    filter,
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  )

  return counter.sequence
}

/**
 * Force-reset (or seed) the admission counter for a tenant to a specific value.
 * Useful after a bulk import to realign the counter.
 * @param {ObjectId} tenantId
 * @param {number} value - The counter will produce value+1 on next call
 */
counterSchema.statics.seedAdmissionCounter = async function (tenantId, value, year) {
  const yr = year || new Date().getFullYear().toString()
  await this.findOneAndUpdate(
    { name: 'admission', year: yr, tenantId },
    { $set: { sequence: value } },
    { upsert: true }
  )
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
