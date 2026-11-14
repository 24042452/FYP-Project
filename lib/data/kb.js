import { query } from '../db.js'
import { likeEscape } from './transactions.js'

/**
 * @typedef {{id: number, source: string, heading: string, content: string}} KbChunk
 */

/** Everyday words ignored by the LIKE fallback (it also skips words under 3 letters, as full-text does). */
const STOP = new Set(['the', 'and', 'for', 'how', 'what', 'why', 'when', 'does', 'did', 'can', 'are', 'was', 'you', 'your', 'with', 'from', 'this', 'that', 'will', 'get', 'have', 'has', 'not', 'but', 'its', 'our', 'any', 'all', 'out', 'who', 'where', 'which', 'do', 'is', 'my', 'me', 'it', 'to', 'of', 'in', 'on', 'a', 'an', 'i'])

/**
 * Search the help centre. Shared help content, NOT merchant data: kb_chunks has no merchant_id, so this is
 * the one data function without a merchantId argument.
 * Returns up to 4 chunks, best first: natural-language full-text search, then a LIKE fallback on the
 * short words (GST, MDR) that full-text ignores.
 * @param {string} q
 * @returns {Promise<KbChunk[]>}
 */
export async function searchKb(q) {
  const text = String(q ?? '').trim().slice(0, 200)
  if (!text) return []
  const rows = await query(
    `SELECT id, source, heading, content,
            MATCH(heading, content) AGAINST(? IN NATURAL LANGUAGE MODE) AS score
       FROM kb_chunks
      WHERE MATCH(heading, content) AGAINST(? IN NATURAL LANGUAGE MODE)
      ORDER BY score DESC, id ASC
      LIMIT 4`,
    [text, text],
  )
  if (rows.length > 0) return rows.map(toChunk)

  const words = [...new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((w) => w.length >= 3 && !STOP.has(w))
  if (words.length === 0) return []
  const like = words.slice(0, 5).map((w) => `%${likeEscape(w)}%`)
  const cond = like.map(() => '(heading LIKE ? OR content LIKE ?)').join(' OR ')
  const hits = await query(
    `SELECT id, source, heading, content FROM kb_chunks WHERE ${cond} ORDER BY id ASC LIMIT 4`,
    like.flatMap((l) => [l, l]),
  )
  return hits.map(toChunk)
}

/** @param {any} r @returns {KbChunk} */
function toChunk(r) {
  return { id: Number(r.id), source: String(r.source), heading: String(r.heading), content: String(r.content) }
}
