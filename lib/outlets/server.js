import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { listOutlets } from '../data/outlets.js'
import { OUTLET_COOKIE, resolveOutlet } from './selection.js'

/**
 * The merchant's outlets and which one is picked in the "Showing" menu. The cookie is checked
 * against this merchant's own outlets, so a changed or old cookie just means "all outlets".
 * Cached per request: the layout and the page share one lookup.
 * @param {{id: string}} merchant the session merchant (from getCurrentMerchant)
 * @returns {Promise<{outlets: {id: string, name: string}[], selected: {id: string, name: string} | null}>}
 */
export const getSelectedOutlet = cache(async (merchant) => {
  const [outlets, jar] = await Promise.all([listOutlets(merchant.id), cookies()])
  return { outlets, selected: resolveOutlet(outlets, jar.get(OUTLET_COOKIE)?.value) }
})
