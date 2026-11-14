import { CHANNEL_LABELS } from '../channels.js'
import { explainFailure } from '../failure-codes.js'
import { formatSGD } from '../money.js'

/**
 * @typedef {{
 *   id: string, createdAt: string, amountCents: number, feeCents: number,
 *   channel: import('../channels.js').Channel, status: 'success' | 'failed' | 'refunded',
 *   failureCode: string | null, customerRef: string | null, outletName: string | null,
 *   terminalSerial: string | null, settlementDate: string | null
 * }} Txn
 * @typedef {{tone: 'ok' | 'bad' | 'mute', label: string}} PillView
 */

const WHEN = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Singapore',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

/**
 * "Sat 14 Nov, 12:41 pm" in Singapore time.
 * @param {string} iso UTC instant
 * @returns {string}
 */
export function formatWhen(iso) {
  /** @type {Record<string, string>} */
  const p = {}
  for (const part of WHEN.formatToParts(new Date(iso))) p[part.type] = part.value
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute} ${String(p.dayPeriod).toLowerCase()}`
}

/**
 * 'YYYY-MM-DD' as "Sat 14 Nov".
 * @param {string} date
 */
export function formatDay(date) {
  /** @type {Record<string, string>} */
  const p = {}
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
  for (const part of fmt.formatToParts(new Date(`${date}T00:00:00Z`))) p[part.type] = part.value
  return `${p.weekday} ${p.day} ${p.month}`
}

/** @param {string} id */
export const shortId = (id) => id.slice(0, 8)

/** @type {Record<string, PillView>} */
const PILLS = {
  success: { tone: 'ok', label: 'Went through' },
  failed: { tone: 'bad', label: 'Failed' },
  refunded: { tone: 'mute', label: 'Refunded' },
}

/**
 * Plain row for the list (safe to send to the browser).
 * @param {Txn} t
 */
export function toRowView(t) {
  return {
    id: t.id,
    when: formatWhen(t.createdAt),
    amount: formatSGD(t.amountCents),
    how: CHANNEL_LABELS[t.channel] ?? t.channel,
    outlet: t.outletName ?? 'Not recorded',
    pill: PILLS[t.status] ?? PILLS.success,
  }
}

/**
 * Everything the details drawer shows, as plain text.
 * @param {Txn} t
 */
export function toDetailView(t) {
  const failed = t.status === 'failed'
  const fail = failed ? explainFailure(t.failureCode) : null
  const plain = failed
    ? `${fail?.plain} The customer was not charged.`
    : t.status === 'refunded'
      ? 'This payment went through, then was refunded to the customer. The refund comes out of your money to the bank.'
      : 'The payment went through. It will be in your bank with the rest of that day’s sales.'

  /** @type {[string, string][]} */
  const kv = [
    ['Paid with', CHANNEL_LABELS[t.channel] ?? t.channel],
    ['Outlet', t.outletName ?? 'Not recorded'],
  ]
  if (t.terminalSerial) kv.push(['Terminal', t.terminalSerial])
  kv.push(['Payment ID', shortId(t.id)])
  if (t.customerRef) kv.push(['Customer reference', t.customerRef])
  if (failed && t.failureCode) kv.push(['Bank response code', t.failureCode])
  if (!failed) kv.push(['NETS fee', formatSGD(t.feeCents)])
  kv.push([
    'Money to your bank',
    failed ? 'None' : t.settlementDate ? `With ${formatDay(t.settlementDate)} sales` : 'Not paid out yet',
  ])

  return {
    id: t.id,
    pill: PILLS[t.status] ?? PILLS.success,
    amount: formatSGD(t.amountCents),
    when: formatWhen(t.createdAt),
    plain,
    plainTone: failed ? 'bad' : t.status === 'refunded' ? 'info' : 'ok',
    action: fail ? fail.action : null,
    kv,
    assistantHref: failed ? `/assistant?q=${encodeURIComponent(`Why did payment ${shortId(t.id)} fail?`)}` : null,
  }
}
