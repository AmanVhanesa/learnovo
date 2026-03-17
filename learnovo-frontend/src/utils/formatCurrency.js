const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
})

export function formatCurrency(amount) {
  return currencyFormatter.format(amount || 0)
}
