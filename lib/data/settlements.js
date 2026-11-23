import { query } from '../db.js'
import { addDays, sgtDate } from '../dates.js'

/**
 * @typedef {{businessDate: string, netCents: number, refundCents: number, status: 'pending' | 'paid' | 'delayed', expectedDate: string | null}} SettlementDay
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
            SUM(refund_cents) AS refundCents,
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
    refundCents: Number(r.refundCents),
    status: Number(r.anyDelayed) ? 'delayed' : Number(r.anyPending) ? 'pending' : 'paid',
    expectedDate: r.openExpected ?? r.anyExpected ?? null,
  }))
}

/**
 * Money truly on its way (pending and not yet due), and what is late (delayed, or pending past its expected date) across all time (the same rule as the Money to my bank tiles). lateCount counts settlement days.
 * @param {string} merchantId
 * @param {string} today YYYY-MM-DD (Singapore)
 * @returns {Promise<{pendingCents: number, nextExpectedDate: string | null, lateCount: number, lateCents: number}>}
 */
export async function getSettlementSummary(merchantId, today) {
  const rows = await query(
    `SELECT COALESCE(SUM(CASE WHEN status = 'pending' AND (expected_date IS NULL OR expected_date >= ?) THEN net_cents ELSE 0 END), 0) AS pendingCents,
            MIN(CASE WHEN status = 'pending' AND expected_date >= ? THEN expected_date END) AS nextExpected
       FROM settlements
      WHERE merchant_id = ?`,
    [today, today, merchantId],
  )
  const late = await query(
    `SELECT COUNT(DISTINCT business_date) AS lateCount, COALESCE(SUM(net_cents), 0) AS lateCents
       FROM settlements
      WHERE merchant_id = ?
        AND (status = 'delayed' OR (status = 'pending' AND expected_date < ?))`,
    [merchantId, today],
  )
  return {
    pendingCents: Number(rows[0]?.pendingCents ?? 0),
    nextExpectedDate: rows[0]?.nextExpected ?? null,
    lateCount: Number(late[0]?.lateCount ?? 0),
    lateCents: Number(late[0]?.lateCents ?? 0),
  }
}

/**
 * SQL for each status filter. 'on_the_way' = pending and not yet due; 'late' = delayed, or pending past its date.
 * Each uses one `?` for today (Singapore) where it needs it.
 */
const ON_THE_WAY = `status = 'pending' AND (expected_date IS NULL OR expected_date >= ?)`
const LATE = `(status = 'delayed' OR (status = 'pending' AND expected_date < ?))`

/**
 * @typedef {{
 *   id: string, businessDate: string, channel: import('../channels.js').Channel, grossCents: number,
 *   feeCents: number, refundCents: number, netCents: number, status: 'pending' | 'paid' | 'delayed',
 *   expectedDate: string | null, paidDate: string | null
 * }} SettlementRow
 */

/**
 * Individual settlements with a business date from..to (inclusive), newest first.
 * @param {string} merchantId
 * @param {{from: string, to: string, status?: 'paid' | 'on_the_way' | 'late', today?: string}} opts today defaults to the Singapore date
 * @returns {Promise<SettlementRow[]>}
 */
export async function listSettlements(merchantId, { from, to, status, today = sgtDate(new Date().toISOString()) }) {
  let where = ''
  /** @type {string[]} */
  const extra = []
  if (status === 'paid') where = `AND status = 'paid'`
  else if (status === 'on_the_way') {
    where = `AND ${ON_THE_WAY}`
    extra.push(today)
  } else if (status === 'late') {
    where = `AND ${LATE}`
    extra.push(today)
  }
  const rows = await query(
    `SELECT settlement_id AS id, business_date AS businessDate, channel, gross_cents AS grossCents, fee_cents AS feeCents, refund_cents AS refundCents,
            net_cents AS netCents, status, expected_date AS expectedDate, paid_date AS paidDate
       FROM settlements
      WHERE merchant_id = ? AND business_date >= ? AND business_date <= ? ${where}
      ORDER BY business_date DESC, channel ASC, settlement_id ASC`,
    [merchantId, from, to, ...extra],
  )
  return rows.map((r) => ({
    id: String(r.id),
    businessDate: String(r.businessDate),
    channel: r.channel,
    grossCents: Number(r.grossCents),
    feeCents: Number(r.feeCents),
    refundCents: Number(r.refundCents),
    netCents: Number(r.netCents),
    status: r.status,
    expectedDate: r.expectedDate == null ? null : String(r.expectedDate),
    paidDate: r.paidDate == null ? null : String(r.paidDate),
  }))
}

