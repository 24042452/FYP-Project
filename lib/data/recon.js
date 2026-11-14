import { randomUUID } from 'node:crypto'
import { query, withTransaction } from '../db.js'
import { monthEnd } from '../dates.js'
import { utcBounds } from './sales.js'
import { isUuid } from '../transactions/params.js'

/**
 * @typedef {import('../channels.js').Channel} Channel
 * @typedef {import('../recon/reconcile.js').ReconException} ReconException
 * @typedef {{
 *   id: string, type: import('../recon/reconcile.js').ReconExceptionType, settlementId: string | null, transactionId: string | null,
 *   day: string | null, channel: Channel | null, expectedCents: number | null, actualCents: number | null,
 *   status: 'open' | 'resolved', note: string | null, message: string,
 * }} StoredException
 * @typedef {{id: string, period: string, runAt: string, checkedCount: number, matchedCount: number, exceptionCount: number}} ReconRun
 */

/**
 * The latest check-up (reconciliation run) and how many of ITS problems are still open.
 * Null when no check-up has run yet.
 * @param {string} merchantId
 * @returns {Promise<{runAt: string, period: string, matchedCount: number, exceptionCount: number, openCount: number} | null>}
 */
export async function getLatestRunSummary(merchantId) {
  const runs = await query(
    `SELECT id, run_at AS runAt, period, matched_count AS matchedCount, exception_count AS exceptionCount
       FROM recon_runs
      WHERE merchant_id = ?
      ORDER BY run_at DESC
      LIMIT 1`,
    [merchantId],
  )
  const run = runs[0]
  if (!run) return null
  const open = await query(
    `SELECT COUNT(*) AS openCount FROM recon_exceptions WHERE merchant_id = ? AND run_id = ? AND status = 'open' AND type <> 'failed_payment'`,
    [merchantId, run.id],
  )
  return {
    runAt: new Date(run.runAt).toISOString(),
    period: String(run.period),
    matchedCount: Number(run.matchedCount),
    exceptionCount: Number(run.exceptionCount),
    openCount: Number(open[0]?.openCount ?? 0),
  }
}

/**
 * One day+channel of a month's payments, for the check-up: successful gross and fees, and the failed payments.
 * @param {string} merchantId
 * @param {string} month YYYY-MM
 * @returns {Promise<{day: string, channel: Channel, grossCents: number, feeCents: number, failed: {id: string, code: string, amountCents: number}[]}[]>}
 */
export async function getReconTransactions(merchantId, month) {
  const [start, end] = utcBounds(`${month}-01`, monthEnd(`${month}-01`))
  const sgtDay = `DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+08:00'), '%Y-%m-%d')`
  const sums = await query(
    `SELECT ${sgtDay} AS day, channel,
            COALESCE(SUM(CASE WHEN status = 'success' THEN amount_cents ELSE 0 END), 0) AS grossCents,
            COALESCE(SUM(CASE WHEN status = 'success' THEN fee_cents ELSE 0 END), 0) AS feeCents
       FROM transactions
      WHERE merchant_id = ? AND created_at >= ? AND created_at < ?
      GROUP BY day, channel
      ORDER BY day, channel`,
    [merchantId, start, end],
  )
  const fails = await query(
    `SELECT id, ${sgtDay} AS day, channel, failure_code AS code, amount_cents AS amountCents
       FROM transactions
      WHERE merchant_id = ? AND created_at >= ? AND created_at < ? AND status = 'failed'
      ORDER BY created_at DESC, id`,
    [merchantId, start, end],
  )
  /** @type {Map<string, any>} */
  const byKey = new Map()
  for (const r of sums) {
    byKey.set(`${r.day}|${r.channel}`, {
      day: r.day, channel: r.channel, grossCents: Number(r.grossCents), feeCents: Number(r.feeCents), failed: [],
    })
  }
  for (const f of fails) {
    const k = `${f.day}|${f.channel}`
    const row = byKey.get(k) ?? { day: f.day, channel: f.channel, grossCents: 0, feeCents: 0, failed: [] }
    byKey.set(k, row)
    row.failed.push({ id: String(f.id), code: f.code ?? '', amountCents: Number(f.amountCents) })
  }
  return [...byKey.values()].sort((a, b) => a.day.localeCompare(b.day) || a.channel.localeCompare(b.channel))
}

/**
 * Save a check-up: the run and all its problems, in one transaction (all or nothing).
 * @param {string} merchantId
 * @param {string} month YYYY-MM
 * @param {{checked: number, matched: number, exceptions: ReconException[]}} result
 * @returns {Promise<string>} the new run id
 */
