import { addDays, dayOfWeek, periodRange, sgtDate } from '../dates.js'
import { formatSGD } from '../money.js'
import { isSettlementLate } from '../settlements/status.js'
import { buildHeadline } from '../metrics/headline.js'
import { healthScore } from '../metrics/health.js'
import { busiestSlot, channelMix, comparePeriods, dailySeries, summarise } from '../metrics/summary.js'

/**
 * @typedef {import('../metrics/summary.js').DailySalesRow} DailySalesRow
 * @typedef {'today' | 'week' | 'month'} PeriodKind
 * @typedef {'ok' | 'bad' | 'info' | 'warn' | 'mute'} Tone
 * @typedef {{
 *   today: string, kind: PeriodKind, firstName?: string, hour?: number,
 *   outletName?: string, // set when one outlet is picked; the rows given are already only that outlet's
 *   currRows: DailySalesRow[], prevRows: DailySalesRow[], todayRows: DailySalesRow[],
 *   chartRows?: DailySalesRow[],
 *   heat: {dow: number, hour: number, grossCents: number}[],
 *   fees: {grossCents: number, feeCents: number},
 *   settlements: {businessDate: string, netCents: number, status: 'pending' | 'paid' | 'delayed', expectedDate: string | null}[],
 *   settlementSummary: {pendingCents: number, nextExpectedDate: string | null, lateCount: number, lateCents: number},
 *   recon: {runAt: string, period: string, matchedCount: number, exceptionCount: number, openCount: number, openDelayCount?: number, wholeBusinessCount?: number} | null,
 * }} HomeInput
 */

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Read the `?period=` search param. Anything else means 'week'.
 * @param {unknown} value
 * @returns {PeriodKind}
 */
export function parsePeriod(value) {
  return value === 'today' || value === 'month' || value === 'week' ? value : 'week'
}

/**
 * 'Mon 16 Nov' for a YYYY-MM-DD date.
 * @param {string} date
 * @returns {string}
 */
export function formatDayLabel(date) {
  const [, m, d] = date.split('-').map(Number)
  return `${WEEKDAY_SHORT[dayOfWeek(date)]} ${d} ${MONTH_SHORT[m - 1]}`
}

/**
 * @param {number} hour Singapore hour 0-23
 * @param {string} [userName]
 * @returns {string}
 */
export function greetingFor(hour, userName = '') {
  const g = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = userName.trim()
  return name ? `${g}, ${name}` : g
}

/**
 * The days the chart shows: the whole period, except 'today' which shows the last 7 days.
 * @param {PeriodKind} kind
 * @param {string} today
 * @returns {{from: string, to: string}}
 */
export function chartRange(kind, today) {
  if (kind === 'today') return { from: addDays(today, -6), to: today }
  const r = periodRange(kind, today)
  return { from: r.from, to: r.to }
}

/**
 * Plain status for one settlement. Late = delayed, or pending past its expected date; pending with no
 * expected date counts as on the way. Shared by Home and the Settlements page.
 * @param {'pending' | 'paid' | 'delayed'} status
 * @param {string | null} expectedDate YYYY-MM-DD
 * @param {string} today YYYY-MM-DD (Singapore)
 * @returns {{statusLabel: string, tone: Tone, late: boolean}}
 */
export function settlementStatus(status, expectedDate, today) {
  if (status === 'paid') return { statusLabel: 'In your bank', tone: 'ok', late: false }
  const late = isSettlementLate(status, expectedDate, today)
  if (late) {
    return { statusLabel: expectedDate ? `Late, due ${formatDayLabel(expectedDate)}` : 'Late', tone: 'bad', late: true }
  }
  return { statusLabel: expectedDate ? `Arriving ${formatDayLabel(expectedDate)}` : 'On its way', tone: 'info', late: false }
}

/** @param {number} n @param {string} one @param {string} many */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * Everything the Home page shows, as plain data. Pure: no database, no clock.
 * @param {HomeInput} input
 */
