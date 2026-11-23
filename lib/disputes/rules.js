// Refunds & disputes: statuses, wording, permissions and the Decline form check. Pure (no database, no React).
// Dates are Singapore business dates, 'YYYY-MM-DD'. Money is integer cents.
import { z } from 'zod'
import { addDays } from '../dates.js'
import { formatSGD } from '../money.js'
import { formatDay } from '../transactions/format.js'

/**
 * @typedef {'charged_twice' | 'not_received' | 'not_recognised' | 'wrong_amount'} Reason
 * @typedef {'open' | 'missed' | 'waiting' | 'won' | 'lost' | 'accepted'} EffectiveStatus
 * @typedef {{
 *   status: string, respondBy: string, reason?: string, amountCents?: number,
 *   openedAt?: string, answeredAt?: string | null, decideBy?: string | null, decidedAt?: string | null, fileCount?: number,
 * }} DisputeView
 *   openedAt / answeredAt / decidedAt / decideBy / respondBy are 'YYYY-MM-DD' (SGT dates)
 */

/** @type {Record<Reason, string>} */
export const REASON_TEXT = {
  charged_twice: 'Customer says they were charged twice',
  not_received: "Customer says they didn't get their food or goods",
  not_recognised: "Customer doesn't recognise this payment",
  wrong_amount: 'Customer says they were charged the wrong amount',
}

/** @type {Record<Reason, string>} */
export const REASON_SHORT = {
  charged_twice: 'Charged twice',
  not_received: 'Not received',
  not_recognised: "Doesn't recognise the payment",
  wrong_amount: 'Charged the wrong amount',
}

export const REFUND_REASON_TEXT = {
  wrong_order: 'Wrong order',
  charged_twice: 'Charged twice',
  sold_out: 'Item sold out',
  changed_mind: 'Customer changed their mind',
  other: 'Other',
}

export const EVIDENCE = [
  { value: 'receipt', label: 'Receipt or order slip' },
  { value: 'printout', label: 'Terminal printout' },
  { value: 'photo', label: 'Photo of the order' },
  { value: 'messages', label: 'Messages with the customer' },
]

/** @type {Record<string, {value: string, label: string}>} */
const FIRST_DECLINE = {
  charged_twice: { value: 'paid_once', label: 'The customer paid only once. I can show the one payment.' },
  not_received: { value: 'received', label: 'The customer got their food or goods.' },
  not_recognised: { value: 'made_payment', label: 'The customer made this payment.' },
  wrong_amount: { value: 'right_amount', label: 'The amount charged was right.' },
}

/**
 * Choices for "Why do you disagree?", depending on the dispute reason. "Something else" is always last.
 * @param {string} reason
 * @returns {{value: string, label: string}[]}
 */
export function declineReasons(reason) {
  const first = FIRST_DECLINE[reason]
  return [...(first ? [first] : []), { value: 'something_else', label: 'Something else' }]
}

/**
 * An open dispute past its deadline is "missed" (worked out on read); a declined one is "waiting" for NETS.
 * @param {{status: string, respondBy: string}} d
 * @param {string} today
 * @returns {EffectiveStatus}
 */
export function effectiveStatus(d, today) {
  if (d.status === 'open') return d.respondBy < today ? 'missed' : 'open'
  if (d.status === 'declined') return 'waiting'
  return /** @type {EffectiveStatus} */ (d.status)
}

/**
 * Calendar days from today to the deadline (negative once it has passed).
 * @param {string} respondBy
 * @param {string} today
 * @returns {number}
 */
