import 'server-only'
import { cookies } from 'next/headers'
import { getSessionUser } from '../auth/session.js'
import { findMerchantForUser } from '../data/merchant.js'
import { MERCHANT_COOKIE } from '../access/rules.js'

/**
 * The merchant (and access tier) for the session cookie, or null. Unlike getCurrentMerchant it never
 * redirects, so API callers get a 401 JSON answer instead of the login page.
 * @returns {Promise<import('../access/rules.js').Access | null>}
 */
export async function getCurrentMerchantForApi() {
  const user = await getSessionUser()
  if (!user) return null
  const jar = await cookies()
  return findMerchantForUser(user.id, jar.get(MERCHANT_COOKIE)?.value)
}
