import { addDays } from '../dates.js'
import { CHANNELS } from '../channels.js'

/** @typedef {import('../channels.js').Channel} Channel */
/** @typedef {'success' | 'failed' | 'refunded'} TxnStatus */

/** @type {TxnStatus[]} */
export const STATUSES = ['success', 'failed', 'refunded']

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * @param {unknown} s
 * @returns {s is string} true for a real calendar date written YYYY-MM-DD
 */
export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** @param {string} s */
export const isUuid = (s) => UUID_RE.test(s)

/** @param {unknown} v */
function first(v) {
  return Array.isArray(v) ? v[0] : v
}

/**
 * @typedef {{
 *   from: string, to: string, channel?: Channel, status?: TxnStatus, q?: string,
 *   cursor?: string, limit: number, id?: string,
 *   explicit: {from?: string, to?: string, channel?: Channel, status?: TxnStatus, q?: string}
 * }} TxnParams
 */

/**
 * Read and validate the address-bar filters. Anything invalid is ignored (default used),
 * so nothing unchecked reaches SQL. Default range is the last 7 Singapore days ending today.
 * @param {Record<string, string | string[] | undefined>} sp
 * @param {string} today YYYY-MM-DD (Singapore)
 * @returns {TxnParams}
 */
export function parseTxnParams(sp, today) {
  const get = (/** @type {string} */ k) => {
    const v = first(sp?.[k])
    return typeof v === 'string' ? v : undefined
  }
  /** @type {TxnParams['explicit']} */
  const explicit = {}

  let from = addDays(today, -6)
  let to = today
  const f = get('from')
  const t = get('to')
  if (isValidDate(f) && isValidDate(t) && f <= t) {
    from = f
    to = t
    explicit.from = f
    explicit.to = t
  }

  const ch = get('channel')
  const channel = CHANNELS.includes(/** @type {any} */ (ch)) ? /** @type {Channel} */ (ch) : undefined
  if (channel) explicit.channel = channel

  const st = get('status')
  const status = STATUSES.includes(/** @type {any} */ (st)) ? /** @type {TxnStatus} */ (st) : undefined
  if (status) explicit.status = status

  const qRaw = get('q')?.trim().slice(0, 40)
  const q = qRaw || undefined
  if (q) explicit.q = q

  const limitRaw = get('limit')
  const n = limitRaw && /^\d{1,3}$/.test(limitRaw) ? Number(limitRaw) : NaN
  const limit = n >= 1 && n <= 100 ? n : 50

  const cursorRaw = get('cursor')
  const cursor = cursorRaw && decodeCursor(cursorRaw) ? cursorRaw : undefined

  const idRaw = get('id')?.trim().slice(0, 64)

  return { from, to, channel, status, q, cursor, limit, id: idRaw || undefined, explicit }
}

/**
 * Opaque keyset cursor: base64url of {createdAt, id}.
 * @param {string} createdAtIso
 * @param {string} id
 * @returns {string}
 */
export function encodeCursor(createdAtIso, id) {
  return Buffer.from(JSON.stringify({ createdAt: createdAtIso, id })).toString('base64url')
}

/**
 * @param {string | undefined | null} cursor
 * @returns {{createdAt: string, id: string} | null} createdAt as MySQL DATETIME(3) text (UTC); null if malformed
 */
export function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string' || !/^[A-Za-z0-9_-]+$/.test(cursor)) return null
  try {
    const o = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (typeof o?.createdAt !== 'string' || typeof o?.id !== 'string') return null
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(o.createdAt)) return null
    if (Number.isNaN(new Date(o.createdAt).getTime()) || !isUuid(o.id)) return null
    return { createdAt: o.createdAt.replace('T', ' ').replace('Z', ''), id: o.id }
  } catch {
    return null
  }
}

/**
 * "12.50", "$12.50", "12", "$1,234.5" become cents; anything else is null.
 * @param {string} q
 * @returns {number | null}
 */
export function parseAmountCents(q) {
  const m = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d{1,9})(?:\.(\d{1,2}))?$/.exec(q.trim())
  if (!m) return null
  const dollars = Number(m[1].replace(/,/g, ''))
  const cents = m[2] ? Number(m[2].padEnd(2, '0')) : 0
  return dollars * 100 + cents
}

/**
 * Address for the transactions page keeping the explicit filters; overrides replace them
 * (null removes one). Cursor is never carried over.
 * @param {TxnParams} p
 * @param {{from?: string | null, to?: string | null, channel?: string | null, status?: string | null, q?: string | null, id?: string | null}} overrides
 * @returns {string}
 */
export function buildHref(p, overrides) {
  const merged = { ...p.explicit, ...overrides }
  const usp = new URLSearchParams()
  for (const k of /** @type {const} */ (['from', 'to', 'channel', 'status', 'q', 'id'])) {
    const v = merged[k]
    if (v) usp.set(k, v)
  }
  const s = usp.toString()
  return s ? `/transactions?${s}` : '/transactions'
}
