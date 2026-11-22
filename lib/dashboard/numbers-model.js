// "This week in numbers" on Home: four key numbers with their change, and what drove the change in sales
// (by payment type). Pure: the page passes the same like-for-like rows the headline uses.
import { CHANNELS, CHANNEL_LABELS } from '../channels.js'
import { formatSGD } from '../money.js'

/**
 * @typedef {import('../metrics/summary.js').DailySalesRow} DailySalesRow
 * @typedef {'today' | 'week' | 'month'} PeriodKind
 * @typedef {'up' | 'down' | 'flat'} Direction
 */

const MINUS = '−'
const TITLES = { today: 'Today in numbers', week: 'This week in numbers', month: 'This month in numbers' }
const COMPARED = { today: 'compared with yesterday', week: 'compared with the same days last week', month: 'compared with the same days last month' }
const PREV = { today: 'yesterday', week: 'last week', month: 'last month' }
const PERIOD = { today: 'today', week: 'this week', month: 'this month' }

/** @param {DailySalesRow[]} rows */
function totals(rows) {
  let grossCents = 0
  let attempts = 0
  let failed = 0
  for (const r of rows) {
    grossCents += r.grossCents
    attempts += r.txnCount
    failed += r.failedCount
  }
  const payments = attempts - failed
  return {
    grossCents,
    payments,
    avgCents: payments > 0 ? grossCents / payments : 0,
    failedRate: attempts > 0 ? (failed * 100) / attempts : 0,
  }
}

/** @param {number} n */
const one = (n) => (Math.round(n * 10) / 10).toFixed(1)

/** @param {number} x signed value, already rounded to one place @returns {Direction} */
const directionOf = (x) => (x > 0 ? 'up' : x < 0 ? 'down' : 'flat')

/**
 * A percentage change, or null when there is nothing to compare with.
 * @param {number} curr @param {number} prev
 */
function pctChange(curr, prev) {
  if (prev <= 0) return null
  return Number(one(((curr - prev) * 100) / prev))
}

/** @param {number} cents @returns {string} "+$79.09" or "−$291.39" */
const signedMoney = (cents) => `${cents < 0 ? MINUS : '+'}${formatSGD(Math.abs(cents))}`
/** @param {number} pct @returns {string} "+18.0%" or "−12.2%" */
// A word joiner after the sign stops a line break between "−" and the amount in running text.
const joinedMoney = (/** @type {number} */ cents) => signedMoney(cents).replace(/^(.)/, '$1⁠')
const signedPct = (pct) => `${pct < 0 ? MINUS : '+'}${one(Math.abs(pct))}%`

/**
 * @param {{kind: PeriodKind, currRows: DailySalesRow[], prevRows: DailySalesRow[]}} input
 *   currRows and prevRows cover the same number of days (like for like), as on the headline
 */
