const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/**
 * Format a monetary value as ₹X,XX,XXX (whole rupees, no decimals).
 * Handles null, undefined, NaN, and string inputs safely.
 */
export function formatCurrency(amount) {
  const num = Math.round(Number(amount) || 0)
  return currencyFormatter.format(num)
}
