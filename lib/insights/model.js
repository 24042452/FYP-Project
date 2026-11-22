// Insights: patterns in a merchant's sales (best days, busy and quiet hours, the monthly trend, how customers
// pay, and each outlet's share), with plain-English findings on top. Pure: the page loads the rows.
import { addDays, addMonths, dayOfWeek, monthStart } from '../dates.js'
import { formatSGD } from '../money.js'
import { CHANNELS, CHANNEL_LABELS } from '../channels.js'
import { monthName, shortDay } from '../recon/reconcile.js'

/**
 * @typedef {import('../metrics/summary.js').DailySalesRow} DailySalesRow
 * @typedef {'4w' | '3m' | '6m'} RangeKey
 * @typedef {{title: string, text: string, tone: 'info' | 'tip'}} Finding
 */

/** Each range is whole weeks, so every weekday appears the same number of times. */
export const RANGES = /** @type {const} */ ({
  '4w': { days: 28, label: 'Last 4 weeks' },
  '3m': { days: 91, label: 'Last 3 months' },
  '6m': { days: 182, label: 'Last 6 months' },
})
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** @param {unknown} v @returns {RangeKey} */
export function parseRange(v) {
  return v === '4w' || v === '6m' ? v : '3m'
}

/**
 * The dates the page loads: the pattern range (whole weeks ending yesterday, so today's half-day does not drag
 * the averages down) and the monthly trend (the last 6 full months plus this month so far).
 * @param {RangeKey} range @param {string} today YYYY-MM-DD
 */
export function insightDates(range, today) {
  const to = addDays(today, -1)
  const from = addDays(to, -(RANGES[range].days - 1))
  const trendFrom = addMonths(monthStart(today), -6)
  return { from, to, trendFrom, loadFrom: from < trendFrom ? from : trendFrom }
}

/** @param {number} h 0-23 @returns {string} '12 pm', '3 pm', '9 am' */
export const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 || h === 24 ? 'am' : 'pm'}`
/** @param {number} h @returns {string} '12p', '3p', '9a' (chart ticks) */
const hourTick = (h) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`
/** @param {number} cents @returns {string} '$848' */
const dollars = (cents) => `$${Math.round(cents / 100).toLocaleString('en-SG')}`
/** @param {number} n */
const pct = (n) => Math.round(n)

/** A busy 3-hour stretch gets a meal name when it starts at a meal time. @param {number} start */
function mealName(start) {
  if (start >= 6 && start <= 8) return 'Breakfast'
  if (start >= 10 && start <= 12) return 'Lunch'
  if (start >= 16 && start <= 18) return 'Dinner'
  return null
}

/**
 * The best `len`-hour stretch inside the open hours, skipping hours already used.
 * @param {number[]} byHour cents per hour 0-23 @param {number} len @param {Set<number>} used
 * @param {'max' | 'min'} want @param {number} first @param {number} last open span (inclusive)
 */
function window(byHour, len, used, want, first, last) {
  let best = null
  for (let s = first; s + len - 1 <= last; s++) {
    const hours = Array.from({ length: len }, (_, i) => s + i)
    if (hours.some((h) => used.has(h))) continue
    const sum = hours.reduce((t, h) => t + byHour[h], 0)
    if (!best || (want === 'max' ? sum > best.sum : sum < best.sum)) best = { start: s, end: s + len, sum }
  }
  return best
}

/**
 * @param {{
 *   range: RangeKey, today: string,
 *   rows: DailySalesRow[] daily sales per channel from insightDates().loadFrom to today,
 *   heat: {dow: number, hour: number, grossCents: number}[] for the pattern range,
 *   outlets?: {id: string, name: string, grossCents: number}[] for the pattern range; shown when 2 or more
 * }} input
 */
