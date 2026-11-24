import { randomUUID } from 'node:crypto'
import { query, withTransaction } from '../db.js'
import { addDays, eachDay } from '../dates.js'
import { isUuid } from '../transactions/params.js'
import { datesFor, runStatus } from '../promotions/rules.js'

// Promotion runs (4-week marketing campaigns per payment type and outlet) and the sales used for their
// results. Every query is filtered by the caller's merchant id; outlet managers pass `outletId`.
// Dates (starts_on, ends_on, stopped_on) are Singapore calendar dates 'YYYY-MM-DD'.

/**
 * @typedef {import('../channels.js').Channel} Channel
 * @typedef {{ id: string, key: string, channel: Channel, startsOn: string, endsOn: string, stoppedOn: string | null,
 *   outletIds: string[], outletNames: string[] }} Run
 */

/** `?, ?, ?` for an IN list. @param {unknown[]} list */
export const marks = (list) => list.map(() => '?').join(', ')

/**
 * The outlet ids a caller sent, de-duplicated, or null when the list is empty or holds a non-id.
 * @param {unknown} outletIds
 * @returns {string[] | null}
 */
export function cleanOutletIds(outletIds) {
  if (!Array.isArray(outletIds)) return null
  const ids = [...new Set(outletIds)]
  if (ids.length === 0 || !ids.every((id) => typeof id === 'string' && isUuid(id))) return null
  return ids
}

/**
 * Inside a transaction: lock the merchant's row and check every outlet id is one of its outlets.
 * The lock makes take-ups of one merchant run one after another: a second request waits here until the
 * first commits, then sees its rows. This holds at any isolation level (a gap lock alone would not under
 * READ COMMITTED, and under REPEATABLE READ two empty-range locks would deadlock instead of waiting).
 * @param {(sql: string, params?: any[]) => Promise<any>} exec
 * @param {string} merchantId
 * @param {string[]} ids
 * @returns {Promise<boolean>} false when the merchant or any outlet is not found
 */
export async function lockMerchantOutlets(exec, merchantId, ids) {
  const merchant = await exec('SELECT merchant_id FROM merchants WHERE merchant_id = ? FOR UPDATE', [merchantId])
  if (merchant.length === 0) return false
  const found = await exec(`SELECT outlet_id FROM outlets WHERE merchant_id = ? AND outlet_id IN (${marks(ids)})`, [merchantId, ...ids])
  return found.length === ids.length
}

/**
 * This merchant's promotion runs, newest first, each with its outlets (ids and names, by name).
 * With `outletId` (an outlet manager), only runs that include that outlet; their outlet lists stay whole,
 * so the page can tell a run shared with other outlets (which an outlet manager cannot stop).
 * @param {string} merchantId
 * @param {{outletId?: string | null}} [opts]
 * @returns {Promise<Run[]>}
 */
export async function listPromotionRuns(merchantId, { outletId = null } = {}) {
  const rows = await query(
    `SELECT r.promotion_run_id AS id, r.promotion_key AS \`key\`, r.channel, r.starts_on AS startsOn, r.ends_on AS endsOn, r.stopped_on AS stoppedOn
       FROM promotion_runs r
      WHERE r.merchant_id = ?${outletId ? ` AND EXISTS (SELECT 1 FROM promotion_run_outlets x
              WHERE x.promotion_run_id = r.promotion_run_id AND x.merchant_id = r.merchant_id AND x.outlet_id = ?)` : ''}
      ORDER BY r.starts_on DESC, r.created_at DESC, r.promotion_run_id`,
    outletId ? [merchantId, outletId] : [merchantId],
  )
  if (rows.length === 0) return []
  const outlets = await query(
    `SELECT ro.promotion_run_id AS runId, o.outlet_id AS id, o.name
       FROM promotion_run_outlets ro
       JOIN outlets o ON o.outlet_id = ro.outlet_id AND o.merchant_id = ro.merchant_id
      WHERE ro.merchant_id = ? AND ro.promotion_run_id IN (${marks(rows)})
      ORDER BY o.name, o.outlet_id`,
    [merchantId, ...rows.map((r) => r.id)],
  )
  return rows.map((r) => {
    const mine = outlets.filter((o) => o.runId === r.id)
    return {
      id: r.id,
      key: r.key,
      channel: r.channel,
      startsOn: r.startsOn,
      endsOn: r.endsOn,
      stoppedOn: r.stoppedOn ?? null,
      outletIds: mine.map((o) => o.id),
      outletNames: mine.map((o) => o.name),
    }
  })
}

