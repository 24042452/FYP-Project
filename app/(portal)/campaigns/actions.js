'use server'

import { revalidatePath } from 'next/cache'
import { requirePage } from '@/lib/data/merchant'
import { getSessionUser } from '@/lib/auth/session'
import { listOutlets } from '@/lib/data/outlets'
import { startPromotion, stopPromotion } from '@/lib/data/promotions'
import { promotionByKey, outletSuits } from '@/lib/promotions/catalogue'
import { canTakeUp, datesFor, pickOutlets } from '@/lib/promotions/rules'
import { CHANNEL_LABELS } from '@/lib/channels'
import { formatDay } from '@/lib/transactions/format'
import { sgtDate } from '@/lib/dates'

/** @typedef {{ok: true, message: string} | {ok: false, message: string}} ActionResult */

const VIEW_ONLY = 'Only the owner or an outlet manager can do this.'
const NOT_FOUND = "We couldn't find that promotion."
const NONE_PICKED = 'Pick at least one outlet.'
const BAD_OUTLET = 'Pick an outlet that can take this payment type.'
const NOT_YOURS = 'Only the owner can stop a promotion that runs at more than one outlet.'
const FINISHED = 'That promotion has already finished.'

/** Today's date in Singapore, 'YYYY-MM-DD'. */
const today = () => sgtDate(new Date().toISOString())

/**
 * The signed-in person and their access, or null when they may not start or stop promotions. Checked on the
 * server, so a view-only login cannot act even by sending the form by hand.
 */
async function actor() {
  const merchant = await requirePage('/campaigns')
  if (!canTakeUp(merchant)) return null
  const user = await getSessionUser()
  return user ? { merchant, userId: user.id } : null
}

/**
 * "Start promotion": the picked outlets get this promotion from tomorrow for 4 weeks.
 * @param {unknown} _prev the previous answer (unused; for useActionState)
 * @param {FormData} formData fields `key`, `outletIds` (repeated)
 * @returns {Promise<ActionResult>}
 */
export async function startPromotionAction(_prev, formData) {
  const who = await actor()
  if (!who) return { ok: false, message: VIEW_ONLY }
  const { merchant, userId } = who

  const promotion = promotionByKey(String(formData.get('key') ?? ''))
  if (!promotion || !promotion.categories.includes(merchant.category)) return { ok: false, message: NOT_FOUND }

  const outlets = await listOutlets(merchant.id)
  const picked = pickOutlets(merchant, outlets, formData.getAll('outletIds').filter((v) => typeof v === 'string'))
  if (!picked.ok) return { ok: false, message: picked.reason === 'none' ? NONE_PICKED : BAD_OUTLET }
  const { outletIds } = picked
  for (const id of outletIds) {
    const outlet = outlets.find((o) => o.id === id)
    if (!outlet || !outletSuits(promotion.channel, outlet)) return { ok: false, message: BAD_OUTLET }
  }

  const day = today()
  const res = await startPromotion(merchant.id, { key: promotion.key, channel: promotion.channel, outletIds, userId, today: day })
  if (!res.ok) {
    if (res.reason === 'busy') {
      const name = CHANNEL_LABELS[promotion.channel].replace(' (online)', '')
      return { ok: false, message: `That outlet already has a ${name} promotion. Pick another outlet.` }
    }
    return { ok: false, message: BAD_OUTLET }
  }
  revalidatePath('/campaigns')
  return { ok: true, message: `Started. It runs until ${formatDay(datesFor(day).endsOn)}.` }
}

/**
 * "Yes, stop": a running promotion ends today and its results stay; one that has not started is removed.
 * @param {unknown} _prev the previous answer (unused; for useActionState)
 * @param {FormData} formData field `runId`
 * @returns {Promise<ActionResult>}
 */
export async function stopPromotionAction(_prev, formData) {
  const who = await actor()
  if (!who) return { ok: false, message: VIEW_ONLY }
  const { merchant, userId } = who

  const res = await stopPromotion(merchant.id, String(formData.get('runId') ?? ''), { userId, today: today(), outletId: merchant.outletId })
  if (!res.ok) {
    if (res.reason === 'not_yours') return { ok: false, message: NOT_YOURS }
    return { ok: false, message: res.reason === 'already_finished' ? FINISHED : NOT_FOUND }
  }
  revalidatePath('/campaigns')
  return { ok: true, message: res.deleted ? 'Removed. It had not started yet.' : 'Stopped. Results show below.' }
}
