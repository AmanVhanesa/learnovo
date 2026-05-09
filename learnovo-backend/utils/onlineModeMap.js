/**
 * Map a payment-gateway-reported method/mode string onto our
 * Payment.transactionDetails.onlineMode enum:
 *   'UPI' | 'NEFT' | 'IMPS' | 'RTGS' | 'Net Banking' | 'Other'
 *
 * Returns undefined when the input is empty/unknown so callers can
 * choose to leave the sub-field unset.
 */
function mapOnlineMode(raw) {
  if (raw === undefined || raw === null) return undefined;
  const s = String(raw).toUpperCase().trim();
  if (!s) return undefined;

  if (s === 'UPI' || s.includes('UPI')) return 'UPI';
  if (s === 'NEFT') return 'NEFT';
  if (s === 'IMPS') return 'IMPS';
  if (s === 'RTGS') return 'RTGS';
  if (s === 'NB' || s === 'NETBANKING' || s.includes('NET BANKING') || s.includes('NETBANKING')) return 'Net Banking';
  // Card / wallet / emi / paylater / unknown → Other
  return 'Other';
}

module.exports = { mapOnlineMode };
