import { query } from '../db.js'

/**
 * A merchant's outlets (shops, stalls, the online store), ordered by name.
 * `online` is true for an online outlet (it takes NETS Click and eNETS, not NETS QR or SGQR).
 * @param {string} merchantId
 * @returns {Promise<{id: string, name: string, online: boolean}[]>}
 */
export async function listOutlets(merchantId) {
  const rows = await query(`SELECT outlet_id AS id, name, is_online AS online FROM outlets WHERE merchant_id = ? ORDER BY name, outlet_id`, [merchantId])
  return rows.map((r) => ({ id: r.id, name: r.name, online: Boolean(r.online) }))
}
