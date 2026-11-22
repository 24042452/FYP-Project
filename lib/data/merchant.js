import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { query } from '../db.js'
import { getSessionUser } from '../auth/session.js'

/**
 * @typedef {'owner' | 'manager' | 'cashier' | 'accountant'} MemberRole
 * @typedef {{id: string, tradingName: string, category: string, role: MemberRole}} MerchantInfo
 */

/**
 * The merchant a user belongs to (first one if several). Reads merchant_users, which is
 * keyed by user, so this takes a userId rather than a merchantId.
 * @param {string} userId
 * @returns {Promise<MerchantInfo | null>}
 */
export async function findMerchantForUser(userId) {
  const rows = await query(
    `SELECT m.merchant_id AS id, m.trading_name, m.category, mu.role
       FROM merchant_users mu JOIN merchants m ON m.merchant_id = mu.merchant_id
      WHERE mu.user_id = ?
      ORDER BY m.trading_name
      LIMIT 1`,
    [userId],
  )
  const r = rows[0]
  return r ? { id: r.id, tradingName: r.trading_name, category: r.category, role: r.role } : null
}

/**
 * THE only source of `merchantId` for pages, routes and assistant tools.
 * Redirects to /login when there is no valid session (or the user has no merchant).
 * Also returns the signed-in person's name and email for the top bar.
 * @returns {Promise<MerchantInfo & {userName: string, userEmail: string}>}
 */
export const getCurrentMerchant = cache(async () => {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const merchant = await findMerchantForUser(user.id)
  if (!merchant) redirect('/login')
  return { ...merchant, userName: user.name, userEmail: user.email }
})
