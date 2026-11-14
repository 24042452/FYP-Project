import { monthName } from './reconcile.js'
import { monthEnd } from '../dates.js'
import { formatSGD } from '../money.js'

/** Plain-English heading for each kind of problem, with the technical term to show underneath. */
export const EXCEPTION_KINDS = {
  amount_mismatch: { title: 'Money is short', tech: 'Amount mismatch' },
  missing_settlement: { title: 'Money has not arrived', tech: 'Missing settlement' },
  settlement_delay: { title: 'Money is late', tech: 'Settlement delay' },
  fee_mismatch: { title: 'Fees look wrong', tech: 'Fee mismatch' },
  failed_payment: { title: 'Payments that failed', tech: 'Failed payment' },
}

/** @param {keyof typeof EXCEPTION_KINDS} type */
export const exceptionTitle = (type) => EXCEPTION_KINDS[type]?.title ?? 'Needs a look'

/** @param {string} ym YYYY-MM @returns {string} 'October' */
export const invoiceMonthName = (ym) => monthName(ym)

/**
 * Money problems only: failed payments are a summary, not something to "need a look" at.
 * @param {{type: string}[]} exceptions
 */
export const moneyProblems = (exceptions) => exceptions.filter((e) => e.type !== 'failed_payment')

/**
 * Failed payments in a check-up, summed.
 * @param {{type: string, expectedCents: number | null}[]} exceptions
 * @returns {{count: number, totalCents: number}}
 */
export function failedSummary(exceptions) {
  const f = exceptions.filter((e) => e.type === 'failed_payment')
  return { count: f.length, totalCents: f.reduce((s, e) => s + (e.expectedCents ?? 0), 0) }
}

/**
 * Everything the Check-up page shows for a stored run, as plain data. Pure.
 * @param {import('../data/recon.js').ReconRun & {exceptions: import('../data/recon.js').StoredException[]}} run
 */
export function buildRunView(run) {
  const checked = run.checkedCount
  const problems = moneyProblems(run.exceptions)
  const need = problems.length
  const open = problems.filter((e) => e.status === 'open')
  const resolved = problems.filter((e) => e.status === 'resolved')
  const failed = failedSummary(run.exceptions)
  const matchRate = checked === 0 ? 1 : run.matchedCount / checked
  const month = run.period.slice(0, 7)
  /** @type {{type: string, title: string, tech: string, items: typeof open}[]} */
  const groups = []
  for (const type of /** @type {(keyof typeof EXCEPTION_KINDS)[]} */ (Object.keys(EXCEPTION_KINDS))) {
    const items = open.filter((e) => e.type === type)
    if (items.length) groups.push({ type, ...EXCEPTION_KINDS[type], items })
  }
  return {
    checked, need, matchRate, matchPercent: `${Math.round(matchRate * 100)}%`,
    openCount: open.length, groups, resolved,
    failed: failed.count > 0
      ? {
          text: `${failed.count} ${failed.count === 1 ? 'payment' : 'payments'} didn't go through this month (${formatSGD(failed.totalCents)})`,
          href: `/transactions?status=failed&from=${month}-01&to=${monthEnd(`${month}-01`)}`,
        }
      : null,
    isEmpty: checked === 0 && need === 0 && failed.count === 0,
    headline: `We checked ${checked} ${checked === 1 ? 'item' : 'items'}. ${need} ${need === 1 ? 'needs' : 'need'} a look.`,
  }
}