export function buildHomeModel(input) {
  const { today, kind, firstName = '', hour = 12 } = input
  const range = periodRange(kind, today)
  const upTo = (/** @type {DailySalesRow[]} */ rows, /** @type {string} */ last) => rows.filter((r) => r.day <= last)

  // Like-for-like: from..toDate against prevFrom..prevToDate (never a full period vs a part one).
  const curr = summarise(upTo(input.currRows, range.toDate))
  const prev = summarise(upTo(input.prevRows, range.prevToDate))
  const { pct } = comparePeriods(curr.grossCents, prev.grossCents)
  const prevWord = kind === 'today' ? 'yesterday' : kind === 'month' ? 'last month' : 'last week'

  const outletName = input.outletName?.trim() ?? ''
  const headline = buildHeadline({ currCents: curr.grossCents, prevCents: prev.grossCents, periodLabel: range.label, subject: outletName })
  const subline =
    kind === 'today'
      ? `Today · ${formatDayLabel(today)}`
      : `${range.label[0].toUpperCase()}${range.label.slice(1)} · ${formatDayLabel(range.from)} to ${formatDayLabel(range.toDate)}`

  // Tags
  /** @type {{label: string, tone: Tone}[]} */
  const tags = []
  if (pct !== null && Number.isFinite(pct) && curr.grossCents > 0) {
    const rounded = Math.round(Math.abs(pct))
    if (pct >= 2) tags.push({ label: `Up ${rounded}% on ${prevWord}`, tone: 'ok' })
    else if (pct <= -2) tags.push({ label: `Down ${rounded}% on ${prevWord}`, tone: 'bad' })
    else tags.push({ label: `About the same as ${prevWord}`, tone: 'mute' })
  }
  const busiest = busiestSlot(input.heat)
  if (busiest) tags.push({ label: `Busiest time (last 4 weeks): ${busiest.label}`, tone: 'info' })

  const failedRate = curr.txnCount > 0 ? curr.failedCount / curr.txnCount : 0
  const health = healthScore({ growthPct: pct, failedRate, delayedSettlements: input.settlementSummary.lateCount })
  tags.push({
    label: `Health score ${health.score} out of 100 · ${health.label}`,
    tone: health.label === 'Good' ? 'ok' : health.label === 'Okay' ? 'warn' : 'bad',
  })

  // Attention
  const todayTotals = summarise(input.todayRows)
  // A late settlement shows up in the check-up too; count it once, under "late".
  const openCount = Math.max(0, (input.recon?.openCount ?? 0) - (input.recon?.openDelayCount ?? 0))
  // With one outlet picked the bank figures are that outlet's share of each NETS payout.
  const payoutNote = outletName ? 'This outlet’s share of NETS payouts' : ''
  const failedToday = todayTotals.failedCount
  const lateCount = input.settlementSummary.lateCount
  /** @type {{key: string, title: string, detail: string, href: string, linkLabel: string, scope?: string}[]} */
  const items = []
  if (openCount > 0) {
    items.push({
      key: 'recon',
      title: `${plural(openCount, 'thing', 'things')} found in your check-up`,
      detail: 'Payments that do not match your bank money or your bill.',
      href: '/reconciliation',
      linkLabel: 'See why',
    })
  }
  if (failedToday > 0) {
    items.push({
      key: 'failed',
      title: `${plural(failedToday, 'payment', 'payments')} didn’t go through today`,
      detail: 'Customers may need to try again.',
      href: '/transactions?status=failed',
      linkLabel: 'See which',
    })
  }
  if (lateCount > 0) {
    items.push({
      key: 'late',
      title: `${plural(lateCount, 'day’s money is', 'days’ money is')} late`,
      detail: `${formatSGD(input.settlementSummary.lateCents)} has not reached your bank yet (all late days, not just recent ones).`,
      href: '/settlements',
      linkLabel: 'See money to your bank',
    })
  }
  const attentionCount = openCount + failedToday + lateCount
  const wholeCount = outletName ? (input.recon?.wholeBusinessCount ?? 0) : 0
  const wholeBusiness =
    wholeCount > 0
      ? { text: `Plus ${plural(wholeCount, 'check-up item', 'check-up items')} for the whole business`, href: '/reconciliation' }
      : undefined

  // Tiles
  const paymentsToday = todayTotals.txnCount - todayTotals.failedCount
  const todayHint =
    todayTotals.txnCount === 0
      ? 'No payments yet today'
      : `${plural(paymentsToday, 'payment', 'payments')} so far` +
        (failedToday > 0 ? ` · ${failedToday} didn’t go through` : '')
  const nextDate = input.settlementSummary.nextExpectedDate
  const onTheWay = input.settlementSummary.pendingCents
  const lateCents = input.settlementSummary.lateCents
  const tiles = [
    { label: 'Money in today', value: formatSGD(todayTotals.grossCents), hint: todayHint, tone: 'default' },
    {
      label: 'Coming to your bank',
      scope: payoutNote || undefined,
      value: formatSGD(onTheWay),
      hint: onTheWay > 0 && nextDate ? `Next: ${formatDayLabel(nextDate)}` : onTheWay > 0 ? 'On its way' : 'Nothing on the way right now',
      note: lateCents > 0 ? `Plus ${formatSGD(lateCents)} late — see Needs your attention` : undefined,
      tone: 'default',
    },
    {
      label: 'Needs your attention',
      value: attentionCount === 0 ? 'Nothing' : plural(attentionCount, 'thing', 'things'),
      hint: attentionCount === 0 ? 'All clear for now' : '',
      tone: attentionCount === 0 ? 'default' : 'attention',
      href: attentionCount === 0 ? undefined : items[0].href,
      linkLabel: attentionCount === 0 ? undefined : 'See what to do',
    },
  ]

  // Chart
  const cr = chartRange(kind, today)
  const series = dailySeries(input.chartRows ?? input.currRows, cr.from, cr.to).map((s) => ({
    ...s,
    isFuture: s.day > today,
  }))
  let bestIndex = -1
  series.forEach((s, i) => {
    if (s.grossCents > 0 && (bestIndex === -1 || s.grossCents > series[bestIndex].grossCents)) bestIndex = i
  })
  const chartHasData = bestIndex !== -1
  const chart = {
    title: kind === 'today' ? 'Sales, last 7 days' : kind === 'month' ? 'Sales this month' : 'Sales this week',
    series,
    bestIndex,
    hasData: chartHasData,
    ariaLabel: chartHasData
      ? `Daily sales, highest on ${WEEKDAY_LONG[dayOfWeek(series[bestIndex].day)]} at ${formatSGD(series[bestIndex].grossCents)}`
      : 'No sales yet for this period',
  }

  // Money flow (successful payments, from..toDate)
  const grossCents = input.fees.grossCents
  const feeCents = input.fees.feeCents
  const netCents = grossCents - feeCents
  const flow = {
    title: `Where your money went ${range.label}`,
    hasData: grossCents > 0,
    grossCents,
    feeCents,
    netCents,
    ariaLabel:
      grossCents > 0
        ? `Of ${formatSGD(grossCents)} in sales, ${formatSGD(feeCents)} went to NETS fees and ${formatSGD(netCents)} goes to your bank`
        : 'No sales yet for this period',
  }

  const mix = channelMix(upTo(input.currRows, range.toDate)).map((c) => ({
    channel: c.channel,
    label: c.label,
    pct: Math.round(c.share * 100),
  }))

  const settlements = input.settlements.map((s) => {
    const { statusLabel, tone } = settlementStatus(s.status, s.expectedDate, today)
    return { key: s.businessDate, dateLabel: formatDayLabel(s.businessDate), amount: formatSGD(s.netCents), statusLabel, tone }
  })

  const recon = input.recon
  const checkup = recon
    ? {
        hasRun: true,
        lastRun: `Last checked ${formatDayLabel(sgtDate(recon.runAt))}`,
        summary: outletName
          ? recon.openCount > 0
            ? `${plural(recon.openCount, 'thing needs', 'things need')} a look at this outlet`
            : 'Nothing needs a look at this outlet'
          : `${plural(recon.matchedCount, 'payment', 'payments')} matched · ${
              recon.openCount > 0 ? `${recon.openCount} need a look` : 'nothing needs a look'
            }`,
        openCount: recon.openCount,
      }
    : { hasRun: false, lastRun: '', summary: '', openCount: 0 }

  return {
    greeting: greetingFor(hour, firstName),
    headline,
    subline,
    tags,
    tiles,
    chart,
    flow,
    mix,
    settlements,
    attention: { count: attentionCount, items, wholeBusiness },
    checkup,
    periodLabel: range.label,
    outletName,
    payoutNote,
  }
}
