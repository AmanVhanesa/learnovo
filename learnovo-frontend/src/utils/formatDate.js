/**
 * Centralised date formatting helpers.
 * Always uses 'en-IN' locale so dates render as dd/mm/yyyy on every OS.
 */

const LOCALE = 'en-IN'

/** dd/mm/yyyy  e.g. 28/03/2026 */
export function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(LOCALE)
}

/** 28 Mar 2026 */
export function formatDateShort(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
}

/** 28 March 2026 */
export function formatDateLong(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** 28 Mar 2026, 2:30 pm */
export function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(LOCALE, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

/** 28 Mar */
export function formatDateCompact(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
}

/** March 2026 */
export function formatMonthYear(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' })
}
