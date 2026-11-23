import { query } from '../db.js'
import { addDays, sgtToIso } from '../dates.js'

/**
 * @typedef {import('../metrics/summary.js').DailySalesRow} DailySalesRow
 */

/**
 * UTC bounds for SGT dates `from`..`to` inclusive, as MySQL DATETIME(3) strings.
 * Plain `created_at` comparisons let MySQL use the (merchant_id, created_at) index.
 * @param {string} from YYYY-MM-DD (Singapore)
 * @param {string} to YYYY-MM-DD (Singapore), inclusive
 * @returns {[string, string]} [start (inclusive), end (exclusive)]
 */
export function utcBounds(from, to) {
  const fmt = (/** @type {string} */ iso) => iso.replace('T', ' ').replace('Z', '')
  return [fmt(sgtToIso(from, 0, 0)), fmt(sgtToIso(addDays(to, 1), 0, 0))]
}

/** @param {string | null | undefined} outletId */
const outletClause = (outletId) => (outletId ? ' AND outlet_id = ?' : '')
/** @param {string | null | undefined} outletId */
const outletParams = (outletId) => (outletId ? [outletId] : [])

/**
 * Daily sales per channel. Gross counts successful payments only; txnCount counts all
 * attempts except refunded ones (their sales are not in gross) and failedCount the failed ones. Days are Singapore calendar days.
 * @param {string} merchantId
 * @param {string} from YYYY-MM-DD (Singapore), inclusive
 * @param {string} to YYYY-MM-DD (Singapore), inclusive
 * @param {string | null} [outletId] only this outlet (an outlet of another merchant matches nothing)
 * @returns {Promise<DailySalesRow[]>}
 */
export async function getDailySales(merchantId, from, to, outletId = null) {
  const [start, end] = utcBounds(from, to)
  const rows = await query(
    `SELECT DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+08:00'), '%Y-%m-%d') AS day,
            channel,
            COALESCE(SUM(CASE WHEN status = 'success' THEN amount_cents ELSE 0 END), 0) AS grossCents,
            COALESCE(SUM(status <> 'refunded'), 0) AS txnCount,
            COALESCE(SUM(status = 'failed'), 0) AS failedCount
       FROM transactions
      WHERE merchant_id = ? AND created_at >= ? AND created_at < ?${outletClause(outletId)}
      GROUP BY day, channel
      ORDER BY day, channel`,
    [merchantId, start, end, ...outletParams(outletId)],
  )
  return rows.map((r) => ({
    day: r.day,
    channel: r.channel,
    grossCents: Number(r.grossCents),
    txnCount: Number(r.txnCount),
    failedCount: Number(r.failedCount),
  }))
}

/**
 * Gross sales by Singapore weekday (0 = Monday) and hour (0-23), successful payments only.
 * @param {string} merchantId
 * @param {string} from YYYY-MM-DD (Singapore), inclusive
 * @param {string} to YYYY-MM-DD (Singapore), inclusive
 * @param {string | null} [outletId] only this outlet
 * @returns {Promise<{dow: number, hour: number, grossCents: number}[]>}
 */
export async function getHeatmap(merchantId, from, to, outletId = null) {
  const [start, end] = utcBounds(from, to)
  const rows = await query(
    `SELECT WEEKDAY(CONVERT_TZ(created_at, '+00:00', '+08:00')) AS dow,
            HOUR(CONVERT_TZ(created_at, '+00:00', '+08:00')) AS hour,
            SUM(amount_cents) AS grossCents
       FROM transactions
      WHERE merchant_id = ? AND status = 'success' AND created_at >= ? AND created_at < ?${outletClause(outletId)}
      GROUP BY dow, hour
      ORDER BY dow, hour`,
    [merchantId, start, end, ...outletParams(outletId)],
  )
  return rows.map((r) => ({
    dow: Number(r.dow),
    hour: Number(r.hour),
    grossCents: Number(r.grossCents),
  }))
}

/**
 * Gross sales and NETS fees for successful payments in SGT dates `from`..`to` inclusive.
 * @param {string} merchantId
 * @param {string} from YYYY-MM-DD (Singapore), inclusive
 * @param {string} to YYYY-MM-DD (Singapore), inclusive
 * @param {string | null} [outletId] only this outlet
 * @returns {Promise<{grossCents: number, feeCents: number}>}
 */
export async function getFeeTotals(merchantId, from, to, outletId = null) {
  const [start, end] = utcBounds(from, to)
  const rows = await query(
    `SELECT COALESCE(SUM(amount_cents), 0) AS grossCents, COALESCE(SUM(fee_cents), 0) AS feeCents
       FROM transactions
      WHERE merchant_id = ? AND status = 'success' AND created_at >= ? AND created_at < ?${outletClause(outletId)}`,
    [merchantId, start, end, ...outletParams(outletId)],
  )
  return { grossCents: Number(rows[0]?.grossCents ?? 0), feeCents: Number(rows[0]?.feeCents ?? 0) }
}

/**
 * Gross sales (successful payments) per outlet in SGT dates `from`..`to` inclusive, for comparing outlets.
 * Every outlet of the merchant is listed, with 0 when it sold nothing.
 * @param {string} merchantId
 * @param {string} from YYYY-MM-DD (Singapore), inclusive
 * @param {string} to YYYY-MM-DD (Singapore), inclusive
 * @returns {Promise<{id: string, name: string, grossCents: number}[]>}
 */
export async function getOutletSales(merchantId, from, to) {
  const [start, end] = utcBounds(from, to)
  const rows = await query(
    `SELECT o.outlet_id AS id, o.name, COALESCE(SUM(t.amount_cents), 0) AS grossCents
       FROM outlets o
       LEFT JOIN transactions t
         ON t.outlet_id = o.outlet_id AND t.merchant_id = o.merchant_id
        AND t.status = 'success' AND t.created_at >= ? AND t.created_at < ?
      WHERE o.merchant_id = ?
      GROUP BY o.outlet_id, o.name
      ORDER BY o.name, o.outlet_id`,
    [start, end, merchantId],
  )
  return rows.map((r) => ({ id: r.id, name: r.name, grossCents: Number(r.grossCents) }))
}
