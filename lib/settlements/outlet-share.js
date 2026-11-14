import { isSettlementLate } from './status.js'

/**
 * @typedef {import('../data/settlements.js').OutletShareRow} OutletShareRow
 * @typedef {import('../data/settlements.js').SettlementDay} SettlementDay
 */

/**
 * The same figures as getSettlementSummary, but from one outlet's share of each settlement.
 * Late = delayed, or pending past its expected date (the one shared rule). Pending money not yet due is "on the way".
 * @param {OutletShareRow[]} rows
 * @param {string} today YYYY-MM-DD (Singapore)
 * @returns {{pendingCents: number, nextExpectedDate: string | null, lateCount: number, lateCents: number}}
 */
export function shareSummary(rows, today) {
  let pendingCents = 0
  let lateCents = 0
  /** @type {string | null} */
  let next = null
  const lateDays = new Set()
  for (const r of rows) {
    if (isSettlementLate(r.status, r.expectedDate, today)) {
      lateCents += r.netCents
      lateDays.add(r.businessDate)
    } else if (r.status === 'pending') {
      pendingCents += r.netCents
      if (r.expectedDate && r.expectedDate >= today && (next === null || r.expectedDate < next)) next = r.expectedDate
    }
  }
  return { pendingCents, nextExpectedDate: next, lateCount: lateDays.size, lateCents }
}

/**
 * The newest settlement days of an outlet's share, one row per day (like getRecentSettlements):
 * status is delayed if any part is delayed, else pending if any is pending, else paid.
 * @param {OutletShareRow[]} rows
 * @param {number} limit how many days
 * @returns {SettlementDay[]}
 */
export function shareDays(rows, limit) {
  /** @type {Map<string, SettlementDay & {anyDelayed: boolean, anyPending: boolean, openExpected: string | null, anyExpected: string | null}>} */
  const days = new Map()
  for (const r of rows) {
    const d = days.get(r.businessDate) ?? { businessDate: r.businessDate, netCents: 0, status: 'paid', expectedDate: null, anyDelayed: false, anyPending: false, openExpected: null, anyExpected: null }
    d.netCents += r.netCents
    if (r.status === 'delayed') d.anyDelayed = true
    if (r.status === 'pending') d.anyPending = true
    if (r.status !== 'paid' && r.expectedDate && (d.openExpected === null || r.expectedDate > d.openExpected)) d.openExpected = r.expectedDate
    if (r.expectedDate && (d.anyExpected === null || r.expectedDate > d.anyExpected)) d.anyExpected = r.expectedDate
    days.set(r.businessDate, d)
  }
  return [...days.values()]
    .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
    .slice(0, Math.max(0, limit))
    .map((d) => ({
      businessDate: d.businessDate,
      netCents: d.netCents,
      status: d.anyDelayed ? 'delayed' : d.anyPending ? 'pending' : 'paid',
      expectedDate: d.openExpected ?? d.anyExpected,
    }))
}
