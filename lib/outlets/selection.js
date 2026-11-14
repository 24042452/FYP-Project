// Pure rules for the "Showing" outlet picker. The choice lives in a plain cookie, which the browser
// can change, so it is only ever used after checking it against this merchant's own outlets.

/** Name of the cookie that remembers the chosen outlet. */
export const OUTLET_COOKIE = 'portal_outlet'

/** @typedef {{id: string, name: string}} OutletOption */

/**
 * The outlet a cookie value points at, or null (= all outlets) when it is missing, "all", or not one
 * of this merchant's outlets.
 * @param {OutletOption[]} outlets this merchant's outlets
 * @param {unknown} value cookie value
 * @returns {OutletOption | null}
 */
export function resolveOutlet(outlets, value) {
  if (typeof value !== 'string' || value === '' || value === 'all') return null
  return outlets.find((o) => o.id === value) ?? null
}

/**
 * Check a requested choice from the picker.
 * @param {OutletOption[]} outlets this merchant's outlets
 * @param {unknown} choice an outlet id or 'all'
 * @returns {{ok: true, outletId: string | null} | {ok: false}} outletId null means all outlets
 */
export function validateOutletChoice(outlets, choice) {
  if (choice === 'all') return { ok: true, outletId: null }
  const found = resolveOutlet(outlets, choice)
  return found ? { ok: true, outletId: found.id } : { ok: false }
}
