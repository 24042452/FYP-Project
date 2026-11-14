/** Date helpers. Business dates are 'YYYY-MM-DD' strings in Singapore time (UTC+8, no DST). */

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000

/**
 * The Singapore calendar date of a UTC instant.
 * @param {string} iso
 * @returns {string}
 */
export function sgtDate(iso) {
  return new Date(new Date(iso).getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * The Singapore hour (0–23) of a UTC instant.
 * @param {string} iso
 * @returns {number}
 */
export function sgtHour(iso) {
  return new Date(new Date(iso).getTime() + SGT_OFFSET_MS).getUTCHours()
}

/**
 * UTC ISO string for a Singapore local date + time.
 * @param {string} date YYYY-MM-DD
 * @param {number} hour
 * @param {number} minute
 * @param {number} [second]
 * @returns {string}
 */
export function sgtToIso(date, hour, minute, second = 0) {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hour, minute, second) - SGT_OFFSET_MS).toISOString()
}

/**
 * @param {string} date YYYY-MM-DD
 * @param {number} n
 * @returns {string}
 */
export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Inclusive list of dates from start to end.
 * @param {string} start YYYY-MM-DD
 * @param {string} end YYYY-MM-DD
 * @returns {string[]}
 */
export function eachDay(start, end) {
  /** @type {string[]} */
  const out = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

/**
 * 0 = Monday … 6 = Sunday.
 * @param {string} date YYYY-MM-DD
 * @returns {number}
 */
export function dayOfWeek(date) {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

/**
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
export function monthStart(date) {
  return `${date.slice(0, 7)}-01`
}

/**
 * First day of the month n months after the given date's month.
 * @param {string} date YYYY-MM-DD
 * @param {number} n
 * @returns {string}
 */
export function addMonths(date, n) {
  const [y, m] = date.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 10)
}

/**
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
export function monthEnd(date) {
  return addDays(addMonths(monthStart(date), 1), -1)
}
