'use server'

import { redirect } from 'next/navigation'
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
  await createSession(result.userId)
  await touchLastLogin(result.userId)
  redirect('/')
}

/**
 * One-click demo login. The demo password is read on the server and never sent to the browser.
 * @param {'hawker' | 'retail'} profile
 * @returns {Promise<{error: string}>} only returns on failure; success redirects
 */
export async function signInAsDemo(profile) {
  const result = await checkDemo(profile)
  if ('error' in result) return result
  await createSession(result.userId)
  await touchLastLogin(result.userId)
  redirect('/')
}

/** Sign out, then go to the login page. */
export async function signOut() {
  await destroySession()
  redirect('/login')
}
