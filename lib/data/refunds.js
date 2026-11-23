import { query } from '../db.js'
import { utcBounds } from './sales.js'

/**
 * @typedef {{id: string, businessDate: string, status: string, expectedDate: string, paidDate: string | null}} RefundPayout
 * @typedef {{
 *   id: string, transactionId: string, amountCents: number, reason: string,
 *   refundedAt: string, paidAt: string, channel: string, payout: RefundPayout | null,
 * }} RefundRow
 *   refundedAt and paidAt (the original payment) are ISO UTC timestamps; payout dates are 'YYYY-MM-DD'.
 *   payout is the NETS payout the refund was taken from, or null when none is linked yet.
 */

/**
 * This merchant's refunds, newest first, with the payout each was taken from. `from`/`to` are
 * Singapore dates (inclusive) on the refund date; without them all refunds are returned.
 * `outletId` limits the list to refunds of payments made at that outlet (outlet managers).
 * @param {string} merchantId
 * @param {{from?: string, to?: string, outletId?: string | null}} [opts]
 * @returns {Promise<RefundRow[]>}
 */
export async function listRefunds(merchantId, { from, to, outletId = null } = {}) {
  const where = ['r.merchant_id = ?']
  /** @type {any[]} */
  const params = [merchantId]
  if (from && to) {
    const [start, end] = utcBounds(from, to)
    where.push('r.refunded_at >= ? AND r.refunded_at < ?')
    params.push(start, end)
  }
  if (outletId) {
    where.push('t.outlet_id = ?')
    params.push(outletId)
  }
  const rows = await query(
    `SELECT r.refund_id AS id, r.transaction_id AS transactionId, r.amount_cents AS amountCents, r.reason,
            r.refunded_at AS refundedAt, t.created_at AS paidAt, t.channel,
            s.settlement_id AS payoutId, s.business_date AS businessDate, s.status AS payoutStatus,
            s.expected_date AS expectedDate, s.paid_date AS paidDate
       FROM refunds r
       JOIN transactions t ON t.transaction_id = r.transaction_id AND t.merchant_id = r.merchant_id
       LEFT JOIN settlements s ON s.settlement_id = r.settlement_id AND s.merchant_id = r.merchant_id
      WHERE ${where.join(' AND ')}
      ORDER BY r.refunded_at DESC, r.refund_id DESC`,
    params,
  )
  return rows.map((r) => ({
    id: r.id,
    transactionId: r.transactionId,
    amountCents: Number(r.amountCents),
    reason: r.reason,
    refundedAt: new Date(r.refundedAt).toISOString(),
    paidAt: new Date(r.paidAt).toISOString(),
    channel: r.channel,
    payout: r.payoutId
      ? {
          id: r.payoutId,
          businessDate: String(r.businessDate),
          status: r.payoutStatus,
          expectedDate: String(r.expectedDate),
          paidDate: r.paidDate ? String(r.paidDate) : null,
        }
      : null,
  }))
}
