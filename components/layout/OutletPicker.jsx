'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { selectOutlet } from '@/app/outlet-actions'
import { OUTLET_SWITCHED } from './OutletToast'

/**
 * The "Showing" menu in the sidebar. One outlet: just its name. Several: "All outlets" first, then each
 * outlet; picking one remembers it (cookie, set on the server), reloads the page's numbers and says what
 * it now shows. While it works the menu is greyed with a small spinner.
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
      <div className="flex items-center justify-between px-1">
        <label htmlFor={id} className="text-[13px] text-ink-3">Showing</label>
        {pending ? (
          <span className="flex items-center gap-1 text-[12px] text-ink-3" aria-hidden="true">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
            Switching…
          </span>
        ) : null}
      </div>
      <select
        id={id}
        value={selectedId ?? 'all'}
        aria-disabled={pending}
        aria-busy={pending}
        onChange={(e) => {
          // aria-disabled (not disabled) keeps keyboard focus on the menu while it works.
          if (pending) return
          const choice = e.target.value
          const name = choice === 'all' ? null : (outlets.find((o) => o.id === choice)?.name ?? null)
          startTransition(async () => {
            const res = await selectOutlet(choice)
            setFailed(!res.ok)
            if (res.ok) {
              window.dispatchEvent(new CustomEvent(OUTLET_SWITCHED, { detail: name ? `Now showing ${name}` : 'Now showing all outlets' }))
            }
            router.refresh()
          })
        }}
        className="min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-[15px] font-medium text-ink shadow-panel aria-disabled:opacity-60"
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
