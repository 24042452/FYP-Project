// The franchise HQ overview: every franchisee side by side. Pure, so it is unit-tested;
// app/(portal)/group/page.jsx gathers the numbers for each franchisee and calls buildGroupModel.
import { formatSGD } from '../money.js'
import { comparePeriods } from '../metrics/summary.js'

/**
 * @typedef {{
 *   id: string, tradingName: string, outlets: number,
 *   currCents: number, prevCents: number, todayCents: number,
 *   lateCount: number, lateCents: number, openProblems: number,
 * }} FranchiseeFigures
 *   currCents/prevCents: this week so far and the same days last week (like for like)
 */

/** @param {number | null} pct */
function changeText(pct) {
  if (pct === null) return { text: 'New this week', tone: /** @type {const} */ ('mute') }
  const r = Math.round(pct * 10) / 10
  if (r === 0) return { text: 'Same as last week', tone: /** @type {const} */ ('mute') }
  return r > 0
    ? { text: `Up ${r}% on last week`, tone: /** @type {const} */ ('ok') }
    : { text: `Down ${Math.abs(r)}% on last week`, tone: /** @type {const} */ ('bad') }
}

/** @param {number} n @param {string} one @param {string} many */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * @param {{groupName: string, franchisees: FranchiseeFigures[]}} input
 */
export function buildGroupModel({ groupName, franchisees }) {
  const currCents = franchisees.reduce((s, f) => s + f.currCents, 0)
  const prevCents = franchisees.reduce((s, f) => s + f.prevCents, 0)
  const todayCents = franchisees.reduce((s, f) => s + f.todayCents, 0)
  const outlets = franchisees.reduce((s, f) => s + f.outlets, 0)
  const total = comparePeriods(currCents, prevCents)
  const totalChange = changeText(total.pct)

  const rows = [...franchisees]
    .sort((a, b) => b.currCents - a.currCents)
    .map((f) => {
      const c = changeText(comparePeriods(f.currCents, f.prevCents).pct)
      /** @type {string[]} */
      const issues = []
      if (f.lateCount > 0) issues.push(`${plural(f.lateCount, 'late payout', 'late payouts')} (${formatSGD(f.lateCents)})`)
      if (f.openProblems > 0) issues.push(plural(f.openProblems, 'check-up item', 'check-up items'))
      return {
        id: f.id,
        name: f.tradingName,
        outlets: plural(f.outlets, 'outlet', 'outlets'),
        week: formatSGD(f.currCents),
        today: formatSGD(f.todayCents),
        change: c.text,
        changeTone: c.tone,
        sharePct: currCents > 0 ? Math.round((f.currCents * 1000) / currCents) / 10 : 0,
        status: issues.length > 0 ? { tone: /** @type {const} */ ('warn'), label: 'Needs a look' } : { tone: /** @type {const} */ ('ok'), label: 'Healthy' },
        issues,
      }
    })

  const needLook = rows.filter((r) => r.issues.length > 0)
  const best = rows[0]

  const direction =
    total.pct === null ? '' : Math.round(total.pct * 10) / 10 === 0 ? ', the same as last week' : `, ${totalChange.text.toLowerCase()}`
  return {
    headline: `${groupName} made ${formatSGD(currCents)} this week${direction}.`,
    subline:
      `Across ${plural(franchisees.length, 'franchisee', 'franchisees')} and ${plural(outlets, 'outlet', 'outlets')}. ` +
      'We compare the same days of last week, so a half-finished week never looks like a bad week.',
    tiles: [
      { label: 'Sales this week', value: formatSGD(currCents), note: totalChange.text, tone: totalChange.tone },
      { label: 'Sales today', value: formatSGD(todayCents), note: `All ${plural(outlets, 'outlet', 'outlets')}`, tone: /** @type {const} */ ('mute') },
      {
        label: 'Franchisees to look at',
        value: String(needLook.length),
        note: needLook.length === 0 ? 'Everyone is on track' : needLook.map((r) => r.name).join(', '),
        tone: needLook.length === 0 ? /** @type {const} */ ('ok') : /** @type {const} */ ('warn'),
      },
    ],
    rows,
    best: best && currCents > 0 ? `${best.name} sold the most this week (${best.sharePct}% of the group).` : null,
  }
}
