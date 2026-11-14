'use server'

import { redirect } from 'next/navigation'
import { verifyPassword } from '@/lib/auth/password'
import { loginLimiter } from '@/lib/auth/rate-limit'
import {
  createSession,
  destroySession,
  findUserByEmail,
  touchLastLogin,
} from '@/lib/auth/session'

const BAD_LOGIN = "That email or password doesn't match. Please try again."

// A real bcrypt hash of a random string, so unknown emails take as long as wrong passwords.
const DUMMY_HASH = '$2b$12$3RHDGi48FKaiI.0ObgOYC.7EOnLIt1AesRw7jobZSWhnyC6jXNSdS'

/**
 * Check the email and password and, if they match, start a session.
 * Same error text for an unknown email, a wrong password and a rate-limited email.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{error: string} | {ok: true}>}
 */
async function authenticate(email, password) {
  const e = String(email ?? '').trim()
  const p = String(password ?? '')
  if (!e || !p) return { error: BAD_LOGIN }
  if (loginLimiter.isBlocked(e)) return { error: BAD_LOGIN }

  const user = await findUserByEmail(e)
  const ok = await verifyPassword(p, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok) {
    loginLimiter.recordFailure(e)
    return { error: BAD_LOGIN }
  }
  loginLimiter.reset(e)
  await createSession(user.id)
  await touchLastLogin(user.id)
  return { ok: true }
}

/**
 * Login form action (use with useActionState).
 * @param {{error?: string} | null} _prev
 * @param {FormData} formData
 */
export async function signIn(_prev, formData) {
  const result = await authenticate(
    String(formData.get('email') ?? ''),
    String(formData.get('password') ?? ''),
  )
  if ('error' in result) return result
  redirect('/')
}

const DEMO_EMAILS = { hawker: 'hawker@demo.local', retail: 'retail@demo.local' }

/**
 * One-click demo login. The demo password is read here on the server and never sent to the browser.
 * Refuses (returns an error) unless DEMO_MODE=true.
 * @param {'hawker' | 'retail'} profile
 * @returns {Promise<{error: string}>} only returns on failure; success redirects
 */
export async function signInAsDemo(profile) {
  if (process.env.DEMO_MODE !== 'true') return { error: 'Demo sign-in is not turned on.' }
  const email = DEMO_EMAILS[profile]
  const password = process.env.DEMO_PASSWORD
  if (!email || !password) return { error: 'Demo sign-in is not set up.' }
  const result = await authenticate(email, password)
  if ('error' in result) return { error: 'Demo sign-in did not work. Please try again.' }
  redirect('/')
}

/** Sign out, then go to the login page. */
export async function signOut() {
  await destroySession()
  redirect('/login')
}
