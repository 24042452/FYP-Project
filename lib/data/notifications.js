import { randomUUID } from 'node:crypto'
import { query } from '../db.js'
import { isUuid } from '../transactions/params.js'

/**
 * @typedef {{id: string, kind: string, title: string, body: string, link: string | null, createdAt: string, read: boolean}} Notification
 */

/**
 * The merchant's latest notifications, newest first. createdAt is an ISO UTC string.
 * @param {string} merchantId
 * @param {{limit?: number}} [opts]
 * @returns {Promise<Notification[]>}
 */
export async function listNotifications(merchantId, { limit = 10 } = {}) {
  // LIMIT is clamped to an integer and inlined (a placeholder is not allowed there in a prepared statement).
  const n = Math.min(50, Math.max(1, Math.trunc(Number(limit)) || 10))
  const rows = await query(
    `SELECT id, kind, title, body, link, created_at AS createdAt, read_at AS readAt
       FROM notifications
      WHERE merchant_id = ?
      ORDER BY created_at DESC, id ASC
      LIMIT ${n}`,
    [merchantId],
  )
  return rows.map((r) => ({
    id: String(r.id),
    kind: String(r.kind),
    title: String(r.title),
    body: r.body ?? '',
    link: r.link ?? null,
    createdAt: new Date(r.createdAt).toISOString(),
    read: r.readAt != null,
  }))
}

/**
 * @param {string} merchantId
 * @returns {Promise<number>}
 */
export async function countUnread(merchantId) {
  const rows = await query(
    'SELECT COUNT(*) AS n FROM notifications WHERE merchant_id = ? AND read_at IS NULL',
    [merchantId],
  )
  return Number(rows[0]?.n ?? 0)
}

/**
 * Mark one notification read. Does nothing for another merchant's or a malformed id.
 * @param {string} merchantId
 * @param {string} id
 * @returns {Promise<boolean>} true if a row changed
 */
export async function markRead(merchantId, id) {
  if (typeof id !== 'string' || !isUuid(id)) return false
  const res = /** @type {any} */ (
    await query(
      'UPDATE notifications SET read_at = CURRENT_TIMESTAMP(3) WHERE merchant_id = ? AND id = ? AND read_at IS NULL',
      [merchantId, id],
    )
  )
  return res.affectedRows > 0
}

/**
 * @param {string} merchantId
 * @returns {Promise<number>} how many were marked
 */
export async function markAllRead(merchantId) {
  const res = /** @type {any} */ (
    await query(
      'UPDATE notifications SET read_at = CURRENT_TIMESTAMP(3) WHERE merchant_id = ? AND read_at IS NULL',
      [merchantId],
    )
  )
  return res.affectedRows
}

/** @param {string} link true for a same-site path like "/settlements" (not "//host" or "https://"). */
export const isInternalLink = (link) => typeof link === 'string' && link.startsWith('/') && !link.startsWith('//')

/**
 * Add notifications for a merchant (always unread).
 * @param {string} merchantId
 * @param {{kind: string, title: string, body?: string, link?: string | null}[]} items
 * @returns {Promise<number>}
 */
export async function insertNotifications(merchantId, items) {
  for (const it of items) {
    if (it.link != null && !isInternalLink(it.link)) throw new Error('Notification links must stay inside the portal')
  }
  for (const it of items) {
    await query(
      'INSERT INTO notifications (id, merchant_id, kind, title, body, link) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), merchantId, it.kind, it.title, it.body ?? null, it.link ?? null],
    )
  }
  return items.length
}

