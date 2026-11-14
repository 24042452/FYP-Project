/**
 * Failed-login limiter, keyed by lowercased email.
 *
 * LIMITATION: the counts live in this process's memory. They reset on every restart or
 * deploy, and on a serverless host (Vercel) each instance has its own counts, so the real
 * limit can be higher than `max`. That is fine for the prototype; a production version
 * would keep the counts in the database or a shared cache such as Redis.
 *
 * @param {{max?: number, windowMs?: number, now?: () => number}} [opts]
 */
export function createRateLimiter({ max = 5, windowMs = 15 * 60_000, now = Date.now } = {}) {
  /** @type {Map<string, number[]>} */
  const failures = new Map()

  /** @param {string} email */
  const recent = (email) => {
    const key = email.trim().toLowerCase()
    const kept = (failures.get(key) ?? []).filter((t) => now() - t < windowMs)
    if (kept.length) failures.set(key, kept)
    else failures.delete(key)
    return { key, kept }
  }

  return {
    /** @param {string} email */
    isBlocked(email) {
      return recent(email).kept.length >= max
    },
    /** @param {string} email */
    recordFailure(email) {
      const { key, kept } = recent(email)
      failures.set(key, [...kept, now()])
    },
    /** @param {string} email */
    reset(email) {
      failures.delete(email.trim().toLowerCase())
    },
  }
}

/** The shared limiter used by the login actions. */
export const loginLimiter = createRateLimiter()
