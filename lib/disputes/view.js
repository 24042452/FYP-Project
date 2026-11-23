// What the Refunds & disputes page shows, worked out from the rows of lib/data/disputes.js and
// lib/data/refunds.js. Pure (no database, no React), so the wording is unit-tested.
import { CHANNEL_LABELS } from '../channels.js'
import { addMonths, monthStart, sgtDate } from '../dates.js'
import { formatSGD } from '../money.js'
import { formatDay, formatWhen } from '../transactions/format.js'
import {
  REASON_SHORT,
  REASON_TEXT,
  REFUND_REASON_TEXT,
  daysLeft,
  declineReasons,
  effectiveStatus,
  hint,
  pageSentence,
  statusPill,
  trackSteps,
} from './rules.js'

/**
 * @typedef {import('../data/disputes.js').DisputeRow} DisputeRow
 * @typedef {import('../data/refunds.js').RefundRow} RefundRow
 * @typedef {{id: string, name: string, size: string, href: string}} FileView
 * @typedef {{
 *   id: string, status: string, title: string, short: string, amount: string,
 *   pill: {tone: 'bad' | 'info' | 'ok' | 'mute', icon: 'clock' | 'tick' | 'alert' | 'refund', text: string},
 *   steps: {label: string, sub: string, state: 'done' | 'now' | 'wait' | 'todo'}[],
 *   meta: string, hint: string | null, paymentHref: string, files: FileView[], filesSent: string | null,
 *   reasons: {value: string, label: string}[], closedSub: string, closedOn: string,
 * }} DisputeView
 * @typedef {{
 *   id: string, refundedOn: string, boughtOn: string, channel: string, reason: string, amount: string,
 *   href: string, payout: {paid: boolean, text: string},
 * }} RefundView
 */

const MONTH = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' })
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })

/** @param {number} n @param {string} one @param {string} many */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * "640 KB" or "1.4 MB".
 * @param {number} bytes
 */
