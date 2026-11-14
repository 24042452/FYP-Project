// Pure maths for the check-up progress bar. The check-up is one server request, so progress is an
// estimate: it eases out towards 90% and only the real answer takes it to 100%.

/** The steps shown while the check-up runs, in plain words. */
export const CHECKUP_STEPS = [
  'Adding up your sales',
  'Matching sales with money to your bank',
  'Checking your NETS bill',
  'Looking at payments that didn’t go through',
  'Saving your results',
]

export const DEFAULT_ESTIMATE_MS = 6000
const MIN_ESTIMATE_MS = 1500
const MAX_ESTIMATE_MS = 60000
/** The bar never passes this until the check-up has really finished. */
export const MAX_PENDING_PERCENT = 90
/** Ease-out speed: at the estimated time the bar is about 86% of the way to the cap. */
const EASE = 3

/**
 * How long to tell the person it will take: the last run's real time if we have one, else 6 seconds.
 * @param {unknown} stored text or number from localStorage
 * @returns {number} milliseconds
 */
export function estimateFromStored(stored) {
  const n = typeof stored === 'number' ? stored : typeof stored === 'string' && stored.trim() !== '' ? Number(stored) : NaN
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ESTIMATE_MS
  return Math.min(MAX_ESTIMATE_MS, Math.max(MIN_ESTIMATE_MS, n))
}

/**
 * Where the bar is after `elapsedMs`. Safe with bad numbers: always finite and within range.
 * @param {number} elapsedMs
 * @param {number} estimateMs
 * @returns {{percent: number, stepIndex: number, secondsLeft: number, almostDone: boolean}}
 */
export function progressAt(elapsedMs, estimateMs) {
  const elapsed = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0
  const estimate = Number.isFinite(estimateMs) && estimateMs > 0 ? estimateMs : DEFAULT_ESTIMATE_MS
  const percent = Math.min(MAX_PENDING_PERCENT, MAX_PENDING_PERCENT * (1 - Math.exp((-EASE * elapsed) / estimate)))
  const stepIndex = Math.min(CHECKUP_STEPS.length - 1, Math.floor((percent / MAX_PENDING_PERCENT) * CHECKUP_STEPS.length))
  const leftMs = estimate - elapsed
  const secondsLeft = leftMs <= 0 ? 0 : Math.max(1, Math.ceil(leftMs / 1000))
  return { percent, stepIndex, secondsLeft, almostDone: leftMs <= estimate * 0.2 }
}

/**
 * "Checked in 3 seconds", or '' when the duration is not usable.
 * @param {unknown} ms
 * @returns {string}
 */
export function describeDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return ''
  const s = Math.round(ms / 1000)
  if (s < 1) return 'Checked in less than a second'
  const unit = (/** @type {number} */ n, /** @type {string} */ w) => `${n} ${w}${n === 1 ? '' : 's'}`
  if (s < 60) return `Checked in ${unit(s, 'second')}`
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `Checked in ${unit(m, 'minute')}${rest ? ` ${unit(rest, 'second')}` : ''}`
}
