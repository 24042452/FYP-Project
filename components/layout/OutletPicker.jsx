'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { selectOutlet } from '@/app/outlet-actions'

/**
 * The "Showing" menu in the sidebar. One outlet: just its name. Several: "All outlets" first, then each
 * outlet; picking one remembers it (cookie, set on the server) and reloads the page's numbers.
 * @param {{outlets: {id: string, name: string}[], selectedId: string | null, idSuffix?: string}} props
 */
export function OutletPicker({ outlets, selectedId, idSuffix = '' }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)
  const id = `outlet-select${idSuffix}`

  if (outlets.length === 0) return null

  if (outlets.length === 1) {
    return (
      <div className="flex flex-col gap-1 px-1">
        <span className="px-1 text-[13px] text-ink-3">Showing</span>
        <p className="flex min-h-11 items-center rounded-lg px-3 text-[15px] font-medium text-ink">{outlets[0].name}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 px-1">
      <label htmlFor={id} className="px-1 text-[13px] text-ink-3">Showing</label>
      <select
        id={id}
        value={selectedId ?? 'all'}
        disabled={pending}
        onChange={(e) => {
          const choice = e.target.value
          startTransition(async () => {
            const res = await selectOutlet(choice)
            setFailed(!res.ok)
            router.refresh()
          })
        }}
        className="min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-[15px] font-medium text-ink shadow-panel disabled:opacity-60"
      >
        <option value="all">All outlets</option>
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      {failed ? (
        <p role="alert" className="px-1 text-[13px] font-medium text-bad">
          Couldn’t switch outlet. Please try again.
        </p>
      ) : null}
    </div>
  )
}
