import { randomUUID } from 'node:crypto'
import { query, withTransaction } from '../db.js'
import { addDays } from '../dates.js'
import { cleanOutletIds, lockMerchantOutlets, marks } from './promotions.js'

// Offers (deals from NETS and its partners) a merchant has taken up, per outlet. Every query is filtered
// by the caller's merchant id; outlet managers pass `outletId`. Dates are Singapore dates 'YYYY-MM-DD'.

/** @typedef {{ id: string, key: string, startsOn: string, endsOn: string, outletIds: string[], outletNames: string[] }} Takeup */

/**
 * Last active day of an offer taken up today for `months` months: the day before the same date
 * `months` later (24 Nov + 3 months → 23 Feb; 30 Nov + 3 → 27 Feb, as February has no 30th).
 * @param {string} today
 * @param {number} months
 */
export function offerEndsOn(today, months) {
  const [y, m, d] = today.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate()
  const same = new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10)
  return addDays(same, -1)
}

/**
 * This merchant's offer take-ups, newest first, each with its outlets (ids and names, by name).
 * With `outletId` (an outlet manager), only take-ups that include that outlet.
 * @param {string} merchantId
 * @param {{outletId?: string | null}} [opts]
 * @returns {Promise<Takeup[]>}
 */
export async function listOfferTakeups(merchantId, { outletId = null } = {}) {
  const rows = await query(
    `SELECT u.offer_takeup_id AS id, u.offer_key AS \`key\`, u.starts_on AS startsOn, u.ends_on AS endsOn
       FROM offer_takeups u
      WHERE u.merchant_id = ?${outletId ? ` AND EXISTS (SELECT 1 FROM offer_takeup_outlets x
              WHERE x.offer_takeup_id = u.offer_takeup_id AND x.merchant_id = u.merchant_id AND x.outlet_id = ?)` : ''}
      ORDER BY u.starts_on DESC, u.created_at DESC, u.offer_takeup_id`,
    outletId ? [merchantId, outletId] : [merchantId],
  )
  if (rows.length === 0) return []
  const outlets = await query(
    `SELECT uo.offer_takeup_id AS takeupId, o.outlet_id AS id, o.name
       FROM offer_takeup_outlets uo
       JOIN outlets o ON o.outlet_id = uo.outlet_id AND o.merchant_id = uo.merchant_id
      WHERE uo.merchant_id = ? AND uo.offer_takeup_id IN (${marks(rows)})
      ORDER BY o.name, o.outlet_id`,
    [merchantId, ...rows.map((r) => r.id)],
  )
  return rows.map((r) => {
    const mine = outlets.filter((o) => o.takeupId === r.id)
    return { id: r.id, key: r.key, startsOn: r.startsOn, endsOn: r.endsOn, outletIds: mine.map((o) => o.id), outletNames: mine.map((o) => o.name) }
  })
}

/**
 * Take up an offer at some outlets, in one transaction: active from today for `months` months
 * (see offerEndsOn). Refused with `bad_outlet` (nothing written) when the list is empty or any id is not
 * one of this merchant's outlets, and with `busy` when the same offer is still active (ends today or
 * later) at one of them. Racing requests are serialised like startPromotion (merchant row lock, then
 * SELECT ... FOR UPDATE). Catalogue checks and who may take up are the caller's job.
 * @param {string} merchantId
 * @param {{key: string, months: number, outletIds: string[], userId: string | null, today: string}} p
 * @returns {Promise<{ok: true, takeupId: string, endsOn: string} | {ok: false, reason: 'busy', outletId: string} | {ok: false, reason: 'bad_outlet'}>}
 */
export async function takeUpOffer(merchantId, { key, months, outletIds, userId, today }) {
  if (!Number.isInteger(months) || months < 1) throw new Error(`Bad offer length: ${months}`)
  const ids = cleanOutletIds(outletIds)
  if (!ids) return { ok: false, reason: 'bad_outlet' }
  const endsOn = offerEndsOn(today, months)

  return withTransaction(async (exec) => {
    if (!(await lockMerchantOutlets(exec, merchantId, ids))) return { ok: false, reason: 'bad_outlet' }

    const busy = await exec(
      `SELECT uo.outlet_id AS outletId
         FROM offer_takeups u
         JOIN offer_takeup_outlets uo ON uo.offer_takeup_id = u.offer_takeup_id AND uo.merchant_id = u.merchant_id
        WHERE u.merchant_id = ? AND u.offer_key = ? AND u.ends_on >= ?
          AND uo.outlet_id IN (${marks(ids)})
          FOR UPDATE`,
      [merchantId, key, today, ...ids],
    )
    if (busy.length > 0) {
      const taken = new Set(busy.map((b) => b.outletId))
      return { ok: false, reason: 'busy', outletId: /** @type {string} */ (ids.find((id) => taken.has(id))) }
    }

    const takeupId = randomUUID()
    await exec(
      `INSERT INTO offer_takeups (offer_takeup_id, merchant_id, offer_key, starts_on, ends_on, taken_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [takeupId, merchantId, key, today, endsOn, userId ?? null],
    )
    await exec(
      `INSERT INTO offer_takeup_outlets (offer_takeup_id, merchant_id, outlet_id) VALUES ${ids.map(() => '(?, ?, ?)').join(', ')}`,
      ids.flatMap((id) => [takeupId, merchantId, id]),
    )
    return { ok: true, takeupId, endsOn }
  })
}