export function daysLeft(respondBy, today) {
  return Math.round((Date.parse(`${respondBy}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

/**
 * @param {DisputeView} d
 * @param {string} today
 * @returns {{tone: 'bad' | 'info' | 'ok' | 'mute', icon: 'clock' | 'tick' | 'alert' | 'refund', text: string}}
 */
export function statusPill(d, today) {
  switch (effectiveStatus(d, today)) {
    case 'open':
      return { tone: 'bad', icon: 'alert', text: `Answer by ${formatDay(d.respondBy)}` }
    case 'waiting':
      return { tone: 'info', icon: 'clock', text: 'Waiting for NETS' }
    case 'won':
      return { tone: 'ok', icon: 'tick', text: 'Won, money kept' }
    case 'lost':
      return { tone: 'bad', icon: 'refund', text: 'Lost, money refunded' }
    case 'accepted':
      return { tone: 'mute', icon: 'refund', text: 'Accepted, refunded' }
    default:
      return { tone: 'bad', icon: 'refund', text: 'Missed, money refunded' }
  }
}

/** @param {number} n */
const files = (n) => `${n} ${n === 1 ? 'file' : 'files'} sent`

/**
 * The 3-step track: Customer disputed, Your answer, NETS decides.
 * @param {DisputeView} d
 * @param {string} today
 * @returns {{label: string, sub: string, state: 'done' | 'now' | 'wait' | 'todo'}[]}
 */
export function trackSteps(d, today) {
  const status = effectiveStatus(d, today)
  /** @type {'done'} */
  const done = 'done'
  const opened = { label: 'Customer disputed', sub: d.openedAt ? formatDay(d.openedAt) : '', state: done }
  const on = (/** @type {string | null | undefined} */ date) => (date ? ` ${formatDay(date)}` : '')
  const outcomeDate = d.decidedAt ?? d.answeredAt ?? d.respondBy
  if (status === 'open') {
    const left = daysLeft(d.respondBy, today)
    const sub = left === 0 ? 'Last day to answer' : `${left} ${left === 1 ? 'day' : 'days'} left`
    return [
      opened,
      { label: 'Your answer', sub, state: 'now' },
      { label: 'NETS decides', sub: 'About 30 days after', state: 'todo' },
    ]
  }
  if (status === 'waiting') {
    return [
      opened,
      { label: 'Your answer', sub: `You declined${on(d.answeredAt)} · ${files(d.fileCount ?? 0)}`, state: 'done' },
      { label: 'NETS decides', sub: d.decideBy ? `By ${formatDay(d.decideBy)}` : 'About 30 days after', state: 'wait' },
    ]
  }
  if (status === 'accepted') {
    return [
      opened,
      { label: 'Your answer', sub: `You accepted${on(d.answeredAt)}`, state: 'done' },
      { label: 'NETS decides', sub: `Refunded${on(d.answeredAt)}`, state: 'done' },
    ]
  }
  if (status === 'missed') {
    return [
      opened,
      { label: 'Your answer', sub: `Missed${on(d.respondBy)}`, state: 'done' },
      { label: 'NETS decides', sub: `Refunded${on(d.respondBy)}`, state: 'done' },
    ]
  }
  const outcome = status === 'won' ? 'Won' : 'Lost'
  return [
    opened,
    { label: 'Your answer', sub: `You declined${on(d.answeredAt)} · ${files(d.fileCount ?? 0)}`, state: 'done' },
    { label: 'NETS decides', sub: `${outcome}${on(outcomeDate)}`, state: 'done' },
  ]
}

/**
 * The blue "what this means" sentence for an open dispute.
 * @param {{reason: string, amountCents: number}} d
 * @param {number} sameAmountCount payments of the same amount, same card type, same day, same terminal
 * @returns {string}
 */
export function hint(d, sameAmountCount) {
  const amount = formatSGD(d.amountCents)
  const loss = `If you lose, ${amount} is taken back from a future payout.`
  if (d.reason === 'charged_twice') {
    const lead =
      sameAmountCount >= 2
        ? `We found ${sameAmountCount} payments of ${amount} that day. If one was a mistake, accepting may be right.`
        : `We found only one payment of ${amount} that day, so declining may win this.`
    return `${lead} ${loss}`
  }
  return `Photos of the receipt or the order help NETS decide. ${loss}`
}

/**
 * The answer sentence at the top of the page. `text` contains the literal placeholder `{figure}`; the UI splits on it
 * and renders `figure` (the bold/blue part) in its place.
 * @param {{openCount: number, earliestRespondBy: string | null, openCents: number, waitingCount: number, waitingCents: number,
 *   refundsMonthCount: number, refundsMonthCents: number}} s
 * @param {string} _today
 * @returns {{text: string, figure: string}}
 */
export function pageSentence(s, _today) {
  if (s.openCount > 0) {
    const when = s.earliestRespondBy ? ` by ${formatDay(s.earliestRespondBy)}` : ''
    const lead = s.openCount === 1 ? `1 dispute needs your answer${when}.` : `${s.openCount} disputes need your answer${when}.`
    return { text: `${lead} {figure} is at stake.`, figure: formatSGD(s.openCents) }
  }
  if (s.waitingCount > 0) {
    return { text: 'Nothing to answer. {figure} is waiting for NETS to decide.', figure: formatSGD(s.waitingCents) }
  }
  const n = s.refundsMonthCount
  if (n === 0) return { text: 'Nothing to answer, and no refunds this month.', figure: '' }
  return {
    text: `Nothing to answer. You had {figure} (${formatSGD(s.refundsMonthCents)}) this month.`,
    figure: `${n} ${n === 1 ? 'refund' : 'refunds'}`,
  }
}

/**
 * Owners and outlet managers may answer, unless the login is view-only.
 * @param {{role: string, readOnly?: boolean}} access
 * @returns {boolean}
 */
export function canRespond(access) {
  return (access.role === 'owner' || access.role === 'outlet_manager') && !access.readOnly
}

/**
 * The one-line note for people who can look but not answer, or null if they can answer.
 * @param {{role: string, readOnly?: boolean, tier?: string}} access
 * @returns {string | null}
 */
export function viewOnlyNote(access) {
  if (canRespond(access)) return null
  const who = access.tier === 'hq' || access.role === 'hq_owner' ? 'franchisee' : 'owner'
  return `You can look but not answer. The ${who} answers disputes.`
}

const declineSchema = z
  .object({
    declineReason: z.enum(['paid_once', 'received', 'made_payment', 'right_amount', 'something_else'], {
      error: 'Choose why you disagree.',
    }),
    evidence: z.array(z.enum(['receipt', 'printout', 'photo', 'messages'])).min(1, 'Tick at least one kind of proof.'),
    note: z.string().max(500, 'Keep the note under 500 characters.'),
  })
  .superRefine((v, ctx) => {
    if (v.declineReason === 'something_else' && v.note.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Tell NETS what happened (up to 500 characters).' })
    }
  })

/** @param {any} input @param {string} key @returns {unknown[]} */
function many(input, key) {
  const v = typeof input.getAll === 'function' ? input.getAll(key) : input[key]
  return v == null ? [] : Array.isArray(v) ? v : [v]
}

/** @param {any} input @param {string} key */
function one(input, key) {
  const v = typeof input.get === 'function' ? input.get(key) : input[key]
  return typeof v === 'string' ? v : ''
}

/**
 * Check the Decline form (a FormData or a plain object with declineReason, evidence, note).
 * @param {any} input
 * @returns {{ok: true, value: {declineReason: string, evidence: string[], note: string | null}}
 *   | {ok: false, errors: Partial<Record<'declineReason' | 'evidence' | 'note', string>>}}
 */
export function parseDecline(input) {
  const r = declineSchema.safeParse({
    declineReason: one(input, 'declineReason'),
    evidence: many(input, 'evidence'),
    note: one(input, 'note').trim(),
  })
  if (r.success) {
    const { declineReason, evidence, note } = r.data
    return { ok: true, value: { declineReason, evidence, note: note === '' ? null : note } }
  }
  /** @type {Partial<Record<'declineReason' | 'evidence' | 'note', string>>} */
  const errors = {}
  for (const issue of r.error.issues) {
    const key = /** @type {'declineReason' | 'evidence' | 'note'} */ (issue.path[0])
    if (!errors[key]) errors[key] = issue.message
  }
  return { ok: false, errors }
}
