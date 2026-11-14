import { query } from '../db.js'

/**
 * The latest check-up (reconciliation run) and how many problems are still open.
 * Null when no check-up has run yet.
 * @param {string} merchantId
 * @returns {Promise<{runAt: string, period: string, matchedCount: number, exceptionCount: number, openCount: number} | null>}
 */
export async function getLatestRunSummary(merchantId) {
  const runs = await query(
    `SELECT run_at AS runAt, period, matched_count AS matchedCount, exception_count AS exceptionCount
       FROM recon_runs
      WHERE merchant_id = ?
      ORDER BY run_at DESC
      LIMIT 1`,
    [merchantId],
  )
  const run = runs[0]
  if (!run) return null
  const open = await query(
    `SELECT COUNT(*) AS openCount FROM recon_exceptions WHERE merchant_id = ? AND status = 'open'`,
    [merchantId],
  )
  return {
    runAt: new Date(run.runAt).toISOString(),
    period: String(run.period),
    matchedCount: Number(run.matchedCount),
    exceptionCount: Number(run.exceptionCount),
    openCount: Number(open[0]?.openCount ?? 0),
  }
}
