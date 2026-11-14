import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../../lib/auth/password.js'

describe('password hashing', () => {
  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse')
    expect(await verifyPassword('correct horse', hash)).toBe(true)
    expect(await verifyPassword('wrong horse', hash)).toBe(false)
  })

  it('does not store the plain text', async () => {
    const hash = await hashPassword('correct horse')
    expect(hash).not.toContain('correct horse')
    expect(hash.length).toBeLessThanOrEqual(100)
  })
})
