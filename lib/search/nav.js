import { fromApiTransaction } from '../transactions/api.js'
import { toRowView } from '../transactions/format.js'

// Pure helpers shared by the desktop combobox and the phone search sheet.

/** Fewest characters before we search. */
export const MIN_CHARS = 2

/** @param {string} text */
export const shouldSearch = (text) => text.trim().length >= MIN_CHARS

/**
 * Move the highlight through the result rows and then the "See all results" footer, wrapping round.
 * Stops are 0..rowCount-1 (rows) and rowCount (footer); -1 is "nothing highlighted".
 * @param {number} current
 * @param {'up' | 'down'} dir
 * @param {number} rowCount
 * @param {boolean} [hasFooter]
 * @returns {number}
 */
export function moveHighlight(current, dir, rowCount, hasFooter = true) {
  const stops = rowCount + (hasFooter ? 1 : 0)
  if (stops === 0) return -1
  if (dir === 'down') return current >= stops - 1 ? 0 : current + 1
  return current <= 0 ? stops - 1 : current - 1
}

/** @param {string} q */
export const searchHref = (q) => `/transactions?${new URLSearchParams({ q: q.trim() })}`

/** @param {string} id */
export const rowHref = (id) => `/transactions?id=${encodeURIComponent(id)}`

/**
 * One suggestion row from an /api/v1/transactions item.
 * @param {ReturnType<import('../transactions/api.js').toApiTransaction>} apiRow
 */
export function suggestionView(apiRow) {
  return toRowView(fromApiTransaction(apiRow))
}

/**
 * The plain-words line above the payments list.
 * @param {{q?: string, from: string, to: string, explicitDates: boolean, formatDay: (d: string) => string}} a
 * @returns {string}
 */
export function rangeLine({ q, from, to, explicitDates, formatDay }) {
  if (q && !explicitDates) return `Payments matching '${q}' in the last 12 months.`
  const span = `from ${formatDay(from)} to ${formatDay(to)}`
  if (q) return `Payments matching '${q}' ${span}.`
  return `Payments ${span}${explicitDates ? '' : ' (the last 7 days)'}.`
}
