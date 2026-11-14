'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fromApiTransaction } from '@/lib/transactions/api'
import { toRowView } from '@/lib/transactions/format'

const PILL = {
  ok: 'bg-ok-bg text-ok',
  bad: 'bg-bad-bg text-bad',
  mute: 'bg-mute-bg text-mute',
}

/**
 * The payments list. A row (or Enter on it) opens the details drawer by adding ?id= to the address.
 * "Show more" fetches the next page from GET /api/v1/transactions (same filters) and appends it. The parent gives this
 * component a `key` built from the filters, so changing a filter starts it afresh.
 * @param {{
 *   initialRows: ReturnType<import('@/lib/transactions/format').toRowView>[],
 *   initialCursor: string | null,
 *   filters: Record<string, string>,
 *   baseQuery: string,
 *   selectedId?: string
 * }} props
 */
export function TxnTable({ initialRows, initialCursor, filters, baseQuery, selectedId }) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [cursor, setCursor] = useState(initialCursor)
  const [error, setError] = useState(false)
  const [pending, start] = useTransition()

  const hrefFor = (/** @type {string} */ id) => `/transactions?${baseQuery ? `${baseQuery}&` : ''}id=${encodeURIComponent(id)}`

  function more() {
    if (!cursor) return
    setError(false)
    start(async () => {
      try {
        const usp = new URLSearchParams(filters)
        usp.set('cursor', cursor)
        const res = await fetch(`/api/v1/transactions?${usp}`, { headers: { Accept: 'application/json' } })
        if (res.status === 401) {
          // Session ended: go to the login page like any other portal page would.
          router.push('/login')
          return
        }
        if (!res.ok) throw new Error(`status ${res.status}`)
        const body = await res.json()
        const next = body.data.map((/** @type {any} */ r) => toRowView(fromApiTransaction(r)))
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id))
          return [...prev, ...next.filter((/** @type {{id: string}} */ r) => !seen.has(r.id))]
        })
        setCursor(body.next_cursor)
      } catch {
        setError(true)
      }
    })
  }

  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-[15px] text-ink-2">
        No payments match these filters. Try a longer date range or clear the filters.
      </p>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[15px]">
          <thead className="max-sm:hidden">
            <tr className="border-b border-line text-left text-[13px] font-semibold text-ink-2">
              <th className="px-5 py-3 font-semibold">Time</th>
              <th className="px-3 py-3 text-right font-semibold">Amount</th>
              <th className="px-3 py-3 font-semibold">How paid</th>
              <th className="px-3 py-3 font-semibold">Outlet</th>
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="max-sm:block">
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => router.push(hrefFor(r.id), { scroll: false })}
                aria-selected={r.id === selectedId}
                className={`cursor-pointer border-b border-line last:border-0 hover:bg-page aria-selected:bg-nets-blue-soft max-sm:grid max-sm:grid-cols-[1fr_auto] max-sm:gap-x-3 max-sm:gap-y-0.5 max-sm:px-4 max-sm:py-3`}
              >
                <td className="px-5 py-3 whitespace-nowrap max-sm:col-start-1 max-sm:p-0">
                  <a
                    href={hrefFor(r.id)}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      router.push(hrefFor(r.id), { scroll: false })
                    }}
                    className="inline-flex min-h-11 items-center font-semibold text-ink no-underline hover:underline max-sm:min-h-0"
                  >
                    {r.when}
                  </a>
                </td>
                <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums max-sm:col-start-2 max-sm:row-start-1 max-sm:p-0">
                  {r.amount}
                </td>
                <td className="px-3 py-3 whitespace-nowrap max-sm:col-start-1 max-sm:p-0 max-sm:text-[14px] max-sm:text-ink-2">{r.how}</td>
                <td className="px-3 py-3 max-sm:col-start-1 max-sm:p-0 max-sm:text-[14px] max-sm:text-ink-2">{r.outlet}</td>
                <td className="px-5 py-3 max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-2 max-sm:self-center max-sm:p-0 max-sm:text-right">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-[3px] text-[13px] leading-snug font-semibold whitespace-nowrap ${PILL[r.pill.tone]}`}
                  >
                    {r.pill.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-[14px] text-ink-2 sm:px-5">
        <span>
          Showing {rows.length} {rows.length === 1 ? 'payment' : 'payments'}
          {cursor ? '' : ' (that is all of them)'}
        </span>
        {cursor ? (
          <button
            type="button"
            onClick={more}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-white px-4 text-[15px] font-semibold text-ink shadow-panel hover:border-ink-3 disabled:opacity-60 max-sm:w-full"
          >
            {pending ? 'Loading…' : 'Show more'}
          </button>
        ) : null}
        {error ? (
          <p role="alert" className="w-full text-[14px] text-bad">
            We couldn&apos;t load more payments. Please try again.
          </p>
        ) : null}
      </div>
    </>
  )
}
