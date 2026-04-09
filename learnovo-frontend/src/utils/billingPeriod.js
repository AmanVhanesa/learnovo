const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const QUARTER_LABELS = {
  1: 'Apr-Jun',
  2: 'Jul-Sep',
  3: 'Oct-Dec',
  4: 'Jan-Mar',
}

export function buildBillingPeriod(frequency, { billingMonth, billingQuarter, billingYear }) {
  const normalized = frequency.charAt(0).toUpperCase() + frequency.slice(1).toLowerCase()

  if (normalized === 'Monthly') {
    return {
      month: billingMonth,
      year: billingYear,
      displayText: `${MONTH_NAMES[billingMonth - 1]} ${billingYear}`,
    }
  }

  if (normalized === 'Quarterly') {
    return {
      quarter: billingQuarter,
      year: billingYear,
      displayText: `Q${billingQuarter} ${billingYear} (${QUARTER_LABELS[billingQuarter]})`,
    }
  }

  if (normalized === 'Annual') {
    return {
      year: billingYear,
      displayText: `Academic Year ${billingYear}-${billingYear + 1}`,
    }
  }

  return null
}

export function normalizeFrequency(raw) {
  if (!raw) return 'One-time'
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}
