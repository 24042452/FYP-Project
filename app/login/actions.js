'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { MERCHANT_COOKIE } from '@/lib/access/rules'
import { checkCredentials, checkDemo } from '@/lib/auth/login'
import { createSession, destroySession, touchLastLogin } from '@/lib/auth/session'

/**
 * Login form action (use with useActionState).
 * @param {{error?: string} | null} _prev
 * @param {FormData} formData
 */
export async function signIn(_prev, formData) {
  const result = await checkCredentials(
    String(formData.get('email') ?? ''),
    String(formData.get('password') ?? ''),
  )
  if ('error' in result) return result
  await startSession(result.userId)
  redirect('/')
}

/**
 * One-click demo login. The demo password is read on the server and never sent to the browser.
 * @param {string} profile hawker, retail, kopi_hq, kopi_owner or kopi_outlet
 * @returns {Promise<{error: string}>} only returns on failure; success redirects
 */
export async function signInAsDemo(profile) {
  const result = await checkDemo(profile)
  if ('error' in result) return result
  await startSession(result.userId)
  redirect('/')
}

/**
 * Start a fresh session. Head office starts on the group overview, so forget the franchisee picked last time.
 * @param {string} userId
 */
async function startSession(userId) {
  await createSession(userId)
  await touchLastLogin(userId)
  const jar = await cookies()
  jar.delete(MERCHANT_COOKIE)
}

/** Log out, then go to the login page. */
export async function signOut() {
  await destroySession()
  redirect('/login')
}
