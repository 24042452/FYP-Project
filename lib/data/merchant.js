import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { query } from '../db.js'
import { getSessionUser } from '../auth/session.js'
import { MERCHANT_COOKIE, canOpen, resolveAccess } from '../access/rules.js'

/**
 * @typedef {import('../access/rules.js').Access} Access
 * @typedef {Access} MerchantInfo
 */

/**
 * What a user may see: their own merchant (owner / outlet manager), or, for an HQ owner, one franchisee of
 * their group. Reads merchant_users and group_users, which are keyed by user, so this takes a userId rather
 * than a merchantId. `choice` is the franchisee an HQ owner picked (a cookie); it is only used if it is one
 * of their own franchisees.
 * @param {string} userId
 * @param {unknown} [choice]
 * @returns {Promise<Access | null>}
 */
export async function findMerchantForUser(userId, choice) {
  const [memberships, franchisees] = await Promise.all([
    query(
      `SELECT m.merchant_id AS merchantId, m.trading_name AS tradingName, m.category, mu.role, mu.outlet_id AS outletId
         FROM merchant_users mu JOIN merchants m ON m.merchant_id = mu.merchant_id
        WHERE mu.user_id = ?`,
      [userId],
    ),
    query(
      `SELECT g.group_id AS groupId, g.name AS groupName, m.merchant_id AS merchantId, m.trading_name AS tradingName, m.category
         FROM group_users gu
         JOIN merchant_groups g ON g.group_id = gu.group_id
         JOIN merchants m ON m.group_id = g.group_id
        WHERE gu.user_id = ?
        ORDER BY g.name, m.trading_name`,
      [userId],
    ),
  ])
  return resolveAccess({ memberships, franchisees, choice })
}

/**
 * THE only source of `merchantId` for pages, routes and assistant tools.
 * Redirects to /login when there is no valid session (or the user has no merchant).
 * Also returns the signed-in person's name and email for the top bar.
 * @returns {Promise<Access & {userName: string, userEmail: string}>}
 */
export const getCurrentMerchant = cache(async () => {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const jar = await cookies()
  const merchant = await findMerchantForUser(user.id, jar.get(MERCHANT_COOKIE)?.value)
  if (!merchant) redirect('/login')
  return { ...merchant, userName: user.name, userEmail: user.email }
})

/**
 * For pages an outlet manager or non-HQ user may not open: send them Home instead.
 * @param {string} path the page's path, e.g. '/settlements'
 */
export async function requirePage(path) {
  const merchant = await getCurrentMerchant()
  if (!canOpen(merchant, path)) redirect('/')
  return merchant
}