/**
 * Start a promotion at some outlets, in one transaction: it starts tomorrow and ends 27 days later.
 * Refused with `bad_outlet` (nothing written) when the list is empty or any id is not one of this
 * merchant's outlets, and with `busy` when one of the outlets already has a scheduled or running
 * promotion of this payment type (`outletId` = the first such outlet, in the order given).
 * Two requests for the same outlet and payment type cannot both pass: the merchant's row is locked
 * first (see lockMerchantOutlets), then the overlapping runs are read with SELECT ... FOR UPDATE.
 * Catalogue checks (key, channel, outlet suits the channel, who may start) are the caller's job.
 * @param {string} merchantId
 * @param {{key: string, channel: Channel, outletIds: string[], userId: string | null, today: string}} p
 * @returns {Promise<{ok: true, runId: string} | {ok: false, reason: 'busy', outletId: string} | {ok: false, reason: 'bad_outlet'}>}
 */
export async function startPromotion(merchantId, { key, channel, outletIds, userId, today }) {
  const ids = cleanOutletIds(outletIds)
  if (!ids) return { ok: false, reason: 'bad_outlet' }
  const { startsOn, endsOn } = datesFor(today)

  return withTransaction(async (exec) => {
    if (!(await lockMerchantOutlets(exec, merchantId, ids))) return { ok: false, reason: 'bad_outlet' }

    // Not finished = not stopped and not past its end (scheduled or running).
    const busy = await exec(
      `SELECT ro.outlet_id AS outletId
         FROM promotion_runs r
         JOIN promotion_run_outlets ro ON ro.promotion_run_id = r.promotion_run_id AND ro.merchant_id = r.merchant_id
        WHERE r.merchant_id = ? AND r.channel = ? AND r.stopped_on IS NULL AND r.ends_on >= ?
          AND ro.outlet_id IN (${marks(ids)})
          FOR UPDATE`,
      [merchantId, channel, today, ...ids],
    )
    if (busy.length > 0) {
      const taken = new Set(busy.map((b) => b.outletId))
      return { ok: false, reason: 'busy', outletId: /** @type {string} */ (ids.find((id) => taken.has(id))) }
    }

    const runId = randomUUID()
    await exec(
      `INSERT INTO promotion_runs (promotion_run_id, merchant_id, promotion_key, channel, starts_on, ends_on, started_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [runId, merchantId, key, channel, startsOn, endsOn, userId ?? null],
    )
    await exec(
      `INSERT INTO promotion_run_outlets (promotion_run_id, merchant_id, outlet_id) VALUES ${ids.map(() => '(?, ?, ?)').join(', ')}`,
      ids.flatMap((id) => [runId, merchantId, id]),
    )
    return { ok: true, runId }
  })
}

/**
 * Stop a promotion, in one transaction. Like startPromotion, the merchant's row is locked first, then the run
 * row while it is checked and changed (the same lock order, so a stop and a start cannot deadlock).
 * Scheduled (not started yet): the run is deleted, so it has no results and its outlets are free at once.
 * Running: `stopped_on` = today and `stopped_by` = the user; the row stays for results.
 * With `outletId` (an outlet manager): a run without that outlet is `not_found`, and a run that also
 * has other outlets is `not_yours`.
 * @param {string} merchantId
 * @param {string} runId
 * @param {{userId: string | null, today: string, outletId?: string | null}} p
 * @returns {Promise<{ok: true, deleted: boolean} | {ok: false, reason: 'not_found' | 'already_finished' | 'not_yours'}>}
 */
export async function stopPromotion(merchantId, runId, { userId, today, outletId = null }) {
  if (typeof runId !== 'string' || !isUuid(runId)) return { ok: false, reason: 'not_found' }

  return withTransaction(async (exec) => {
    const merchant = await exec('SELECT merchant_id FROM merchants WHERE merchant_id = ? FOR UPDATE', [merchantId])
    if (merchant.length === 0) return { ok: false, reason: 'not_found' }
    const rows = await exec(
      `SELECT starts_on AS startsOn, ends_on AS endsOn, stopped_on AS stoppedOn
         FROM promotion_runs WHERE merchant_id = ? AND promotion_run_id = ? FOR UPDATE`,
      [merchantId, runId],
    )
    const run = rows[0]
    if (!run) return { ok: false, reason: 'not_found' }

    if (outletId) {
      const outlets = await exec(`SELECT outlet_id AS id FROM promotion_run_outlets WHERE merchant_id = ? AND promotion_run_id = ?`, [merchantId, runId])
      if (!outlets.some((o) => o.id === outletId)) return { ok: false, reason: 'not_found' }
      if (outlets.length !== 1) return { ok: false, reason: 'not_yours' }
    }

    const status = runStatus(run, today)
    if (status === 'finished') return { ok: false, reason: 'already_finished' }
    if (status === 'scheduled') {
      await exec('DELETE FROM promotion_runs WHERE merchant_id = ? AND promotion_run_id = ?', [merchantId, runId]) // outlets go by ON DELETE CASCADE
      return { ok: true, deleted: true }
    }
    await exec(
      'UPDATE promotion_runs SET stopped_on = ?, stopped_by = ? WHERE merchant_id = ? AND promotion_run_id = ?',
      [today, userId ?? null, merchantId, runId],
    )
    return { ok: true, deleted: false }
  })
}

const SGT = `CONVERT_TZ(t.created_at, '+00:00', '+08:00')`

/**
 * Sales of one payment type at some outlets, per Singapore day, for the results of a promotion.
 * Successful payments only. Only days from `from` to `to` (inclusive) whose weekday is in `days`
 * (0 = Sunday … 6 = Saturday) are returned, oldest first, including days with no sales (cents 0),
 * so averages count every promotion day. With `hours` [start, end), only payments from start:00 up to
 * end:00 (exclusive) Singapore time count. Outlet ids that are not this merchant's match nothing.
 * @param {string} merchantId
 * @param {{channel: Channel, outletIds: string[], from: string, to: string, days: number[], hours?: [number, number] | null}} p
 * @returns {Promise<{day: string, cents: number}[]>}
 */
export async function getPromotionSales(merchantId, { channel, outletIds, from, to, days, hours = null }) {
  if (!Array.isArray(outletIds) || outletIds.length === 0 || !Array.isArray(days) || days.length === 0 || from > to) return []
  const weekdays = [...new Set(days.map(Number))]
  const rows = await query(
    `SELECT DATE_FORMAT(${SGT}, '%Y-%m-%d') AS day, SUM(t.amount_cents) AS cents
       FROM transactions t
      WHERE t.merchant_id = ? AND t.status = 'success' AND t.channel = ?
        AND t.outlet_id IN (${marks(outletIds)})
        AND t.created_at >= CONVERT_TZ(?, '+08:00', '+00:00') AND t.created_at < CONVERT_TZ(?, '+08:00', '+00:00')
        AND DAYOFWEEK(${SGT}) - 1 IN (${marks(weekdays)})${hours ? ` AND HOUR(${SGT}) >= ? AND HOUR(${SGT}) < ?` : ''}
      GROUP BY day`,
    [
      merchantId, channel, ...outletIds,
      `${from} 00:00:00`, `${addDays(to, 1)} 00:00:00`,
      ...weekdays, // MySQL DAYOFWEEK is 1 = Sunday … 7 = Saturday, so minus 1 matches ours
      ...(hours ? [Number(hours[0]), Number(hours[1])] : []),
    ],
  )
  const byDay = new Map(rows.map((r) => [r.day, Number(r.cents)]))
  return eachDay(from, to)
    .filter((d) => weekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay()))
    .map((day) => ({ day, cents: byDay.get(day) ?? 0 }))
}
