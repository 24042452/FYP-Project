'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getCurrentMerchant } from '@/lib/data/merchant'
import { MERCHANT_COOKIE, validateFranchiseeChoice } from '@/lib/access/rules'
import { OUTLET_COOKIE } from '@/lib/outlets/selection'

/**
 * The HQ "Franchisee" menu: remember which franchisee head office is looking at. Only a franchisee of the
 * signed-in HQ owner's own group is accepted, so a made-up id is refused. Picking one also resets the outlet
 * menu to "All outlets" (the old outlet belonged to another franchisee).
 * @param {string} choice a merchant id
 * @returns {Promise<{ok: boolean}>}
 */
export async function selectFranchisee(choice) {
  const merchant = await getCurrentMerchant()
  const id = validateFranchiseeChoice(merchant, choice)
  if (!id) return { ok: false }
  const jar = await cookies()
  // Not a secret: it is re-checked against the HQ owner's group on every request.
  jar.set(MERCHANT_COOKIE, id, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
  jar.delete(OUTLET_COOKIE)
  revalidatePath('/', 'layout')
  return { ok: true }
}