export function buildInsightsModel({ range, today, rows, heat, outlets = [] }) {
  const { from, to, trendFrom } = insightDates(range, today)
  const inRange = rows.filter((r) => r.day >= from && r.day <= to)
  const total = inRange.reduce((t, r) => t + r.grossCents, 0)
  const weeks = RANGES[range].days / 7

  // Best days: average sales per weekday.
  const dayTotals = Array(7).fill(0)
  for (const r of inRange) dayTotals[dayOfWeek(r.day)] += r.grossCents
  const dayAvg = dayTotals.map((c) => c / weeks)
  const order = [...dayAvg.keys()].sort((a, b) => dayAvg[b] - dayAvg[a])
  const [top, second] = order
  const bestDays = dayAvg[second] >= dayAvg[top] * 0.95 ? [top, second].sort((a, b) => a - b) : [top]
  const quietDay = order[6]

  // Hours.
  const byHour = Array(24).fill(0)
  for (const h of heat) byHour[h.hour] += h.grossCents
  const heatTotal = byHour.reduce((t, c) => t + c, 0)
  const open = byHour.map((c, h) => (heatTotal > 0 && c / heatTotal >= 0.005 ? h : -1)).filter((h) => h >= 0)
  const first = open[0] ?? 0
  const last = open.at(-1) ?? 23
  const used = new Set()
  const rush = heatTotal > 0 ? window(byHour, 3, used, 'max', first, last) : null
  if (rush) for (let h = rush.start; h < rush.end; h++) used.add(h)
  const rush2 = rush ? window(byHour, 3, used, 'max', first, last) : null
  const rushShare = rush ? (rush.sum * 100) / heatTotal : 0
  const rush2Share = rush2 ? (rush2.sum * 100) / heatTotal : 0
  const second2 = rush2 && rush2Share >= 15 ? rush2 : null
  if (second2) for (let h = second2.start; h < second2.end; h++) used.add(h)
  // Quiet: the slowest 2 hours between the first and last busy hour (opening and closing hours are always slow).
  const quiet = heatTotal > 0 ? window(byHour, 2, used, 'min', first + 1, last - 1) : null
  const quietShare = quiet ? (quiet.sum * 100) / heatTotal : 0
  const isQuiet = quiet !== null && quietShare < (2 * 100) / Math.max(1, last - first + 1) / 2

  /** @type {Finding[]} */
  const findings = []
  if (total > 0) {
    const named = bestDays.map((d) => `${DAY_NAMES[d]}s`).join(' and ')
    const bestAvg = bestDays.reduce((t, d) => t + dayAvg[d], 0) / bestDays.length
    const others = dayAvg.filter((_, d) => !bestDays.includes(d))
    const otherAvg = others.reduce((t, c) => t + c, 0) / others.length
    findings.push({
      title: bestDays.length > 1 ? `${named} are your best days` : `${DAY_NAMES[bestDays[0]]} is your best day`,
      text: `About ${dollars(bestAvg)} a day, ${pct(((bestAvg - otherAvg) * 100) / otherAvg)}% more than other days.`,
      tone: 'info',
    })
  }
  if (rush) {
    const meal = mealName(rush.start)
    let text = `${hourLabel(rush.start)} to ${hourLabel(rush.end)} brings in ${pct(rushShare)}% of your sales.`
    if (second2) {
      const meal2 = mealName(second2.start)
      text += ` ${meal2 ? `${meal2} (${hourLabel(second2.start)} to ${hourLabel(second2.end)})` : `${hourLabel(second2.start)} to ${hourLabel(second2.end)}`} brings ${pct(rush2Share)}%.`
    }
    findings.push({ title: meal ? `${meal} is your rush` : `Your rush is ${hourLabel(rush.start)} to ${hourLabel(rush.end)}`, text, tone: 'info' })
  }
  if (quiet && isQuiet) {
    findings.push({
      title: `${hourLabel(quiet.start)} to ${hourLabel(quiet.end)} is quiet`,
      text: `Only ${Math.max(1, pct(quietShare))}% of your sales. A deal at that time could bring more customers in.`,
      tone: 'tip',
    })
  }

  // Monthly trend: the last 6 full months and this month so far.
  const thisMonth = today.slice(0, 7)
  /** @type {Map<string, number>} */
  const byMonth = new Map()
  for (let m = trendFrom; m.slice(0, 7) <= thisMonth; m = addMonths(m, 1)) byMonth.set(m.slice(0, 7), 0)
  for (const r of rows) {
    const k = r.day.slice(0, 7)
    if (byMonth.has(k)) byMonth.set(k, /** @type {number} */ (byMonth.get(k)) + r.grossCents)
  }
  const months = [...byMonth].map(([m, cents]) => ({ key: m, label: monthName(m).slice(0, 3), grossCents: cents, partial: m === thisMonth }))
  const full = months.filter((m) => !m.partial)
  const lastFull = full.at(-1)
  const prevFull = full.at(-2)
  let trendSay = ''
  if (lastFull && lastFull.grossCents > 0) {
    trendSay = `${monthName(lastFull.key)}: ${formatSGD(lastFull.grossCents)}`
    if (prevFull && prevFull.grossCents > 0) {
      const ch = ((lastFull.grossCents - prevFull.grossCents) * 100) / prevFull.grossCents
      trendSay += Math.abs(ch) < 0.05 ? `, the same as ${monthName(prevFull.key)}.` : `, ${ch > 0 ? 'up' : 'down'} ${Math.abs(ch).toFixed(1)}% on ${monthName(prevFull.key)}.`
    } else trendSay += '.'
  }
  const bestMonth = full.reduce((b, m) => (!b || m.grossCents > b.grossCents ? m : b), /** @type {typeof full[number] | null} */ (null))

  // How customers pay.
  /** @type {Map<string, number>} */
  const byChannel = new Map()
  for (const r of inRange) byChannel.set(r.channel, (byChannel.get(r.channel) ?? 0) + r.grossCents)
  const mix = CHANNELS.filter((c) => (byChannel.get(c) ?? 0) > 0)
    .map((c) => ({ channel: c, label: CHANNEL_LABELS[c], pct: total > 0 ? Math.round(((byChannel.get(c) ?? 0) * 100) / total) : 0 }))
    .sort((a, b) => b.pct - a.pct)
  const mixSay = mix[0] ? `Customers pay most with ${mix[0].label} (${mix[0].pct}% of sales).` : ''

  // Outlets.
  const outletTotal = outlets.reduce((t, o) => t + o.grossCents, 0)
  const outletRows = outlets.length >= 2 && outletTotal > 0
    ? [...outlets].sort((a, b) => b.grossCents - a.grossCents).map((o) => ({ id: o.id, name: o.name, amount: formatSGD(o.grossCents), pct: Math.round((o.grossCents * 100) / outletTotal) }))
    : []

  return {
    hasData: total > 0,
    range,
    rangeLabel: RANGES[range].label,
    dates: `${shortDay(from)} to ${shortDay(to)} ${to.slice(0, 4)}`,
    findings,
    trend: {
      say: trendSay,
      bars: months.map((m) => ({
        key: m.key, label: m.label, grossCents: m.grossCents, partial: m.partial, highlight: !m.partial && m.key === lastFull?.key,
        top: m.partial || m.key === lastFull?.key ? `$${(m.grossCents / 100000).toFixed(1)}k` : undefined,
        value: `${monthName(m.key)}${m.partial ? ' so far' : ''}: ${formatSGD(m.grossCents)}` })),
      note: `${monthName(thisMonth)} so far (to ${shortDay(addDays(today, -1))}) is striped.${bestMonth && bestMonth.grossCents > 0 ? ` Best month: ${monthName(bestMonth.key)}.` : ''}`,
    },
    days: {
      say: total > 0 ? `${DAY_NAMES[bestDays[0]]} is your best day, ${DAY_NAMES[quietDay]} your quietest.` : '',
      bars: dayAvg.map((c, d) => ({ key: DAY_SHORT[d], label: DAY_SHORT[d], grossCents: Math.round(c), highlight: bestDays.includes(d), top: dollars(c), value: `${DAY_NAMES[d]}: ${dollars(c)} a day on average` })),
    },
    hours: {
      say: rush ? `Busiest from ${hourLabel(rush.start)} to ${hourLabel(rush.end)}${second2 ? ` and ${hourLabel(second2.start)} to ${hourLabel(second2.end)}` : ''}.` : '',
      bars: open.length
        ? Array.from({ length: last - first + 1 }, (_, i) => first + i).map((h) => ({
            key: String(h), label: hourTick(h), grossCents: byHour[h],
            highlight: (rush !== null && h >= rush.start && h < rush.end) || (second2 !== null && h >= second2.start && h < second2.end),
            value: `${hourLabel(h)} to ${hourLabel(h + 1)}: ${heatTotal > 0 ? pct((byHour[h] * 100) / heatTotal) : 0}% of sales`,
          }))
        : [],
    },
    mix: { say: mixSay, rows: mix },
    outlets: { say: outletRows[0] ? `${outletRows[0].name} brings in ${outletRows[0].pct}% of your sales.` : '', rows: outletRows },
  }
}