export function fileSize(bytes) {
  if (bytes < 1_048_576) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

/**
 * Sales & payments with that payment open (its day picked, so it is also in the list).
 * @param {string} transactionId
 * @param {string} paidAt ISO UTC
 */
/**
 * This page with that payment's details open in the side panel (?payment=), so the merchant never leaves it.
 * @param {string} transactionId
 */
export function drawerHref(transactionId) {
  return `/disputes?${new URLSearchParams({ payment: transactionId })}`
}

export function paymentHref(transactionId, paidAt) {
  const day = sgtDate(paidAt)
  return `/transactions?${new URLSearchParams({ id: transactionId, from: day, to: day })}`
}

/** @param {string} channel */
const channelLabel = (channel) => CHANNEL_LABELS[/** @type {keyof typeof CHANNEL_LABELS} */ (channel)] ?? channel

/**
 * "7 days left", "1 day left" or "last day".
 * @param {number} n
 */
const leftText = (n) => (n <= 0 ? 'last day' : `${plural(n, 'day', 'days')} left`)

/**
 * One dispute as the page shows it: as a case (open or waiting) and as a closed-list line.
 * @param {DisputeRow} d
 * @param {string} today SGT 'YYYY-MM-DD'
 * @returns {DisputeView}
 */
export function toDisputeView(d, today) {
  const status = effectiveStatus(d, today)
  const channel = channelLabel(d.channel)
  const amount = formatSGD(d.amountCents)
  const paid = `${channel} · paid ${formatWhen(d.paidAt)}`
  const ids = [d.tid ? `TID ${d.tid}` : null, d.stan ? `STAN ${d.stan}` : null].filter(Boolean)
  const meta =
    status === 'waiting' && d.answeredAt
      ? `${paid} · you declined it on ${formatDay(d.answeredAt)}`
      : [paid, ...ids].join(' · ')
  const declined = status === 'waiting' || status === 'won' || status === 'lost'
  const did =
    status === 'accepted'
      ? 'you accepted'
      : status === 'missed'
        ? 'no answer was sent in time'
        : declined && d.fileCount > 0
          ? `you declined with ${plural(d.fileCount, 'file', 'files')}`
          : 'you declined'
  return {
    id: d.id,
    status,
    title: REASON_TEXT[/** @type {keyof typeof REASON_TEXT} */ (d.reason)] ?? 'Customer asked for their money back',
    short: `${REASON_SHORT[/** @type {keyof typeof REASON_SHORT} */ (d.reason)] ?? 'Dispute'} · ${amount}`,
    amount,
    pill: statusPill(d, today),
    steps: trackSteps(d, today),
    meta,
    hint: status === 'open' ? hint(d, d.sameAmountCount) : null,
    paymentHref: drawerHref(d.transactionId),
    files: d.files.map((f) => ({ id: f.id, name: f.name, size: fileSize(f.sizeBytes), href: `/disputes/files/${f.id}` })),
    filesSent: declined && d.fileCount > 0 ? `${plural(d.fileCount, 'file', 'files')} sent` : null,
    reasons: status === 'open' ? declineReasons(d.reason) : [],
    closedSub: `${channel} · ${MONTH.format(new Date(`${d.openedAt}T00:00:00Z`))} · ${did}`,
    closedOn: d.decidedAt ?? d.answeredAt ?? d.respondBy,
  }
}

/**
 * One refund row: when, what, how much, and the payout it was taken from.
 * @param {RefundRow} r
 * @returns {RefundView}
 */
export function toRefundView(r) {
  const p = r.payout
  // Plain text once taken (money leaving is not a success state); a blue pill only while it is still to come.
  const payout =
    p && p.status === 'paid'
      ? { paid: true, text: `${formatDay(p.paidDate ?? p.expectedDate)} payout` }
      : { paid: false, text: 'Next payout' }
  return {
    id: r.id,
    refundedOn: formatDay(sgtDate(r.refundedAt)),
    boughtOn: formatDay(sgtDate(r.paidAt)),
    channel: channelLabel(r.channel),
    reason: REFUND_REASON_TEXT[/** @type {keyof typeof REFUND_REASON_TEXT} */ (r.reason)] ?? 'Other',
    amount: formatSGD(r.amountCents),
    href: drawerHref(r.transactionId),
    payout,
  }
}

/**
 * The refunds list covers this month and the two before it.
 * @param {string} today
 * @returns {{from: string, to: string}}
 */
export function refundsRange(today) {
  return { from: addMonths(today, -2), to: today }
}

/**
 * Everything the page needs: the answer sentence, the three summary tiles, the cases (open first, by
 * deadline, then waiting), the closed disputes (latest decision first) and the refunds.
 * @param {{disputes: DisputeRow[], refunds: RefundRow[], today: string}} input
 */
export function buildDisputesPage({ disputes, refunds, today }) {
  const views = disputes.map((d) => ({ row: d, view: toDisputeView(d, today) }))
  const open = views.filter((v) => v.view.status === 'open').sort((a, b) => a.row.respondBy.localeCompare(b.row.respondBy))
  const waiting = views.filter((v) => v.view.status === 'waiting')
  const closed = views
    .filter((v) => v.view.status !== 'open' && v.view.status !== 'waiting')
    .sort((a, b) => b.view.closedOn.localeCompare(a.view.closedOn))

  const sum = (/** @type {{row: DisputeRow}[]} */ list) => list.reduce((s, v) => s + v.row.amountCents, 0)
  const thisMonth = monthStart(today)
  const monthRefunds = refunds.filter((r) => sgtDate(r.refundedAt) >= thisMonth)
  const refundsMonthCents = monthRefunds.reduce((s, r) => s + r.amountCents, 0)
  const earliest = open[0]?.row.respondBy ?? null
  const openCents = sum(open)
  const waitingCents = sum(waiting)

  const sentence = pageSentence(
    {
      openCount: open.length,
      earliestRespondBy: earliest,
      openCents,
      waitingCount: waiting.length,
      waitingCents,
      refundsMonthCount: monthRefunds.length,
      refundsMonthCents,
    },
    today,
  )
  const [head, after = ''] = sentence.text.split('{figure}')
  // The first sentence(s) go in `lead`, so the page can break the line at a sentence boundary.
  const cut = head.lastIndexOf('. ')
  const lead = cut === -1 ? '' : head.slice(0, cut + 1)
  const before = cut === -1 ? head : head.slice(cut + 2)

  const lastDeclined = waiting.map((v) => v.row.answeredAt).filter(Boolean).sort().at(-1)
  const tiles = [
    open.length > 0 && earliest
      ? {
          label: 'Needs your answer',
          value: plural(open.length, 'dispute', 'disputes'),
          hint: `Answer by ${formatDay(earliest)} · ${leftText(daysLeft(earliest, today))}`,
          tone: /** @type {const} */ ('attention'),
        }
      : { label: 'Needs your answer', value: 'None', hint: 'Nothing to answer' },
    {
      label: 'Waiting for NETS',
      value: formatSGD(waitingCents),
      hint:
        waiting.length === 0
          ? 'Nothing waiting'
          : waiting.length === 1 && lastDeclined
            ? `1 dispute you declined on ${DAY_MONTH.format(new Date(`${lastDeclined}T00:00:00Z`))}`
            : `${plural(waiting.length, 'dispute', 'disputes')} you declined`,
    },
    {
      label: 'Refunds this month',
      value: formatSGD(refundsMonthCents),
      hint: monthRefunds.length === 0 ? 'No refunds this month' : `${plural(monthRefunds.length, 'refund', 'refunds')} · taken from your payouts`,
    },
  ]

  return {
    sentence: { lead, before, figure: sentence.figure, after },
    hasOpen: open.length > 0,
    tiles,
    cases: [...open, ...waiting].map((v) => v.view),
    closed: closed.map((v) => v.view),
    refunds: refunds.map(toRefundView),
  }
}
