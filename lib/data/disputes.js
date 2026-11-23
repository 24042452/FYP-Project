import { randomUUID } from 'node:crypto'
import { query, withTransaction } from '../db.js'
import { isUuid } from '../transactions/params.js'

// Disputes (chargebacks) a customer's bank raised on this merchant's payments, their evidence files,
// and the merchant's answer. Every query is filtered by the caller's merchant id; an outlet manager's
// calls also pass `outletId`, which filters on the disputed payment's outlet (transactions.outlet_id).

/** SGT calendar date of a UTC DATETIME column, as 'YYYY-MM-DD' (NULL stays NULL). @param {string} col */
const sgtDay = (col) => `DATE_FORMAT(CONVERT_TZ(${col}, '+00:00', '+08:00'), '%Y-%m-%d')`

/**
 * @typedef {{id: string, name: string, sizeBytes: number}} DisputeFileRow
 * @typedef {{
 *   id: string, transactionId: string, amountCents: number, reason: string, status: string,
 *   openedAt: string, respondBy: string, answeredAt: string | null, declineReason: string | null,
 *   evidence: string[], note: string | null, decideBy: string | null, decidedAt: string | null,
 *   channel: string, paidAt: string, tid: string | null, stan: string | null, outletId: string | null,
 *   sameAmountCount: number, fileCount: number, files: DisputeFileRow[],
 * }} DisputeRow
 *   openedAt, answeredAt, decidedAt, respondBy and decideBy are Singapore calendar dates 'YYYY-MM-DD'
 *   (the shape lib/disputes/rules.js expects). paidAt is the payment's ISO UTC timestamp.
 *   status is the stored status; "missed" (open past respondBy) is worked out by rules.effectiveStatus.
 */

/** @param {unknown} v @returns {string[]} */
function parseEvidence(v) {
  if (v == null) return []
  const arr = typeof v === 'string' ? JSON.parse(v) : v
  return Array.isArray(arr) ? arr.map(String) : []
}

/**
 * This merchant's disputes, newest opened first, each with its payment details, evidence files
 * (names and sizes, not the bytes) and `sameAmountCount`: how many of this merchant's successful or
 * refunded payments have the same amount, payment type, terminal and Singapore day as the disputed
 * payment, counting the disputed payment itself (1 = only that one payment).
 * @param {string} merchantId
 * @param {{outletId?: string | null}} [opts]
 * @returns {Promise<DisputeRow[]>}
 */
export async function listDisputes(merchantId, { outletId = null } = {}) {
  const rows = await query(
    `SELECT d.dispute_id AS id, d.transaction_id AS transactionId, d.amount_cents AS amountCents, d.reason, d.status,
            ${sgtDay('d.opened_at')} AS openedAt, d.respond_by AS respondBy, ${sgtDay('d.answered_at')} AS answeredAt,
            d.decline_reason AS declineReason, d.evidence, d.note, d.decide_by AS decideBy, ${sgtDay('d.decided_at')} AS decidedAt,
            t.channel, t.created_at AS paidAt, tm.tid, t.stan, t.outlet_id AS outletId,
            (SELECT COUNT(*) FROM transactions s
              WHERE s.merchant_id = t.merchant_id AND s.status IN ('success', 'refunded')
                AND s.amount_cents = t.amount_cents AND s.channel = t.channel AND s.terminal_id <=> t.terminal_id
                AND s.created_at >= CONVERT_TZ(DATE(CONVERT_TZ(t.created_at, '+00:00', '+08:00')), '+08:00', '+00:00')
                AND s.created_at < CONVERT_TZ(DATE(CONVERT_TZ(t.created_at, '+00:00', '+08:00')) + INTERVAL 1 DAY, '+08:00', '+00:00')
            ) AS sameAmountCount
       FROM disputes d
       JOIN transactions t ON t.transaction_id = d.transaction_id AND t.merchant_id = d.merchant_id
       LEFT JOIN terminals tm ON tm.terminal_id = t.terminal_id AND tm.merchant_id = t.merchant_id
      WHERE d.merchant_id = ?${outletId ? ' AND t.outlet_id = ?' : ''}
      ORDER BY d.opened_at DESC, d.dispute_id DESC`,
    outletId ? [merchantId, outletId] : [merchantId],
  )
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const files = await query(
    `SELECT dispute_file_id AS id, dispute_id AS disputeId, file_name AS name, size_bytes AS sizeBytes
       FROM dispute_files
      WHERE merchant_id = ? AND dispute_id IN (${ids.map(() => '?').join(', ')})
      ORDER BY uploaded_at, dispute_file_id`,
    [merchantId, ...ids],
  )
  /** @type {Map<string, DisputeFileRow[]>} */
  const byDispute = new Map()
  for (const f of files) {
    const list = byDispute.get(f.disputeId) ?? []
    list.push({ id: f.id, name: f.name, sizeBytes: Number(f.sizeBytes) })
    byDispute.set(f.disputeId, list)
  }

  return rows.map((r) => {
    const fileList = byDispute.get(r.id) ?? []
    return {
      id: r.id,
      transactionId: r.transactionId,
      amountCents: Number(r.amountCents),
      reason: r.reason,
      status: r.status,
      openedAt: r.openedAt,
      respondBy: String(r.respondBy),
      answeredAt: r.answeredAt ?? null,
      declineReason: r.declineReason ?? null,
      evidence: parseEvidence(r.evidence),
      note: r.note ?? null,
      decideBy: r.decideBy ? String(r.decideBy) : null,
      decidedAt: r.decidedAt ?? null,
      channel: r.channel,
      paidAt: new Date(r.paidAt).toISOString(),
      tid: r.tid ?? null,
      stan: r.stan ?? null,
      outletId: r.outletId ?? null,
      sameAmountCount: Number(r.sameAmountCount),
      fileCount: fileList.length,
      files: fileList,
    }
  })
}

