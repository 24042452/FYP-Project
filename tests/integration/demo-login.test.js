import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, resetTestDb } from './helpers.js'
import { hashPassword } from '../../lib/auth/password.js'
import { checkCredentials, checkDemo, BAD_LOGIN } from '../../lib/auth/login.js'
import { loginLimiter } from '../../lib/auth/rate-limit.js'

const EMAIL = 'hawker@demo.local'
const DEMO_PW = 'demo-password-for-tests'
const USER = randomUUID()
const saved = { mode: process.env.DEMO_MODE, pw: process.env.DEMO_PASSWORD }

beforeAll(async () => {
  await resetTestDb()
  await adminExecute(
    'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
    [USER, EMAIL, await hashPassword(DEMO_PW), 'Ah Hock'],
  )
  process.env.DEMO_PASSWORD = DEMO_PW
})

afterEach(() => {
  process.env.DEMO_MODE = saved.mode
  loginLimiter.reset(EMAIL)
})

describe('demo sign-in and the login limiter', () => {
  it('still works after 5 failed form logins locked the form', async () => {
    process.env.DEMO_MODE = 'true'
    for (let i = 0; i < 5; i++) {
      expect(await checkCredentials(EMAIL, 'wrong')).toEqual({ error: BAD_LOGIN })
    }
    // The form is now locked, even for the right password...
    expect(await checkCredentials(EMAIL, DEMO_PW)).toEqual({ error: BAD_LOGIN })
    // ...but the demo button is not.
    expect(await checkDemo('hawker')).toEqual({ userId: USER })
  })

  it('does not count towards the form limiter', async () => {
    process.env.DEMO_MODE = 'true'
    expect(loginLimiter.isBlocked(EMAIL)).toBe(false)
    await checkDemo('hawker')
    expect(loginLimiter.isBlocked(EMAIL)).toBe(false)
  })

  it('rejects prototype-property profile names', async () => {
    process.env.DEMO_MODE = 'true'
    for (const p of ['constructor', 'toString', '__proto__']) expect(await checkDemo(p)).toHaveProperty('error')
  })

  it('refuses when DEMO_MODE is not true', async () => {
    process.env.DEMO_MODE = 'false'
    expect(await checkDemo('hawker')).toHaveProperty('error')
    delete process.env.DEMO_MODE
    expect(await checkDemo('hawker')).toHaveProperty('error')
  })
})