export async function saveReconRun(merchantId, month, result) {
  const runId = randomUUID()
  const runAt = new Date().toISOString().replace('T', ' ').replace('Z', '')
  await withTransaction(async (exec) => {
    await exec(
      `INSERT INTO recon_runs (id, merchant_id, period, run_at, checked_count, matched_count, exception_count) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [runId, merchantId, `${month}-01`, runAt, result.checked, result.matched, result.exceptions.length],
    )
    for (const e of result.exceptions) {
      await exec(
        `INSERT INTO recon_exceptions
           (id, merchant_id, run_id, type, settlement_id, transaction_id, day, channel, message, expected_cents, actual_cents, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')`,
        [
          randomUUID(), merchantId, runId, e.type, e.settlementId ?? null, e.transactionId ?? null,
          e.day ?? null, e.channel ?? null, e.message.slice(0, 300), e.expectedCents ?? null, e.actualCents ?? null,
        ],
      )
    }
  })
  return runId
}

/** @param {any} r @returns {ReconRun} */
const toRun = (r) => ({
  id: String(r.id),
  period: String(r.period),
  runAt: new Date(r.runAt).toISOString(),
  checkedCount: Number(r.checkedCount),
  matchedCount: Number(r.matchedCount),
  exceptionCount: Number(r.exceptionCount),
})

/**
 * A check-up and its problems; null if it is not this merchant's (or the id is malformed).
 * @param {string} merchantId
 * @param {string} runId
 * @returns {Promise<(ReconRun & {exceptions: StoredException[]}) | null>}
 */
export async function getReconRun(merchantId, runId) {
  if (typeof runId !== 'string' || !isUuid(runId)) return null
  const runs = await query(
    `SELECT id, period, run_at AS runAt, checked_count AS checkedCount, matched_count AS matchedCount, exception_count AS exceptionCount
       FROM recon_runs WHERE merchant_id = ? AND id = ? LIMIT 1`,
    [merchantId, runId],
  )
  if (!runs[0]) return null
  const rows = await query(
    `SELECT id, type, settlement_id AS settlementId, transaction_id AS transactionId, day, channel,
            expected_cents AS expectedCents, actual_cents AS actualCents, status, note, message
       FROM recon_exceptions
      WHERE merchant_id = ? AND run_id = ?
      ORDER BY FIELD(type, 'amount_mismatch', 'missing_settlement', 'settlement_delay', 'fee_mismatch', 'failed_payment'),
               day DESC, id`,
    [merchantId, runId],
  )
  return {
    ...toRun(runs[0]),
    exceptions: rows.map((r) => ({
      id: String(r.id),
      type: r.type,
      settlementId: r.settlementId ?? null,
      transactionId: r.transactionId ?? null,
      day: r.day == null ? null : String(r.day),
      channel: r.channel ?? null,
      expectedCents: r.expectedCents == null ? null : Number(r.expectedCents),
      actualCents: r.actualCents == null ? null : Number(r.actualCents),
      status: r.status,
      note: r.note ?? null,
      message: r.message ?? '',
    })),
  }
}

/**
 * The most recent check-up for a month (YYYY-MM), with its problems; null if none has run.
 * @param {string} merchantId
 * @param {string} month
 * @returns {Promise<(ReconRun & {exceptions: StoredException[]}) | null>}
 */
export async function getLatestRunForMonth(merchantId, month) {
  const runs = await query(
    `SELECT id FROM recon_runs WHERE merchant_id = ? AND period = ? ORDER BY run_at DESC LIMIT 1`,
    [merchantId, `${month}-01`],
  )
  return runs[0] ? getReconRun(merchantId, String(runs[0].id)) : null
}

/**
 * The latest check-up id for every month that has one, for the Reports page.
 * @param {string} merchantId
 * @returns {Promise<{period: string, id: string}[]>}
 */
export async function listLatestRunIds(merchantId) {
  const rows = await query(
    `SELECT period, id
       FROM recon_runs
      WHERE merchant_id = ?
      ORDER BY period DESC, run_at DESC, id`,
    [merchantId],
  )
  /** @type {Map<string, string>} */
  const out = new Map()
  for (const r of rows) if (!out.has(String(r.period))) out.set(String(r.period), String(r.id))
  return [...out].map(([period, id]) => ({ period, id }))
}

/**
 * "Mark as sorted": resolve one problem with an optional note. Only touches this merchant's rows.
 * @param {string} merchantId
 * @param {string} exceptionId
 * @param {string | null} note already trimmed, at most 500 characters
 * @returns {Promise<boolean>} true if a row was updated
 */
export async function markExceptionSorted(merchantId, exceptionId, note) {
  if (typeof exceptionId !== 'string' || !isUuid(exceptionId)) return false
  const res = /** @type {any} */ (
    await query(`UPDATE recon_exceptions SET status = 'resolved', note = ? WHERE merchant_id = ? AND id = ?`, [note, merchantId, exceptionId])
  )
  return Number(res.affectedRows) > 0
}