/**
 * Accept or decline an open dispute, in one database transaction. The UPDATE itself checks the
 * merchant, the dispute id, `status = 'open'`, `respond_by >= today` and (for an outlet manager) the
 * payment's outlet, so a double submit or a forged id cannot answer twice or answer someone else's
 * dispute. Evidence files are stored only after the update succeeded, and only for a decline.
 *
 * Accept: status 'accepted'; decline_reason, evidence, note and decide_by are cleared.
 * Decline: status 'declined', with decline_reason, evidence (JSON array), note and
 * decide_by = today + 30 days (when NETS is expected to decide).
 *
 * Input checks (allowed reasons, note length, file type, size and count) are the caller's job
 * (lib/disputes/rules.js and the server action); this function trusts its inputs.
 * @param {string} merchantId
 * @param {string} disputeId
 * @param {{
 *   action: 'accept' | 'decline', userId: string, outletId?: string | null, today: string,
 *   declineReason?: string, evidence?: string[], note?: string | null,
 *   files?: {name: string, mime: string, bytes: Buffer}[],
 * }} answer `today` is the Singapore date 'YYYY-MM-DD'
 * @returns {Promise<{ok: true} | {ok: false, reason: 'not_found' | 'already_answered' | 'too_late'}>}
 */
export async function answerDispute(merchantId, disputeId, answer) {
  const { action, userId, outletId = null, today } = answer
  if (typeof disputeId !== 'string' || !isUuid(disputeId)) return { ok: false, reason: 'not_found' }
  if (action !== 'accept' && action !== 'decline') throw new Error(`Unknown dispute action: ${action}`)
  const decline = action === 'decline'

  return withTransaction(async (exec) => {
    const res = await exec(
      `UPDATE disputes d
         JOIN transactions t ON t.transaction_id = d.transaction_id AND t.merchant_id = d.merchant_id
          SET d.status = ?, d.answered_at = NOW(3), d.answered_by = ?,
              d.decline_reason = ?, d.evidence = ?, d.note = ?,
              d.decide_by = ${decline ? 'DATE_ADD(?, INTERVAL 30 DAY)' : 'NULL'}
        WHERE d.merchant_id = ? AND d.dispute_id = ? AND d.status = 'open' AND d.respond_by >= ?${outletId ? ' AND t.outlet_id = ?' : ''}`,
      [
        decline ? 'declined' : 'accepted',
        userId,
        decline ? (answer.declineReason ?? null) : null,
        decline ? JSON.stringify(answer.evidence ?? []) : null,
        decline ? (answer.note || null) : null,
        ...(decline ? [today] : []),
        merchantId,
        disputeId,
        today,
        ...(outletId ? [outletId] : []),
      ],
    )

    if (res.affectedRows !== 1) {
      const rows = await exec(
        `SELECT d.status FROM disputes d
           JOIN transactions t ON t.transaction_id = d.transaction_id AND t.merchant_id = d.merchant_id
          WHERE d.merchant_id = ? AND d.dispute_id = ?${outletId ? ' AND t.outlet_id = ?' : ''}`,
        outletId ? [merchantId, disputeId, outletId] : [merchantId, disputeId],
      )
      if (rows.length === 0) return { ok: false, reason: 'not_found' }
      return { ok: false, reason: rows[0].status === 'open' ? 'too_late' : 'already_answered' }
    }

    if (decline) {
      for (const f of answer.files ?? []) {
        await exec(
          `INSERT INTO dispute_files (dispute_file_id, dispute_id, merchant_id, file_name, mime_type, size_bytes, data)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [randomUUID(), disputeId, merchantId, f.name, f.mime, f.bytes.length, f.bytes],
        )
      }
    }
    return { ok: true }
  })
}

/**
 * One evidence file with its bytes, for its own merchant only (and, for an outlet manager, only when
 * the disputed payment is at their outlet). null when not found or the id is not a valid id.
 * @param {string} merchantId
 * @param {string} fileId
 * @param {{outletId?: string | null}} [opts]
 * @returns {Promise<{name: string, mime: string, data: Buffer} | null>}
 */
export async function getDisputeFile(merchantId, fileId, { outletId = null } = {}) {
  if (typeof fileId !== 'string' || !isUuid(fileId)) return null
  const rows = await query(
    `SELECT f.file_name AS name, f.mime_type AS mime, f.data
       FROM dispute_files f
       JOIN disputes d ON d.dispute_id = f.dispute_id AND d.merchant_id = f.merchant_id
       JOIN transactions t ON t.transaction_id = d.transaction_id AND t.merchant_id = d.merchant_id
      WHERE f.merchant_id = ? AND f.dispute_file_id = ?${outletId ? ' AND t.outlet_id = ?' : ''}
      LIMIT 1`,
    outletId ? [merchantId, fileId, outletId] : [merchantId, fileId],
  )
  const r = rows[0]
  return r ? { name: r.name, mime: r.mime, data: Buffer.from(r.data) } : null
}
