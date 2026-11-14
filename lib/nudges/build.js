import { formatSGD } from '../money.js'

/**
 * @typedef {'sales_up' | 'sales_down' | 'failed_payments' | 'settlement_delay' | 'invoice_ready'} NudgeKind
 * @typedef {{kind: NudgeKind, title: string, body: string, link: string}} Nudge
 * @typedef {{
 *   weekCurr: number, weekPrev: number, failedToday: number, delayedSettlements: number,
 *   latestInvoice?: {month: string, totalCents: number, status: 'unpaid' | 'paid' | 'overdue'},
 * }} NudgeInput
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** @param {unknown} v */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/**
 * Small plain-English nudges from a few numbers. Pure: no database, no clock.
 * weekCurr/weekPrev are like-for-like gross sales in cents (this week so far vs the same days last week).
 * @param {NudgeInput} input
 * @returns {Nudge[]}
 */
export function buildNudges(input) {
  const weekCurr = num(input?.weekCurr)
  const weekPrev = num(input?.weekPrev)
  const failedToday = Math.trunc(num(input?.failedToday))
  const delayed = Math.trunc(num(input?.delayedSettlements))
  const inv = input?.latestInvoice
  /** @type {Nudge[]} */
  const out = []

  if (weekPrev > 0) {
    const pct = ((weekCurr - weekPrev) * 100) / weekPrev
    if (pct >= 10) {
      out.push({
        kind: 'sales_up',
        title: `Your sales are up ${Math.round(pct)}% this week`,
        body: 'Compared with the same days last week.',
        link: '/',
      })
    } else if (pct <= -15) {
      out.push({
        kind: 'sales_down',
        title: 'Sales are lower than usual this week',
        body: 'Compared with the same days last week.',
        link: '/',
      })
    }
  }

  if (failedToday >= 1) {
    out.push({
      kind: 'failed_payments',
      title: failedToday === 1 ? '1 payment needs attention' : `${failedToday} payments need attention`,
      body: 'Customers may need to try again.',
      link: '/transactions?status=failed',
    })
  }

  if (delayed >= 1) {
    out.push({
      kind: 'settlement_delay',
      title: 'A payment to your bank is late',
      body: 'Some of your money has not reached your bank yet.',
      link: '/settlements',
    })
  }

  if (inv && inv.status === 'unpaid') {
    const m = Number(String(inv.month).slice(5, 7))
    const name = MONTHS[m - 1]
    if (name) {
      out.push({
        kind: 'invoice_ready',
        title: `Your ${name} invoice is ready`,
        body: `The total is ${formatSGD(num(inv.totalCents))}.`,
        link: '/invoices',
      })
    }
  }

  return out
}
