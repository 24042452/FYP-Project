import 'server-only'
import { verifyPassword } from './password.js'
import { loginLimiter } from './rate-limit.js'
import { findUserByEmail } from './session.js'

export const BAD_LOGIN = "That email or password doesn't match. Please try again."

// A real bcrypt hash of a random string, so unknown emails take as long as wrong passwords.
const DUMMY_HASH = '$2b$12$3RHDGi48FKaiI.0ObgOYC.7EOnLIt1AesRw7jobZSWhnyC6jXNSdS'

/**
 * Check an email and password (no cookies, so it can be tested). Same error text for an
 * unknown email, a wrong password and a rate-limited email.
 * @param {string} email
 * @param {string} password
 * @param {{limited?: boolean}} [opts] limited=false skips the limiter (demo sign-in only)
 * @returns {Promise<{error: string} | {userId: string}>}
 */
export async function checkCredentials(email, password, { limited = true } = {}) {
  const e = String(email ?? '').trim()
  const p = String(password ?? '')
  if (!e || !p) return { error: BAD_LOGIN }
  if (limited && loginLimiter.isBlocked(e)) return { error: BAD_LOGIN }

  const user = await findUserByEmail(e)
  const ok = await verifyPassword(p, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok) {
    if (limited) loginLimiter.recordFailure(e)
    return { error: BAD_LOGIN }
  }
  if (limited) loginLimiter.reset(e)
  return { userId: user.id }
}

const DEMO_EMAILS = { hawker: 'hawker@demo.local', retail: 'retail@demo.local' }

/**
 * Check a demo profile using the server-held DEMO_PASSWORD. It is neither blocked by nor
 * counted in the form's limiter: the password never leaves the server, so it cannot be
 * guessed through this path, and typos on the form must not lock the demo buttons.
 * Refuses (returns an error) unless DEMO_MODE=true.
 * @param {string} profile
 * @returns {Promise<{error: string} | {userId: string}>}
 */
export async function checkDemo(profile) {
  if (process.env.DEMO_MODE !== 'true') return { error: 'Demo sign-in is not turned on.' }
  const email = DEMO_EMAILS[/** @type {'hawker'} */ (profile)]
  const password = process.env.DEMO_PASSWORD
  if (!email || !password) return { error: 'Demo sign-in is not set up.' }
  const result = await checkCredentials(email, password, { limited: false })
  if ('error' in result) return { error: 'Demo sign-in did not work. Please try again.' }
  return result
}
