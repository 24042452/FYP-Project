import { addDays, addMonths, dayOfWeek, monthEnd, monthStart } from '../dates.js'

/**
 * Understand everyday time words in a question ("last week", "on Friday", "in October") for the no-AI
 * (rules) assistant. Dates are Singapore dates, 'YYYY-MM-DD'.
 */

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT_MONTHS = MONTH_NAMES.map((m) => m.slice(0, 3))
const SHORT_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * 'Wed 11 Nov'.
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
export function formatDay(date) {
  const [, m, d] = date.split('-').map(Number)
  return `${SHORT_WEEKDAYS[dayOfWeek(date)]} ${d} ${SHORT_MONTHS[m - 1]}`
}

/**
 * 'Mon 2 Nov–Sun 8 Nov', or just one day when from equals to.
 * @param {string} from
 * @param {string} to
 * @returns {string}
 */
export function formatRange(from, to) {
  return from === to ? formatDay(from) : `${formatDay(from)}–${formatDay(to)}`
}

/**
 * @param {string} date YYYY-MM-DD
 * @returns {string} 'October'
 */
export function monthName(date) {
  return MONTH_NAMES[Number(date.slice(5, 7)) - 1]
}

/**
 * Turn a time phrase in `text` into a date range. Returns null when there is none.
 * Understands: today, yesterday, this week, last week, this month, last month, past/last N days,
 * weekday names ("on Friday" = the most recent one, today counts), and "in <Month>" (the most recent one).
 * Weeks run Monday to Sunday; "this week" and "this month" end today.
 * @param {string} text
 * @param {string} today YYYY-MM-DD (Singapore)
 * @returns {{from: string, to: string, label: string} | null}
 */
export function parseTimePhrase(text, today) {
  const t = String(text ?? '').toLowerCase()

  if (/\blast week\b/.test(t)) {
    const thisMon = addDays(today, -dayOfWeek(today))
    return { from: addDays(thisMon, -7), to: addDays(thisMon, -1), label: 'last week' }
  }
  if (/\bthis week\b/.test(t)) {
    return { from: addDays(today, -dayOfWeek(today)), to: today, label: 'this week' }
  }
  if (/\blast month\b/.test(t)) {
    const from = addMonths(monthStart(today), -1)
    return { from, to: monthEnd(from), label: 'last month' }
  }
  if (/\bthis month\b/.test(t)) {
    return { from: monthStart(today), to: today, label: 'this month' }
  }
  const n = t.match(/\b(?:past|last)\s+(\d{1,3})\s+days?\b/)
  if (n) {
    const days = Math.min(366, Math.max(1, Number(n[1])))
    return { from: addDays(today, -(days - 1)), to: today, label: `in the last ${days} days` }
  }
  if (/\b(?:past|last) week\b/.test(t)) {
    return { from: addDays(today, -6), to: today, label: 'in the last 7 days' }
  }
  if (/\btoday\b/.test(t)) return { from: today, to: today, label: 'today' }
  if (/\byesterday\b/.test(t)) {
    const y = addDays(today, -1)
    return { from: y, to: y, label: 'yesterday' }
  }

  const mon = t.match(/\b(?:in|for|during|of|my)\s+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b/)
  if (mon) {
    const idx = MONTHS.findIndex((m) => m.startsWith(mon[1].slice(0, 3)))
    const thisYear = Number(today.slice(0, 4))
    const thisMonth = Number(today.slice(5, 7))
    const year = idx + 1 <= thisMonth ? thisYear : thisYear - 1
    const from = `${year}-${String(idx + 1).padStart(2, '0')}-01`
    const end = monthEnd(from)
    return { from, to: end < today ? end : today, label: `in ${MONTH_NAMES[idx]}` }
  }

  const wd = t.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)
  if (wd) {
    const idx = WEEKDAYS.indexOf(wd[1])
    const back = (dayOfWeek(today) - idx + 7) % 7
    const day = addDays(today, -back)
    return { from: day, to: day, label: `on ${WEEKDAY_NAMES[idx]}` }
  }
  return null
}
