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
 * Start 75 and each factor is rounded to whole points before adding; sales -15..+15 (half a point per 1 % change, capped at 30 %);
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

  // Round each factor first, so the rows in the panel always add up to the score.
  const points = [whole(salesPoints), whole(failedPoints), whole(latePoints)]
  const score = clamp(START + points[0] + points[1] + points[2], 0, 100)
  const label = score >= 70 ? 'Healthy' : score >= 50 ? 'Okay' : 'Needs a look'
  const tone = score >= 70 ? 'ok' : score >= 50 ? 'warn' : 'bad'

  const shown = Math.round(Math.abs(rawGrowth))
  const salesDetail = noGrowth
    ? 'No sales to compare yet'
    : Math.abs(rawGrowth) < 2
      ? 'About the same'
      : `${rawGrowth > 0 ? 'Up' : 'Down'} ${shown} %`

  return {
    score,
    label,
    tone,
    factors: [
      { label: `Sales compared with ${prevWord}`, detail: salesDetail, points: points[0] },
      {
        label: 'Payments that didn’t go through',
        detail: failed === 0 ? 'None' : failed < 0.001 ? 'Less than 0.1 % of payments' : `${(failed * 100).toFixed(1)} % of payments`,
        points: points[1],
      },
      {
        label: 'Late money to your bank',
        detail: late === 0 ? 'None' : `${late} late ${late === 1 ? 'payout' : 'payouts'}`,
        points: points[2],
      },
    ],
  }
}
