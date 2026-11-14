'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getCurrentMerchant } from '@/lib/data/merchant'
import { listOutlets } from '@/lib/data/outlets'
import { OUTLET_COOKIE, validateOutletChoice } from '@/lib/outlets/selection'

/**
 * The "Showing" menu: remember which outlet the person is looking at, or 'all'.
 * The outlet must be one of the signed-in merchant's own, so a made-up id is refused.
 * @param {string} choice an outlet id, or 'all'
 * @returns {Promise<{ok: boolean}>}
 */
export async function selectOutlet(choice) {
  const merchant = await getCurrentMerchant()
  const result = validateOutletChoice(await listOutlets(merchant.id), choice)
  if (!result.ok) return { ok: false }
  const jar = await cookies()
  if (result.outletId === null) {
    jar.delete(OUTLET_COOKIE)
  } else {
    // Not a secret: it is re-checked against the merchant's outlets on every request.
    jar.set(OUTLET_COOKIE, result.outletId, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  }
  revalidatePath('/', 'layout')
  return { ok: true }
}
