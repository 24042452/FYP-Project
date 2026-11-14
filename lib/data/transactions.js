import { query } from '../db.js'
import { utcBounds } from './sales.js'
import { decodeCursor, encodeCursor, isUuid, parseAmountCents } from '../transactions/params.js'

/** @typedef {import('../transactions/format.js').Txn} Txn */

const SELECT = `SELECT t.id, t.created_at AS createdAt, t.amount_cents AS amountCents, t.fee_cents AS feeCents,
            t.channel, t.status, t.failure_code AS failureCode, t.customer_ref AS customerRef,
            o.name AS outletName, tm.serial_no AS terminalSerial, s.business_date AS settlementDate
       FROM transactions t
       LEFT JOIN outlets o ON o.id = t.outlet_id AND o.merchant_id = t.merchant_id
       LEFT JOIN terminals tm ON tm.id = t.terminal_id AND tm.merchant_id = t.merchant_id
       LEFT JOIN settlements s ON s.id = t.settlement_id AND s.merchant_id = t.merchant_id`

/** @param {any} r @returns {Txn} */
function toTxn(r) {
  return {
    id: r.id,
    createdAt: new Date(r.createdAt).toISOString(),
    amountCents: Number(r.amountCents),
    feeCents: Number(r.feeCents),
    channel: r.channel,
    status: r.status,
    failureCode: r.failureCode ?? null,
    customerRef: r.customerRef ?? null,
    outletName: r.outletName ?? null,
    terminalSerial: r.terminalSerial ?? null,
    settlementDate: r.settlementDate ? String(r.settlementDate) : null,
  }
}

/** Escape LIKE wildcards so user text is matched literally. @param {string} s */
export const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * Payments, newest first, 50 per page by default. Keyset pagination on (created_at, id): pass the
 * returned `nextCursor` back as `cursor` for the next page.
 *
 * Search `q` matches a dollar amount exactly when it reads as one ("12.50", "$12.50"), and also
 * any payment whose id or customer reference STARTS with the text (wildcards are escaped).
 * An unreadable cursor is ignored (first page). `from`/`to` are Singapore dates, `to` inclusive;
 * without them all dates are returned.
 * @param {string} merchantId
 * @param {{from?: string, to?: string, channel?: string, status?: string, q?: string, cursor?: string, limit?: number}} [f]
 * @returns {Promise<{rows: Txn[], nextCursor: string | null}>}
 */
export async function listTransactions(merchantId, f = {}) {
  const where = ['t.merchant_id = ?']
  /** @type {any[]} */
  const params = [merchantId]

  if (f.from && f.to) {
    const [start, end] = utcBounds(f.from, f.to)
    where.push('t.created_at >= ? AND t.created_at < ?')
    params.push(start, end)
  }
  if (f.channel) {
    where.push('t.channel = ?')
    params.push(f.channel)
  }
  if (f.status) {
    where.push('t.status = ?')
    params.push(f.status)
  }
  const q = f.q?.trim()
  if (q) {
    const cents = parseAmountCents(q)
    const like = `${likeEscape(q)}%`
    if (cents !== null) {
      where.push('(t.amount_cents = ? OR t.id LIKE ? OR t.customer_ref LIKE ?)')
      params.push(cents, like, like)
    } else {
      where.push('(t.id LIKE ? OR t.customer_ref LIKE ?)')
      params.push(like, like)
    }
  }
  const cur = decodeCursor(f.cursor)
  if (cur) {
    where.push('(t.created_at < ? OR (t.created_at = ? AND t.id < ?))')
    params.push(cur.createdAt, cur.createdAt, cur.id)
  }

  // LIMIT is clamped to an integer (no placeholder in a prepared LIMIT here).
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(f.limit)) || 50))
  const rows = await query(
    `${SELECT}
      WHERE ${where.join(' AND ')}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${limit + 1}`,
    params,
  )
  const page = rows.slice(0, limit).map(toTxn)
  const last = page[page.length - 1]
  return {
    rows: page,
    nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
  }
}

/**
 * One payment with its outlet, terminal and payout date; null if it is not this merchant's
 * (or the id is not a valid id).
 * @param {string} merchantId
 * @param {string} id
 * @returns {Promise<Txn | null>}
 */
export async function getTransaction(merchantId, id) {
  if (typeof id !== 'string' || !isUuid(id)) return null
  const rows = await query(`${SELECT} WHERE t.merchant_id = ? AND t.id = ? LIMIT 1`, [merchantId, id])
  return rows[0] ? toTxn(rows[0]) : null
}

/** The most payments one Excel export will hold. */
export const EXPORT_ROW_LIMIT = 50000

/**
 * Every payment with a Singapore date from..to (inclusive), oldest first, for the Excel export.
 * Capped at EXPORT_ROW_LIMIT rows.
 * @param {string} merchantId
 * @param {string} from YYYY-MM-DD
 * @param {string} to YYYY-MM-DD
 * @returns {Promise<Txn[]>}
 */
export async function listTransactionsForExport(merchantId, from, to) {
  const [start, end] = utcBounds(from, to)
  const rows = await query(
    `${SELECT}
      WHERE t.merchant_id = ? AND t.created_at >= ? AND t.created_at < ?
      ORDER BY t.created_at ASC, t.id ASC
      LIMIT ${EXPORT_ROW_LIMIT}`,
    [merchantId, start, end],
  )
  return rows.map(toTxn)
}
