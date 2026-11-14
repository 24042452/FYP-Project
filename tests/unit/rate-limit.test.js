import { describe, it, expect } from 'vitest'
import { createRateLimiter } from '../../lib/auth/rate-limit.js'

describe('login rate limit', () => {
  it('blocks the 6th attempt after 5 failures, case-insensitively', () => {
    let now = 0
    const rl = createRateLimiter({ max: 5, windowMs: 15 * 60_000, now: () => now })
    for (let i = 0; i < 5; i++) {
      expect(rl.isBlocked('A@x.com')).toBe(false)
      rl.recordFailure('A@x.com')
    }
    expect(rl.isBlocked('a@x.com')).toBe(true)
    expect(rl.isBlocked('b@x.com')).toBe(false)
  })

  it('forgets failures after the window and on reset', () => {
    let now = 0
    const rl = createRateLimiter({ max: 2, windowMs: 1000, now: () => now })
    rl.recordFailure('a@x.com')
    rl.recordFailure('a@x.com')
    expect(rl.isBlocked('a@x.com')).toBe(true)
    now = 1001
    expect(rl.isBlocked('a@x.com')).toBe(false)
    rl.recordFailure('a@x.com')
    rl.recordFailure('a@x.com')
    rl.reset('a@x.com')
    expect(rl.isBlocked('a@x.com')).toBe(false)
  })
})
