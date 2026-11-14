import 'server-only'
import { getSessionUser } from '../auth/session.js'
import { findMerchantForUser } from '../data/merchant.js'

/**
 * The merchant for the session cookie, or null. Unlike getCurrentMerchant it never redirects,
 * so API callers get a 401 JSON answer instead of the login page.
 * @returns {Promise<{id: string} | null>}
 */
export async function getCurrentMerchantForApi() {
  const user = await getSessionUser()
  if (!user) return null
  return findMerchantForUser(user.id)
}
