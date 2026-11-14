import { formatSGD } from '../money.js'
import { comparePeriods } from './summary.js'

/**
 * One plain-language sentence summarising how the period went.
 * With `subject` (an outlet name) the sentence is about that outlet instead of "you".
 * @param {{currCents: number, prevCents: number, periodLabel: string, subject?: string}} i
 * @returns {string}
 */
export function buildHeadline({ currCents, prevCents, periodLabel, subject }) {
  const who = subject?.trim()
  if (who) return outletHeadline(who, { currCents, prevCents, periodLabel })
  if (currCents <= 0) {
    return `No sales yet ${periodLabel}. Your figures will appear here as payments come in.`
  }
  if (prevCents <= 0) return `You made ${formatSGD(currCents)} ${periodLabel}.`

  const than = periodLabel === 'today' ? 'yesterday' : `last ${periodLabel === 'this month' ? 'month' : 'week'}`
  const curr = formatSGD(currCents)
  const { deltaCents, pct } = comparePeriods(currCents, prevCents)
  const delta = formatSGD(Math.abs(deltaCents))
  if (pct !== null && pct >= 2) {
    return `Business is good ${periodLabel}. You made ${curr}, which is ${delta} more than ${than}.`
  }
  if (pct !== null && pct <= -2) {
    return `Business is slower ${periodLabel}. You made ${curr}, which is ${delta} less than ${than}.`
  }
  return `Business is steady ${periodLabel}. You made ${curr}, about the same as ${than}.`
}


/**
 * @param {string} who outlet name
 * @param {{currCents: number, prevCents: number, periodLabel: string}} i
 */
function outletHeadline(who, { currCents, prevCents, periodLabel }) {
  if (currCents <= 0) return `No sales yet at ${who} ${periodLabel}. Your figures will appear here as payments come in.`
  if (prevCents <= 0) return `${who} made ${formatSGD(currCents)} ${periodLabel}.`
  const than = periodLabel === 'today' ? 'yesterday' : `last ${periodLabel === 'this month' ? 'month' : 'week'}`
  const curr = formatSGD(currCents)
  const { deltaCents, pct } = comparePeriods(currCents, prevCents)
  const delta = formatSGD(Math.abs(deltaCents))
  if (pct !== null && pct >= 2) return `${who} is doing well ${periodLabel}. It made ${curr}, which is ${delta} more than ${than}.`
  if (pct !== null && pct <= -2) return `${who} is slower ${periodLabel}. It made ${curr}, which is ${delta} less than ${than}.`
  return `${who} is steady ${periodLabel}. It made ${curr}, about the same as ${than}.`
}
