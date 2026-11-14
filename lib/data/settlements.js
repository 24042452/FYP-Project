import { query } from '../db.js'
import { addDays } from '../dates.js'

/**
 * @typedef {{businessDate: string, netCents: number, status: 'pending' | 'paid' | 'delayed', expectedDate: string | null}} SettlementDay
 */

/**
 * The most recent settlement days, newest first. A day with several channels becomes one
 * row: net summed; status is delayed if any part is delayed, else pending if any part is
 * pending, else paid.
 * @param {string} merchantId
 * @param {number} limit how many days (1 to 50)
 * @returns {Promise<SettlementDay[]>}
 */
export async function getRecentSettlements(merchantId, limit) {
  // LIMIT cannot take a placeholder in a prepared statement here, so it is clamped to an integer.
  const n = Math.min(50, Math.max(1, Math.trunc(Number(limit)) || 1))
  const rows = await query(
    `SELECT business_date AS businessDate,
            SUM(net_cents) AS netCents,
            MAX(status = 'delayed') AS anyDelayed,
            MAX(status = 'pending') AS anyPending,
            MAX(CASE WHEN status <> 'paid' THEN expected_date END) AS openExpected,
            MAX(expected_date) AS anyExpected
       FROM settlements
      WHERE merchant_id = ?
      GROUP BY business_date
      ORDER BY business_date DESC
      LIMIT ${n}`,
    [merchantId],
  )
  return rows.map((r) => ({
    businessDate: String(r.businessDate),
    netCents: Number(r.netCents),
    status: Number(r.anyDelayed) ? 'delayed' : Number(r.anyPending) ? 'pending' : 'paid',
    expectedDate: r.openExpected ?? r.anyExpected ?? null,
  }))
}

/**
 * Money on its way, and what is late (delayed, or pending past its expected date) in the
 * last 30 days. lateCount counts settlement days.
 * @param {string} merchantId
 * @param {string} today YYYY-MM-DD (Singapore)
 * @returns {Promise<{pendingCents: number, nextExpectedDate: string | null, lateCount: number, lateCents: number}>}
 */
export async function getSettlementSummary(merchantId, today) {
  const rows = await query(
    `SELECT COALESCE(SUM(CASE WHEN status = 'pending' THEN net_cents ELSE 0 END), 0) AS pendingCents,
            MIN(CASE WHEN status = 'pending' AND expected_date >= ? THEN expected_date END) AS nextExpected
       FROM settlements
      WHERE merchant_id = ?`,
    [today, merchantId],
  )
  const late = await query(
    `SELECT COUNT(DISTINCT business_date) AS lateCount, COALESCE(SUM(net_cents), 0) AS lateCents
       FROM settlements
      WHERE merchant_id = ? AND business_date >= ?
        AND (status = 'delayed' OR (status = 'pending' AND expected_date < ?))`,
    [merchantId, addDays(today, -30), today],
  )
  return {
    pendingCents: Number(rows[0]?.pendingCents ?? 0),
    nextExpectedDate: rows[0]?.nextExpected ?? null,
    lateCount: Number(late[0]?.lateCount ?? 0),
    lateCents: Number(late[0]?.lateCents ?? 0),
  }
}
