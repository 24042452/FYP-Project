'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { shouldSearch, suggestionView } from '@/lib/search/nav'

/** @typedef {ReturnType<typeof suggestionView>} Suggestion */
/** @typedef {'idle' | 'loading' | 'ok' | 'empty' | 'error'} SearchState */

export const DEBOUNCE_MS = 250

/**
 * Live payment suggestions: waits 250 ms after typing stops, cancels the request before it, and
 * reports one of idle / loading / ok / empty / error. A signed-out session goes to /login.
 * @param {string} text what the person typed
 * @param {string | null} outletId the outlet picked in the "Showing" menu (or null for all)
 * @returns {{state: SearchState, rows: Suggestion[]}}
 */
export function useTxnSearch(text, outletId) {
  const router = useRouter()
  const [result, setResult] = useState(/** @type {{key: string, state: SearchState, rows: Suggestion[]}} */ ({ key: '', state: 'idle', rows: [] }))
  const q = text.trim()
  const active = shouldSearch(q)
  const key = `${outletId ?? ''}|${q}`

  useEffect(() => {
    if (!active) return
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const usp = new URLSearchParams({ q, limit: '5' })
        if (outletId) usp.set('outlet', outletId)
        const res = await fetch(`/api/v1/transactions?${usp}`, { headers: { Accept: 'application/json' }, signal: ctrl.signal })
        if (res.status === 401) {
          router.push('/login')
          return
        }
        if (!res.ok) throw new Error(`status ${res.status}`)
        const body = await res.json()
        const rows = body.data.map(suggestionView)
        setResult({ key, state: rows.length ? 'ok' : 'empty', rows })
      } catch (err) {
        if (/** @type {any} */ (err)?.name === 'AbortError') return
        setResult({ key, state: 'error', rows: [] })
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q, active, outletId, key, router])

  if (!active) return { state: 'idle', rows: [] }
  // Results of an older query are not shown for the new one.
  if (result.key !== key) return { state: 'loading', rows: [] }
  return { state: result.state, rows: result.rows }
}
