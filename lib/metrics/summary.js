import { CHANNELS, CHANNEL_LABELS } from '../channels.js'
import { dayOfWeek, eachDay } from '../dates.js'

/**
 * @typedef {import('../channels.js').Channel} Channel
 * @typedef {{day: string, channel: Channel, grossCents: number, txnCount: number, failedCount: number}} DailySalesRow
 */

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/**
 * Totals across daily sales rows.
 * @param {DailySalesRow[]} rows
 * @returns {{grossCents: number, txnCount: number, failedCount: number, avgTicketCents: number}}
 */
export function summarise(rows) {
  let grossCents = 0
  let txnCount = 0
  let failedCount = 0
  for (const r of rows) {
    grossCents += r.grossCents
    txnCount += r.txnCount
    failedCount += r.failedCount
  }
  const avgTicketCents = txnCount > 0 ? Math.round(grossCents / txnCount) : 0
  return { grossCents, txnCount, failedCount, avgTicketCents }
}

/**
 * Difference between two periods. pct is null when the previous value is 0.
 * @param {number} curr
 * @param {number} prev
 * @returns {{deltaCents: number, pct: number | null}}
 */
export function comparePeriods(curr, prev) {
  const deltaCents = curr - prev
  return { deltaCents, pct: prev === 0 ? null : (deltaCents * 100) / prev }
}

/**
 * Gross sales per day from `from` to `to` inclusive, with missing days as 0.
 * @param {DailySalesRow[]} rows
 * @param {string} from
 * @param {string} to
 * @returns {{day: string, label: string, grossCents: number}[]}
 */
export function dailySeries(rows, from, to) {
  /** @type {Map<string, number>} */
  const byDay = new Map()
  for (const r of rows) byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.grossCents)
  return eachDay(from, to).map((day) => ({
    day,
    label: WEEKDAY_SHORT[dayOfWeek(day)],
    grossCents: byDay.get(day) ?? 0,
  }))
}

/**
 * Share of gross sales per channel, largest first. Empty when there are no sales.
 * @param {DailySalesRow[]} rows
 * @returns {{channel: Channel, label: string, share: number}[]}
 */
export function channelMix(rows) {
  /** @type {Map<Channel, number>} */
  const totals = new Map()
  let total = 0
  for (const r of rows) {
    totals.set(r.channel, (totals.get(r.channel) ?? 0) + r.grossCents)
    total += r.grossCents
  }
  if (total <= 0) return []
  return CHANNELS.filter((c) => (totals.get(c) ?? 0) > 0)
    .map((channel) => ({
      channel,
      label: CHANNEL_LABELS[channel],
      share: /** @type {number} */ (totals.get(channel)) / total,
    }))
    .sort((a, b) => b.share - a.share) // stable sort keeps CHANNELS order on ties
}

/**
 * @param {number} h 0-23
 * @returns {string}
 */
function hourLabel(h) {
  const n = ((h % 24) + 24) % 24
  const suffix = n < 12 ? 'am' : 'pm'
  return `${n % 12 === 0 ? 12 : n % 12}${suffix}`
}

/**
 * The day and hour with the highest sales, e.g. 'Friday 12pm–1pm'. dow 0 = Monday.
 * @param {{dow: number, hour: number, grossCents: number}[]} heat
 * @returns {{label: string} | null}
 */
export function busiestSlot(heat) {
  /** @type {{dow: number, hour: number, grossCents: number} | null} */
  let best = null
  for (const h of heat) {
    if (h.grossCents > 0 && (best === null || h.grossCents > best.grossCents)) best = h
  }
  if (!best) return null
  return { label: `${WEEKDAY_LONG[best.dow]} ${hourLabel(best.hour)}–${hourLabel(best.hour + 1)}` }
}

