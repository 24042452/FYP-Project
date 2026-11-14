/**
 * @param {number} n
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

/** Non-finite numbers (NaN, Infinity) count as 0. @param {unknown} n @returns {number} */
const finite = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)

/** Whole number, half away from zero, never -0. @param {number} n @returns {number} */
const whole = (n) => Math.sign(n) * Math.round(Math.abs(n)) + 0

const START = 75

/**
 * Gentle 0-100 business health score with the working shown.
 * Start 75; sales -15..+15 (half a point per 1 % change, capped at 30 %);
 * failed payments -5 per 1 % (max -15); late payouts -3 each (max -12).
 * @param {{growthPct: number | null, failedRate: number, delayedSettlements: number}} i
 * @param {string} [prevWord] what sales were compared with: 'last week' | 'last month' | 'yesterday'
 * @returns {{score: number, label: 'Healthy' | 'Okay' | 'Needs a look', tone: 'ok' | 'warn' | 'bad',
 *   factors: {label: string, detail: string, points: number}[]}}
 */
export function healthScore({ growthPct, failedRate, delayedSettlements }, prevWord = 'last week') {
  const noGrowth = growthPct === null || growthPct === undefined || !Number.isFinite(growthPct)
  const rawGrowth = noGrowth ? 0 : growthPct
  const salesPoints = clamp(rawGrowth, -30, 30) / 2

  const failed = Math.max(0, finite(failedRate))
  const failedPoints = -Math.min(15, failed * 500)

  const late = Math.max(0, Math.floor(finite(delayedSettlements)))
  const latePoints = -Math.min(12, 3 * late)

  const score = Math.round(clamp(START + salesPoints + failedPoints + latePoints, 0, 100))
  const label = score >= 70 ? 'Healthy' : score >= 50 ? 'Okay' : 'Needs a look'
  const tone = score >= 70 ? 'ok' : score >= 50 ? 'warn' : 'bad'

  const shown = Math.round(Math.abs(rawGrowth))
  const salesDetail = noGrowth
    ? 'No sales to compare yet'
    : shown < 2
      ? 'About the same'
      : `${rawGrowth > 0 ? 'Up' : 'Down'} ${shown} %`

  return {
    score,
    label,
    tone,
    factors: [
      { label: `Sales compared with ${prevWord}`, detail: salesDetail, points: whole(salesPoints) },
      {
        label: 'Payments that didn’t go through',
        detail: failed > 0 ? `${(failed * 100).toFixed(1)} % of payments` : 'None',
        points: whole(failedPoints),
      },
      {
        label: 'Late money to your bank',
        detail: late === 0 ? 'None' : `${late} late ${late === 1 ? 'payout' : 'payouts'}`,
        points: whole(latePoints),
      },
    ],
  }
}
