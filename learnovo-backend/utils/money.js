/**
 * Money utility functions for safe arithmetic, comparisons, and formatting.
 *
 * Learnovo stores amounts as JS Numbers in whole Indian Rupees.
 * IEEE 754 doubles are exact for integers up to 2^53, so whole-rupee
 * storage is safe. The risk is only in intermediate calculations
 * involving percentages or division. These helpers ensure every
 * calculation boundary rounds correctly and every comparison uses
 * a tolerance to avoid floating-point dust.
 */

/**
 * Parse any value to a safe JS number.
 * Handles Decimal128 objects, strings, null, undefined.
 */
function toNumber(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'object' && val.toString) {
    return parseFloat(val.toString()) || 0;
  }
  return parseFloat(val) || 0;
}

/**
 * Round to nearest whole rupee (for final charges to students).
 */
function roundToRupee(val) {
  return Math.round(toNumber(val));
}

/**
 * Round to 2 decimal places (for intermediate calculations).
 * Uses integer math to avoid floating-point errors in the rounding itself.
 */
function roundTo2(val) {
  return Math.round(toNumber(val) * 100) / 100;
}

/**
 * Safe money equality check — true if amounts differ by less than ₹0.01.
 */
function moneyEquals(a, b) {
  return Math.abs(toNumber(a) - toNumber(b)) < 0.01;
}

/**
 * Safe "fully paid" check — true if paid covers total within ₹0.01 tolerance.
 */
function isFullyPaid(paid, total) {
  return toNumber(paid) >= toNumber(total) - 0.01;
}

/**
 * Safe balance calculation: total + lateFee - paid, rounded to whole rupee.
 * Clamps to 0 (no negative balances from floating-point dust).
 */
function calcBalance(total, lateFee, paid) {
  const balance = roundToRupee(toNumber(total) + toNumber(lateFee) - toNumber(paid));
  return Math.max(0, balance);
}

/**
 * Sum an array of monetary values safely.
 */
function sumMoney(values) {
  return roundToRupee(values.reduce((sum, v) => sum + toNumber(v), 0));
}

/**
 * Calculate percentage amount, rounded to 2 decimals.
 * e.g., percentOf(15000, 33.33) → 4999.50
 */
function percentOf(amount, percent) {
  return roundTo2(toNumber(amount) * toNumber(percent) / 100);
}

/**
 * Validate that a value is a finite positive number within a sane range.
 * Max ₹1 crore by default. Returns the validated number or throws.
 */
function validateAmount(val, { field = 'amount', min = 0.01, max = 10000000 } = {}) {
  const num = toNumber(val);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    throw new Error(`${field}: invalid amount`);
  }
  if (num < min) {
    throw new Error(`${field}: must be at least ₹${min}`);
  }
  if (num > max) {
    throw new Error(`${field}: exceeds maximum of ₹${max}`);
  }
  return num;
}

/**
 * Format for display: ₹1,50,000
 */
function formatRupee(val) {
  return `₹${roundToRupee(val).toLocaleString('en-IN')}`;
}

// --- Payment Gateway helpers (stubs for future Razorpay/Stripe integration) ---

/**
 * Convert rupees to paise (integer) for payment gateways.
 */
function rupeesToPaise(rupees) {
  return Math.round(toNumber(rupees) * 100);
}

/**
 * Convert paise (integer) back to rupees.
 */
function paiseToRupees(paise) {
  return Math.round(Number(paise)) / 100;
}

module.exports = {
  toNumber,
  roundToRupee,
  roundTo2,
  moneyEquals,
  isFullyPaid,
  calcBalance,
  sumMoney,
  percentOf,
  validateAmount,
  formatRupee,
  rupeesToPaise,
  paiseToRupees
};
