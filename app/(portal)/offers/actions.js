'use server'

import { revalidatePath } from 'next/cache'
import { requirePage } from '@/lib/data/merchant'
import { getSessionUser } from '@/lib/auth/session'
import { listOutlets } from '@/lib/data/outlets'
import { takeUpOffer } from '@/lib/data/offers'
import { offerByKey } from '@/lib/offers/catalogue'
import { canTakeUp } from '@/lib/promotions/rules'
import { formatDay } from '@/lib/transactions/format'
import { sgtDate } from '@/lib/dates'

/** @typedef {{ok: true, message: string} | {ok: false, message: string}} ActionResult */

const VIEW_ONLY = 'Only the owner or an outlet manager can do this.'
const NOT_FOUND = "We couldn't find that offer."
const NONE_PICKED = 'Pick at least one outlet.'
const BAD_OUTLET = 'Pick an outlet that can take this offer.'
const BUSY = 'That outlet already has this offer. Pick another outlet.'

/**
 * "Take up": the offer becomes active at the picked outlets for its months.
 * @param {unknown} _prev the previous answer (unused; for useActionState)
 * @param {FormData} formData fields `key`, `outletIds` (repeated)
 * @returns {Promise<ActionResult>}
 */
export async function takeUpOfferAction(_prev, formData) {
  const merchant = await requirePage('/offers')
  if (!canTakeUp(merchant)) return { ok: false, message: VIEW_ONLY }
  const user = await getSessionUser()
  if (!user) return { ok: false, message: VIEW_ONLY }

  const offer = offerByKey(String(formData.get('key') ?? ''))
  if (!offer || !(/** @type {string[]} */ (offer.categories)).includes(merchant.category)) return { ok: false, message: NOT_FOUND }

  const outlets = await listOutlets(merchant.id)
  const asked = [...new Set(formData.getAll('outletIds').filter((v) => typeof v === 'string'))]
  /** @type {string[]} */
  let outletIds
  if (merchant.outletId) {
    // An outlet manager can only act for their own outlet, whatever the form says.
    if (asked.some((id) => id !== merchant.outletId)) return { ok: false, message: BAD_OUTLET }
    outletIds = [merchant.outletId]
  } else if (asked.length === 0 && outlets.length === 1) {
    outletIds = [outlets[0].id] // a one-outlet business has no outlet list to tick
  } else {
    outletIds = asked
  }
  if (outletIds.length === 0) return { ok: false, message: NONE_PICKED }
  if (outletIds.some((id) => !outlets.some((o) => o.id === id))) return { ok: false, message: BAD_OUTLET }

  const day = sgtDate(new Date().toISOString())
  const res = await takeUpOffer(merchant.id, { key: offer.key, months: offer.months, outletIds, userId: user.id, today: day })
  if (!res.ok) return { ok: false, message: res.reason === 'busy' ? BUSY : BAD_OUTLET }
  revalidatePath('/offers')
  return { ok: true, message: `Taken up. Active until ${formatDay(res.endsOn)}.` }
}