/**
 * The three tiles: paid into the bank with a paid date from..to; on the way (pending, not yet due) and late
 * (delayed, or pending past its date), both across all time.
 * @param {string} merchantId
 * @param {{from: string, to: string, today: string}} opts
 * @returns {Promise<{paidCents: number, onTheWayCents: number, lateCents: number, lateCount: number}>}
 */
export async function getSettlementTotals(merchantId, { from, to, today }) {
  const rows = await query(
    `SELECT COALESCE(SUM(CASE WHEN status = 'paid' AND paid_date >= ? AND paid_date <= ? THEN net_cents ELSE 0 END), 0) AS paidCents,
            COALESCE(SUM(CASE WHEN ${ON_THE_WAY} THEN net_cents ELSE 0 END), 0) AS onTheWayCents,
            COALESCE(SUM(CASE WHEN ${LATE} THEN net_cents ELSE 0 END), 0) AS lateCents,
            COUNT(DISTINCT CASE WHEN ${LATE} THEN business_date END) AS lateCount
       FROM settlements
      WHERE merchant_id = ?`,
    [from, to, today, today, today, merchantId],
  )
  const r = rows[0] ?? {}
  return {
    paidCents: Number(r.paidCents ?? 0),
    onTheWayCents: Number(r.onTheWayCents ?? 0),
    lateCents: Number(r.lateCents ?? 0),
    lateCount: Number(r.lateCount ?? 0),
  }
}

/**
 * @typedef {{
 *   id: string, businessDate: string, channel: import('../channels.js').Channel, status: 'pending' | 'paid' | 'delayed',
 *   expectedDate: string | null, paidDate: string | null, grossCents: number, feeCents: number, refundCents: number, netCents: number
 * }} OutletShareRow
 */

/**
 * One outlet's share of each NETS settlement. NETS pays the whole business, but a settlement is made of
 * payments (transactions.settlement_id), so this adds up the outlet's payments inside each one (successful, and refunded ones, which were still paid out that day) and takes off the outlet's refunds.
 * Returns settlements with a business date on or after `since`, plus every settlement that is not paid yet
 * (those are needed to find what is on the way or late). Newest first. An outlet of another merchant matches nothing.
 * @param {string} merchantId
 * @param {string} outletId
 * @param {{since: string}} opts since = YYYY-MM-DD
 * @returns {Promise<OutletShareRow[]>}
 */
export async function getOutletSettlementShares(merchantId, outletId, { since }) {
  // Payments (paid out that day, even if refunded later) and refunds (taken from the payout on the refund day)
  // of this outlet are summed separately per settlement, so a payout holding only this outlet's refunds still shows.
  const rows = await query(
    `SELECT s.settlement_id AS id, s.business_date AS businessDate, s.channel, s.status, s.expected_date AS expectedDate, s.paid_date AS paidDate,
            COALESCE(p.grossCents, 0) AS grossCents, COALESCE(p.feeCents, 0) AS feeCents, COALESCE(r.refundCents, 0) AS refundCents
       FROM settlements s
       LEFT JOIN (
         SELECT settlement_id, SUM(amount_cents) AS grossCents, SUM(fee_cents) AS feeCents
           FROM transactions
          WHERE merchant_id = ? AND outlet_id = ? AND status IN ('success','refunded') AND settlement_id IS NOT NULL
          GROUP BY settlement_id
       ) p ON p.settlement_id = s.settlement_id
       LEFT JOIN (
         SELECT rf.settlement_id, SUM(rf.amount_cents) AS refundCents
           FROM refunds rf
           JOIN transactions t ON rf.transaction_id = t.transaction_id AND rf.merchant_id = t.merchant_id
          WHERE rf.merchant_id = ? AND t.outlet_id = ? AND rf.settlement_id IS NOT NULL
          GROUP BY rf.settlement_id
       ) r ON r.settlement_id = s.settlement_id
      WHERE s.merchant_id = ? AND (p.settlement_id IS NOT NULL OR r.settlement_id IS NOT NULL)
        AND (s.business_date >= ? OR s.status <> 'paid')
      ORDER BY s.business_date DESC, s.channel ASC, s.settlement_id ASC`,
    [merchantId, outletId, merchantId, outletId, merchantId, since],
  )
  return rows.map((r) => ({
    id: String(r.id),
    businessDate: String(r.businessDate),
    channel: r.channel,
    status: r.status,
    expectedDate: r.expectedDate == null ? null : String(r.expectedDate),
    paidDate: r.paidDate == null ? null : String(r.paidDate),
    grossCents: Number(r.grossCents),
    feeCents: Number(r.feeCents),
    refundCents: Number(r.refundCents),
    netCents: Number(r.grossCents) - Number(r.feeCents) - Number(r.refundCents),
  }))
}