export function buildNumbersModel({ kind, currRows, prevRows }) {
  const prevWord = PREV[kind]
  const c = totals(currRows)
  const p = totals(prevRows)
  const hasPrev = p.grossCents > 0
  // Nothing sold yet this period (early on a Monday, say): show last time's figure, not a "100% drop".
  const early = hasPrev && c.grossCents === 0
  const was = (/** @type {string} */ text) => (hasPrev ? `${text} ${prevWord}` : `No sales ${prevWord}`)

  /** A tile whose bigger value is good (sales, payments, average sale). */
  const tile = (/** @type {string} */ label, /** @type {string} */ value, /** @type {number | null} */ rawPct, /** @type {string} */ prevText) => {
    const pct = early ? null : rawPct
    const direction = pct === null ? 'flat' : directionOf(pct)
    return {
      label,
      value,
      change: pct === null ? null : `${one(Math.abs(pct))}%`,
      direction,
      tone: pct === null || direction === 'flat' ? 'mute' : direction === 'up' ? 'ok' : 'bad',
      was: was(prevText),
    }
  }
  const pts = hasPrev && !early ? Number(one(c.failedRate - p.failedRate)) : null
  const failedDir = pts === null ? 'flat' : directionOf(pts)
  const tiles = [
    tile('Sales', formatSGD(c.grossCents), hasPrev ? pctChange(c.grossCents, p.grossCents) : null, formatSGD(p.grossCents)),
    tile('Payments', c.payments.toLocaleString('en-SG'), hasPrev ? pctChange(c.payments, p.payments) : null, p.payments.toLocaleString('en-SG')),
    tile('Average sale', formatSGD(Math.round(c.avgCents)), hasPrev ? pctChange(c.avgCents, p.avgCents) : null, formatSGD(Math.round(p.avgCents))),
    {
      label: 'Didn’t go through',
      value: `${one(c.failedRate)}%`,
      change: pts === null ? null : `${one(Math.abs(pts))} pts`,
      direction: failedDir,
      // More failed payments is bad news.
      tone: pts === null || failedDir === 'flat' ? 'mute' : failedDir === 'up' ? 'bad' : 'ok',
      was: was(`${one(p.failedRate)}%`),
    },
  ]

  // What drove the change in sales: each payment type's change in money, biggest first.
  /** @type {{channel: string, label: string, deltaCents: number, pct: number | null}[]} */
  let moves = []
  if (hasPrev && !early) {
    const by = (/** @type {DailySalesRow[]} */ rows) => {
      /** @type {Map<string, number>} */
      const m = new Map()
      for (const r of rows) m.set(r.channel, (m.get(r.channel) ?? 0) + r.grossCents)
      return m
    }
    const cm = by(currRows)
    const pm = by(prevRows)
    moves = CHANNELS.filter((ch) => (cm.get(ch) ?? 0) > 0 || (pm.get(ch) ?? 0) > 0)
      .map((ch) => {
        const now = cm.get(ch) ?? 0
        const before = pm.get(ch) ?? 0
        return { channel: ch, label: CHANNEL_LABELS[ch], deltaCents: now - before, pct: before > 0 ? ((now - before) * 100) / before : null }
      })
      .filter((m) => m.deltaCents !== 0)
      .sort((a, b) => Math.abs(b.deltaCents) - Math.abs(a.deltaCents))
  }
  const biggest = moves.length > 0 ? Math.abs(moves[0].deltaCents) : 0
  const drivers = moves.map((m) => ({
    channel: m.channel,
    label: m.label,
    delta: signedMoney(m.deltaCents),
    pct: m.pct === null ? 'new' : signedPct(m.pct),
    tone: m.deltaCents > 0 ? 'ok' : 'bad',
    size: Math.round((Math.abs(m.deltaCents) * 100) / biggest),
  }))

  return {
    title: TITLES[kind],
    compared: COMPARED[kind],
    hasData: c.grossCents > 0 || p.grossCents > 0,
    tiles,
    drivers,
    summary: early
      ? `No sales yet ${PERIOD[kind]}. ${kind === 'today' ? 'Yesterday' : `Over the same days ${prevWord}`} you made ${formatSGD(p.grossCents)}.`
      : summarise(tiles[0], moves, c.grossCents - p.grossCents, hasPrev, prevWord),
  }
}

/**
 * One or two sentences: which way sales went, which payment types caused most of it, and the biggest move the
 * other way.
 * @param {{change: string | null, direction: Direction}} sales
 * @param {{label: string, deltaCents: number, pct: number | null}[]} moves biggest first
 * @param {number} totalDelta
 * @param {boolean} hasPrev
 * @param {string} prevWord
 */
function summarise(sales, moves, totalDelta, hasPrev, prevWord) {
  if (!hasPrev) return `No sales ${prevWord} to compare with.`
  if (sales.direction === 'flat') return `Sales are the same as ${prevWord}.`
  const rising = sales.direction === 'up'
  const same = moves.filter((m) => (rising ? m.deltaCents > 0 : m.deltaCents < 0))
  // Name the second payment type too if it caused at least a fifth of the change.
  const named = same.slice(0, 2).filter((m, i) => i === 0 || Math.abs(m.deltaCents) * 5 >= Math.abs(totalDelta))
  const list = named.map((m) => `${m.label} (${joinedMoney(m.deltaCents)})`).join(' and ')
  let text = `Sales ${rising ? 'rose' : 'fell'} ${sales.change}.`
  if (list) text += ` Most of the ${rising ? 'rise' : 'drop'} came from ${list}.`
  const other = moves.find((m) => (rising ? m.deltaCents < 0 : m.deltaCents > 0) && m.pct !== null && Math.abs(m.pct) >= 5)
  if (other && other.pct !== null) text += ` ${other.label} ${rising ? 'fell' : 'grew'} ${one(Math.abs(other.pct))}%.`
  return text
}
