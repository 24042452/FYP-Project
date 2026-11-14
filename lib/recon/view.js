import { monthName } from './reconcile.js'

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
 * How many items a stored check-up looked at: the matched ones plus each settlement or bill line that had a problem
 * (a settlement with two problems still counts once). Failed and missing payments are not "items checked".
 * @param {number} matchedCount
 * @param {{type: string, settlementId: string | null, channel: string | null}[]} exceptions
 */
export function itemsChecked(matchedCount, exceptions) {
  const problems = new Set()
  for (const e of exceptions) {
    if (e.type === 'amount_mismatch' || e.type === 'settlement_delay') problems.add(`s:${e.settlementId}`)
    else if (e.type === 'fee_mismatch') problems.add(`f:${e.channel}`)
  }
  return matchedCount + problems.size
}

/**
 * Everything the Check-up page shows for a stored run, as plain data. Pure.
 * @param {import('../data/recon.js').ReconRun & {exceptions: import('../data/recon.js').StoredException[]}} run
 */
export function buildRunView(run) {
  const checked = itemsChecked(run.matchedCount, run.exceptions)
  const need = run.exceptions.length
  const open = run.exceptions.filter((e) => e.status === 'open')
  const resolved = run.exceptions.filter((e) => e.status === 'resolved')
  const matchRate = checked === 0 ? 1 : run.matchedCount / checked
  /** @type {{type: string, title: string, tech: string, items: typeof open}[]} */
  const groups = []
  for (const type of /** @type {(keyof typeof EXCEPTION_KINDS)[]} */ (Object.keys(EXCEPTION_KINDS))) {
    const items = open.filter((e) => e.type === type)
    if (items.length) groups.push({ type, ...EXCEPTION_KINDS[type], items })
  }
  return {
    checked, need, matchRate, matchPercent: `${Math.round(matchRate * 100)}%`,
    openCount: open.length, groups, resolved,
    isEmpty: checked === 0 && need === 0,
    headline: `We checked ${checked} ${checked === 1 ? 'item' : 'items'}. ${need} ${need === 1 ? 'needs' : 'need'} a look.`,
  }
}
