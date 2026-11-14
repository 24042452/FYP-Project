import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID, createHash } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { hashPassword, verifyPassword } from '../../lib/auth/password.js'
import {
  createSessionRecord,
  findSessionUser,
  deleteSessionRecord,
  findUserByEmail,
} from '../../lib/auth/session.js'
import { query } from '../../lib/db.js'
import { findMerchantForUser } from '../../lib/data/merchant.js'

const USER = randomUUID()
const MERCHANT = randomUUID()
const EMAIL = 'tester@example.test'

const sha256 = (/** @type {string} */ s) => createHash('sha256').update(s).digest('hex')

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({ merchants: [{ id: MERCHANT, tradingName: 'Test Stall' }] })
  await adminExecute(
    'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
    [USER, EMAIL, await hashPassword('right-password'), 'Test User'],
  )
  await adminExecute(
    "INSERT INTO merchant_users (merchant_id, user_id, role) VALUES (?, ?, 'owner')",
    [MERCHANT, USER],
  )
})

describe('passwords', () => {
  it('accepts the right password and rejects a wrong one', async () => {
    const [u] = await query('SELECT password_hash FROM users WHERE id = ?', [USER])
    expect(await verifyPassword('right-password', u.password_hash)).toBe(true)
    expect(await verifyPassword('wrong-password', u.password_hash)).toBe(false)
  })
})

describe('sessions', () => {
  it('stores a hash of the token, never the token itself', async () => {
    const token = await createSessionRecord(USER)
    expect(token.length).toBeGreaterThanOrEqual(43) // 32 bytes, base64url
    const rows = await query('SELECT token_hash FROM sessions WHERE user_id = ?', [USER])
    const hashes = rows.map((r) => r.token_hash)
    expect(hashes).toContain(sha256(token))
    expect(hashes).not.toContain(token)
    expect(await findSessionUser(token)).toEqual({ id: USER, email: EMAIL, name: 'Test User' })
  })

  it('returns null for an unknown token and for an empty one', async () => {
    expect(await findSessionUser('not-a-real-token')).toBeNull()
    expect(await findSessionUser('')).toBeNull()
  })

  it('returns null once the session has expired', async () => {
    const token = await createSessionRecord(USER)
    await adminExecute(
      'UPDATE sessions SET expires_at = ? WHERE token_hash = ?',
      ['2000-01-01 00:00:00.000', sha256(token)],
    )
    expect(await findSessionUser(token)).toBeNull()
  })

  it('expires about 8 hours from now', async () => {
    const token = await createSessionRecord(USER)
    const [row] = await query(
      'SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(3), expires_at) AS mins FROM sessions WHERE token_hash = ?',
      [sha256(token)],
    )
    expect(Number(row.mins)).toBeGreaterThanOrEqual(8 * 60 - 2)
    expect(Number(row.mins)).toBeLessThanOrEqual(8 * 60)
  })

  it('removes the row when the session is destroyed', async () => {
    const token = await createSessionRecord(USER)
    await deleteSessionRecord(token)
    const rows = await query('SELECT id FROM sessions WHERE token_hash = ?', [sha256(token)])
    expect(rows).toHaveLength(0)
    expect(await findSessionUser(token)).toBeNull()
  })
})

describe('lookups', () => {
  it('finds a user by email, case-insensitively', async () => {
    const u = await findUserByEmail('TESTER@example.test')
    expect(u?.id).toBe(USER)
    expect(await findUserByEmail('nobody@example.test')).toBeNull()
  })

  it('finds the merchant a user belongs to', async () => {
    expect(await findMerchantForUser(USER)).toEqual({
      id: MERCHANT,
      tradingName: 'Test Stall',
      category: 'F&B',
      role: 'owner',
    })
    expect(await findMerchantForUser(randomUUID())).toBeNull()
  })
})
