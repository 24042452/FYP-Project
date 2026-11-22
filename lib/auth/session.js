import 'server-only'
import { randomBytes, createHash, randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { query } from '../db.js'

export const SESSION_COOKIE = 'portal_session'
const SESSION_HOURS = 8

/** @param {string} token */
const hashToken = (token) => createHash('sha256').update(token).digest('hex')

/** @param {Date} d MySQL DATETIME(3) text in UTC */
const toSqlUtc = (d) => d.toISOString().replace('T', ' ').replace('Z', '')

// ---- Database part (no cookies, so it can be tested outside Next.js) ----

/**
 * Create a session row. Only the SHA-256 hash of the token is stored.
 * @param {string} userId
 * @returns {Promise<string>} the raw token (base64url, 32 random bytes) for the cookie
 */
export async function createSessionRecord(userId) {
  const token = randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + SESSION_HOURS * 3_600_000)
  await query(
    'INSERT INTO sessions (session_id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [randomUUID(), userId, hashToken(token), toSqlUtc(expires)],
  )
  return token
}

/**
 * @param {string | undefined | null} token
 * @returns {Promise<{id: string, email: string, name: string} | null>} null if unknown or expired
 */
export async function findSessionUser(token) {
  if (!token) return null
  const rows = await query(
    `SELECT u.user_id AS id, u.email, u.name
       FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    [hashToken(token), toSqlUtc(new Date())],
  )
  return rows[0] ? { id: rows[0].id, email: rows[0].email, name: rows[0].name } : null
}

/** @param {string | undefined | null} token */
export async function deleteSessionRecord(token) {
  if (!token) return
  await query('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)])
}

/**
 * @param {string} email
 * @returns {Promise<{id: string, email: string, name: string, passwordHash: string} | null>}
 */
export async function findUserByEmail(email) {
  const rows = await query(
    'SELECT user_id AS id, email, name, password_hash FROM users WHERE email = ? LIMIT 1',
    [email.trim()],
  )
  const r = rows[0]
  return r ? { id: r.id, email: r.email, name: r.name, passwordHash: r.password_hash } : null
}

/** @param {string} userId */
export async function touchLastLogin(userId) {
  await query('UPDATE users SET last_login_at = ? WHERE user_id = ?', [toSqlUtc(new Date()), userId])
}

// ---- Cookie part (server actions, route handlers and server components) ----

/**
 * Create a session and set the cookie. Call from a server action or route handler only.
 * @param {string} userId
 */
export async function createSession(userId) {
  const token = await createSessionRecord(userId)
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  })
  return token
}

/** @returns {Promise<{id: string, email: string, name: string} | null>} */
export async function getSessionUser() {
  const jar = await cookies()
  return findSessionUser(jar.get(SESSION_COOKIE)?.value)
}

/** Delete the session row and clear the cookie. Server actions and route handlers only. */
export async function destroySession() {
  const jar = await cookies()
  await deleteSessionRecord(jar.get(SESSION_COOKIE)?.value)
  jar.delete(SESSION_COOKIE)
}
