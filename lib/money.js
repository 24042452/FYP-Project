const fmt = new Intl.NumberFormat('en-SG', {
  style: 'currency',
  currency: 'SGD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Format integer cents as SGD for display, e.g. 421000 -> "$4,210.00".
 * @param {number} cents
 * @returns {string}
 */
export function formatSGD(cents) {
  const out = fmt.format(Math.abs(cents) / 100).replace(/S\$|SGD\s?/, '$')
  return cents < 0 ? `-${out}` : out
}
