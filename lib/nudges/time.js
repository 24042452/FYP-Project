import { sgtDate } from '../dates.js'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** @param {number} n @param {string} unit */
const unit = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`

/**
 * Plain relative time ("5 minutes ago", "2 hours ago", "3 days ago"); older than a week shows the Singapore date.
 * @param {string} iso UTC instant
 * @param {string} nowIso UTC instant
 * @returns {string}
 */
export function timeAgo(iso, nowIso) {
  const secs = Math.floor((new Date(nowIso).getTime() - new Date(iso).getTime()) / 1000)
  if (!Number.isFinite(secs) || secs < 60) return 'Just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return unit(mins, 'minute')
  const hours = Math.floor(mins / 60)
  if (hours < 24) return unit(hours, 'hour')
  const days = Math.floor(hours / 24)
  if (days < 7) return unit(days, 'day')
  const [, m, d] = sgtDate(iso).split('-').map(Number)
  return `${d} ${MONTH_SHORT[m - 1]}`
}
