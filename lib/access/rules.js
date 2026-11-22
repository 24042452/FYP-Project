// Who may see what: the three owner tiers (franchise HQ, merchant owner, outlet manager).
// Pure rules, so they are unit-tested; lib/data/merchant.js loads the rows and calls resolveAccess.

/** Cookie that remembers which franchisee an HQ owner is looking at. Re-checked on every request. */
export const MERCHANT_COOKIE = 'portal_merchant'

/**
 * @typedef {'hq' | 'merchant' | 'outlet'} Tier
 * @typedef {{merchantId: string, tradingName: string, category: string, role: string, outletId: string | null}} Membership
 *   a merchant_users row (outletId set = outlet manager)
 * @typedef {{groupId: string, groupName: string, merchantId: string, tradingName: string, category: string}} FranchiseeRow
 *   one franchisee of a group the user is HQ owner of
 * @typedef {{
 *   id: string, tradingName: string, category: string, role: string,
 *   tier: Tier, readOnly: boolean, outletId: string | null,
 *   group: {id: string, name: string, franchisees: {id: string, tradingName: string}[]} | null,
 *   chosen: boolean,
 * }} Access
 *   `id` is the merchant every page shows (THE merchantId for data functions). `outletId` is the outlet an
 *   outlet manager is locked to. `chosen` is false when an HQ owner has not picked a franchisee yet.
 */

/**
 * Decide which merchant (and outlet) a signed-in user sees.
 * - A direct membership wins (merchant owner, or outlet manager locked to one outlet). The first by name.
 * - Otherwise an HQ owner sees the franchisee named by the cookie if it is in their group, else the first one,
 *   read-only.
 * - No membership and no group: null (the user is sent to the login page).
 * @param {{memberships: Membership[], franchisees: FranchiseeRow[], choice?: unknown}} input
 * @returns {Access | null}
 */
export function resolveAccess({ memberships, franchisees, choice }) {
  const direct = [...memberships].sort((a, b) => a.tradingName.localeCompare(b.tradingName))[0]
  if (direct) {
    const outletId = direct.outletId ?? null
    return {
      id: direct.merchantId,
      tradingName: direct.tradingName,
      category: direct.category,
      role: direct.role,
      tier: outletId ? 'outlet' : 'merchant',
      readOnly: false,
      outletId,
      group: null,
      chosen: true,
    }
  }
  if (franchisees.length === 0) return null

  const groupId = franchisees[0].groupId
  const mine = franchisees
    .filter((f) => f.groupId === groupId)
    .sort((a, b) => a.tradingName.localeCompare(b.tradingName))
  const picked = typeof choice === 'string' ? mine.find((f) => f.merchantId === choice) : undefined
  const shown = picked ?? mine[0]
  return {
    id: shown.merchantId,
    tradingName: shown.tradingName,
    category: shown.category,
    role: 'hq_owner',
    tier: 'hq',
    readOnly: true,
    outletId: null,
    group: { id: groupId, name: mine[0].groupName, franchisees: mine.map((f) => ({ id: f.merchantId, tradingName: f.tradingName })) },
    chosen: Boolean(picked),
  }
}

/** Pages that cover the whole business (not one outlet), so an outlet manager does not see them. */
export const MERCHANT_WIDE_PATHS = ['/settlements', '/reconciliation', '/invoices', '/reports', '/assistant']

/**
 * Whether this person may open a page. Outlet managers only see Home and Sales & payments (both follow
 * their outlet); everyone else sees everything. The group overview is for HQ owners only.
 * @param {Pick<Access, 'tier'>} access
 * @param {string} path
 */
export function canOpen(access, path) {
  if (path === '/group' || path.startsWith('/group/')) return access.tier === 'hq'
  if (access.tier !== 'outlet') return true
  return !MERCHANT_WIDE_PATHS.some((p) => path === p || path.startsWith(p + '/'))
}

/**
 * Check a franchisee picked from the HQ menu: it must be in the HQ owner's own group.
 * @param {Access} access
 * @param {unknown} choice a merchant id
 * @returns {string | null} the merchant id, or null if not allowed
 */
export function validateFranchiseeChoice(access, choice) {
  if (access.tier !== 'hq' || !access.group || typeof choice !== 'string') return null
  return access.group.franchisees.some((f) => f.id === choice) ? choice : null
}
