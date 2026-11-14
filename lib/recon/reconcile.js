import { CHANNEL_LABELS } from '../channels.js'
import { explainFailure } from '../failure-codes.js'
import { formatSGD } from '../money.js'

/**
 * @typedef {import('../channels.js').Channel} Channel
 * @typedef {'amount_mismatch' | 'missing_settlement' | 'settlement_delay' | 'failed_payment' | 'fee_mismatch'} ReconExceptionType
 * @typedef {{
 *   type: ReconExceptionType, ref: string, day?: string, channel?: Channel,
 *   expectedCents?: number, actualCents?: number, message: string,
 *   settlementId?: string, transactionId?: string,
 * }} ReconException
 * @typedef {{
 *   month: string, today: string,
 *   txnAgg: {day: string, channel: Channel, grossCents: number, feeCents: number,
 *            failed: {id: string, code: string, amountCents?: number}[]}[],
 *   settlements: {id: string, day: string, channel: Channel, grossCents: number,
 *                 status: 'pending' | 'paid' | 'delayed', expectedDate: string | null}[],
 *   invoiceLines: {chargeType: string, channel?: Channel | null, amountCents: number}[],
 * }} ReconInput
 */

/** A difference of more than this many cents is a mismatch (1 cent of rounding is tolerated). */
export const TOLERANCE_CENTS = 1

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const TYPE_ORDER = ['amount_mismatch', 'missing_settlement', 'settlement_delay', 'fee_mismatch', 'failed_payment']

/** @param {string} date YYYY-MM-DD @returns {string} e.g. '18 Oct' */
export function shortDay(date) {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTH_SHORT[m - 1]}`
}

/** @param {string} ym YYYY-MM @returns {string} e.g. 'October' */
export function monthName(ym) {
  return MONTH_LONG[Number(ym.slice(5, 7)) - 1]
}

/** @param {Channel} c */
const label = (c) => CHANNEL_LABELS[c] ?? String(c)

/**
 * Compare a month's payments with the settlements NETS paid and the invoice NETS billed.
 * Pure: no database, no clock (`today` is passed in). All money is integer cents.
 * @param {ReconInput} input
 * @returns {{checked: number, matched: number, matchRate: number, exceptions: ReconException[]}}
 */
export function reconcile({ month, today, txnAgg, settlements, invoiceLines }) {
  /** @type {ReconException[]} */
  const exceptions = []
  const key = (/** @type {string} */ day, /** @type {string} */ ch) => `${day}|${ch}`

  /** @type {Map<string, {grossCents: number, feeCents: number}>} */
  const txnByDayChannel = new Map()
  /** @type {Map<string, number>} */
  const feesByChannel = new Map()
  /** @type {{day: string, channel: Channel, id: string, code: string, amountCents?: number}[]} */
  const failed = []
  for (const t of txnAgg) {
    const k = key(t.day, t.channel)
    const cur = txnByDayChannel.get(k) ?? { grossCents: 0, feeCents: 0 }
    cur.grossCents += t.grossCents
    cur.feeCents += t.feeCents
    txnByDayChannel.set(k, cur)
    feesByChannel.set(t.channel, (feesByChannel.get(t.channel) ?? 0) + t.feeCents)
    for (const f of t.failed ?? []) failed.push({ day: t.day, channel: t.channel, ...f })
  }

  // 1. Each settlement against that day's successful payments, and against the calendar.
  const settled = new Set()
  let settlementsWithProblem = 0
  for (const s of settlements) {
    settled.add(key(s.day, s.channel))
    const expected = txnByDayChannel.get(key(s.day, s.channel))?.grossCents ?? 0
    const diff = expected - s.grossCents
    let problem = false
    if (Math.abs(diff) > TOLERANCE_CENTS) {
      problem = true
      exceptions.push({
        type: 'amount_mismatch', ref: s.id, settlementId: s.id, day: s.day, channel: s.channel,
        expectedCents: expected, actualCents: s.grossCents,
        message: `${diff > 0 ? 'Short' : 'Over'} by ${formatSGD(Math.abs(diff))} · ${label(s.channel)} sales on ${shortDay(s.day)}`,
      })
    }
    const late = s.status === 'delayed' || (s.status === 'pending' && s.expectedDate != null && s.expectedDate < today)
    if (late) {
      problem = true
      exceptions.push({
        type: 'settlement_delay', ref: s.id, settlementId: s.id, day: s.day, channel: s.channel,
        message: `${label(s.channel)} money for ${shortDay(s.day)} is late${s.expectedDate ? ` (was due ${shortDay(s.expectedDate)})` : ''}`,
      })
    }
    if (problem) settlementsWithProblem++
  }

  // 2. Days with successful payments but no settlement at all (today and later are not due yet).
  for (const [k, v] of txnByDayChannel) {
    if (settled.has(k) || v.grossCents <= 0) continue
    const [day, channel] = k.split('|')
    if (day >= today) continue
    exceptions.push({
      type: 'missing_settlement', ref: k, day, channel: /** @type {Channel} */ (channel),
      expectedCents: v.grossCents, actualCents: 0,
      message: `No bank payment found for ${label(/** @type {Channel} */ (channel))} sales on ${shortDay(day)} (${formatSGD(v.grossCents)})`,
    })
  }

  // 3. Fees on the invoice against the fees on the payments, per channel. Skipped when there is no bill yet.
  const mdr = invoiceLines.filter((l) => l.chargeType === 'mdr' && l.channel)
  /** @type {Map<string, number>} */
  const billedByChannel = new Map()
  for (const l of mdr) billedByChannel.set(l.channel, (billedByChannel.get(l.channel) ?? 0) + l.amountCents)
  let feeLinesWithProblem = 0
  if (invoiceLines.length > 0) {
    const channels = new Set([...billedByChannel.keys(), ...feesByChannel.keys()])
    for (const ch of [...channels].sort()) {
      const billed = billedByChannel.get(ch) ?? 0
      const fees = feesByChannel.get(ch) ?? 0
      const diff = billed - fees
      if (Math.abs(diff) > TOLERANCE_CENTS) {
        if (billedByChannel.has(ch)) feeLinesWithProblem++
        exceptions.push({
          type: 'fee_mismatch', ref: ch, channel: /** @type {Channel} */ (ch),
          expectedCents: fees, actualCents: billed,
          message: `${label(/** @type {Channel} */ (ch))} fees on your ${monthName(month)} bill are ${formatSGD(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than your payments add up to`,
        })
      }
    }
  }

  // 4. Every failed payment.
  for (const f of failed) {
    const why = explainFailure(f.code).plain
    exceptions.push({
      type: 'failed_payment', ref: f.id, transactionId: f.id, day: f.day, channel: f.channel,
      ...(f.amountCents != null ? { expectedCents: f.amountCents } : {}),
      message: `${f.amountCents != null ? formatSGD(f.amountCents) : 'A'} payment didn't go through · ${why}`,
    })
  }

  exceptions.sort((a, b) => {
    const t = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
    if (t !== 0) return t
    if (a.type === 'failed_payment') return (b.day ?? '').localeCompare(a.day ?? '') || a.ref.localeCompare(b.ref)
    return (a.day ?? '').localeCompare(b.day ?? '') || a.ref.localeCompare(b.ref)
  })

  const checked = settlements.length + billedByChannel.size
  const matched = settlements.length - settlementsWithProblem + billedByChannel.size - feeLinesWithProblem
  return { checked, matched, matchRate: checked === 0 ? 1 : matched / checked, exceptions }
}
