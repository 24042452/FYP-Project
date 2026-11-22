import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { listOutlets } from '../data/outlets.js'
import { OUTLET_COOKIE, resolveOutlet } from './selection.js'

/**
 * The outlets this person may pick from and which one is picked in the "Showing" menu. The cookie is checked
 * against this merchant's own outlets, so a changed or old cookie just means "all outlets". An outlet manager
 * (merchant.outletId set) gets only their own outlet, always selected, whatever the cookie says.
 * Cached per request: the layout and the page share one lookup.
 * @param {{id: string, outletId?: string | null}} merchant the session merchant (from getCurrentMerchant)
 * @returns {Promise<{outlets: {id: string, name: string}[], selected: {id: string, name: string} | null}>}
 */
export const getSelectedOutlet = cache(async (merchant) => {
  const [all, jar] = await Promise.all([listOutlets(merchant.id), cookies()])
  if (merchant.outletId) {
    const own = all.filter((o) => o.id === merchant.outletId)
    return { outlets: own, selected: own[0] ?? null }
  }
  return { outlets: all, selected: resolveOutlet(all, jar.get(OUTLET_COOKIE)?.value) }
})
