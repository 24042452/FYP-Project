import { query } from '../db.js'

/**
 * A merchant's outlets (shops, stalls, the online store), ordered by name.
 * @param {string} merchantId
 * @returns {Promise<{id: string, name: string}[]>}
 */
export async function listOutlets(merchantId) {
  const rows = await query(`SELECT outlet_id AS id, name FROM outlets WHERE merchant_id = ? ORDER BY name, outlet_id`, [merchantId])
  return rows.map((r) => ({ id: r.id, name: r.name }))
}
