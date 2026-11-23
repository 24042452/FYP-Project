import { CHANNEL_LABELS } from '../channels.js'
import { addMonths, monthEnd, monthStart } from '../dates.js'
import { formatSGD } from '../money.js'
import { formatDayLabel, settlementStatus } from '../dashboard/home-model.js'

/** @typedef {'paid' | 'on_the_way' | 'late'} StatusFilter */

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

/** @param {string} ym YYYY-MM */
function monthName(ym) {
  return MONTH_LONG[Number(ym.slice(5, 7)) - 1]
}

/**
 * Read `?month=YYYY-MM`. Anything invalid, or after the current month, means the current month.
 * @param {unknown} value
 * @param {string} today YYYY-MM-DD (Singapore)
 * @returns {string} YYYY-MM
 */
export function parseMonth(value, today) {
  const current = today.slice(0, 7)
  if (typeof value !== 'string' || !MONTH_RE.test(value) || value > current) return current
  return value
}

/**
 * Read `?status=`. Anything else means no filter.
 * @param {unknown} value
 * @returns {StatusFilter | undefined}
 */
export function parseSettlementStatus(value) {
  return value === 'paid' || value === 'on_the_way' || value === 'late' ? value : undefined
}

/**
 * The first and last day of a YYYY-MM month.
 * @param {string} ym
 * @returns {{from: string, to: string}}
 */
export function monthBounds(ym) {
  const from = monthStart(`${ym}-01`)
  return { from, to: monthEnd(from) }
}

/**
 * Everything the Settlements page shows, as plain data. Pure: no database, no clock.
 * @param {{
 *   month: string, today: string, status?: StatusFilter,
 *   rows: import('../data/settlements.js').SettlementRow[],
 *   totals: {paidCents: number, onTheWayCents: number, lateCents: number, lateCount: number},
 * }} input
 */
export function buildSettlementsModel({ month, today, status, rows, totals }) {
  const isCurrent = month === today.slice(0, 7)
  const name = monthName(month)
  const year = month.slice(0, 4)
  const href = (/** @type {string} */ m, /** @type {StatusFilter | undefined} */ s) =>
    `/settlements?month=${m}${s ? `&status=${s}` : ''}`

  const tiles = [
    {
      label: isCurrent ? 'In your bank this month' : `In your bank in ${name}`,
      value: formatSGD(totals.paidCents),
      hint: `Paid out in ${name} ${year}`,
      tone: 'default',
    },
    {
      label: 'On the way',
      value: formatSGD(totals.onTheWayCents),
      hint: 'Not due yet · all months',
      tone: 'default',
    },
    {
      label: 'Late',
      value: formatSGD(totals.lateCents),
      hint:
        totals.lateCount > 0
          ? `${totals.lateCount} ${totals.lateCount === 1 ? 'day' : 'days'} · all months`
          : 'Nothing late · all months',
      tone: totals.lateCents > 0 ? 'attention' : 'default',
    },
  ]

  /** @type {{key: string, dateLabel: string, totalNet: string, rows: any[]}[]} */
  const groups = []
  /** @type {Map<string, number>} */
  const sums = new Map()
  for (const r of rows) {
    const st = settlementStatus(r.status, r.expectedDate, today)
    // The status pill already says when money is due; only a paid row needs its paid date.
    const dateNote = r.status === 'paid' && r.paidDate ? `Paid ${formatDayLabel(r.paidDate)}` : ''
    let g = groups[groups.length - 1]
    if (!g || g.key !== r.businessDate) {
      g = { key: r.businessDate, dateLabel: formatDayLabel(r.businessDate), totalNet: '', rows: [] }
      groups.push(g)
    }
    sums.set(r.businessDate, (sums.get(r.businessDate) ?? 0) + r.netCents)
    g.rows.push({
      key: r.id,
      channelLabel: CHANNEL_LABELS[r.channel] ?? r.channel,
      net: formatSGD(r.netCents),
      detail: `Sales ${formatSGD(r.grossCents)} · NETS fees ${formatSGD(r.feeCents)}`,
      statusLabel: st.statusLabel,
      tone: st.tone,
      dateNote,
      refundsLabel: r.refundCents > 0 ? `Refunds −${formatSGD(r.refundCents)}` : null,
    })
  }
  for (const g of groups) g.totalNet = formatSGD(sums.get(g.key) ?? 0)

  const filters = /** @type {[string, StatusFilter | undefined][]} */ ([
    ['All', undefined],
    ['In your bank', 'paid'],
    ['On the way', 'on_the_way'],
    ['Late', 'late'],
  ]).map(([label, s]) => ({ label, href: href(month, s), active: s === status }))

  return {
    tiles,
    groups,
    isEmpty: rows.length === 0,
    emptyText: 'No payments to your bank in this period',
    monthLabel: `${name} ${year}`,
    prevHref: href(addMonths(`${month}-01`, -1).slice(0, 7), status),
    nextHref: isCurrent ? null : href(addMonths(`${month}-01`, 1).slice(0, 7), status),
    filters,
  }
}
