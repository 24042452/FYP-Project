/**
 * @param {number} n
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

/**
 * Simple 0-100 business health score.
 * @param {{growthPct: number | null, failedRate: number, delayedSettlements: number}} i
 * @returns {{score: number, label: 'Good' | 'Okay' | 'Needs attention'}}
 */
export function healthScore({ growthPct, failedRate, delayedSettlements }) {
  const growth = clamp(growthPct ?? 0, -20, 20)
  const score = Math.round(clamp(70 + growth - failedRate * 1000 - 5 * delayedSettlements, 0, 100))
  const label = score >= 75 ? 'Good' : score >= 50 ? 'Okay' : 'Needs attention'
  return { score, label }
}
