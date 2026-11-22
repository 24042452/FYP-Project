'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { selectFranchisee } from '@/app/franchise-actions'
import { OUTLET_SWITCHED } from './OutletToast'

const OVERVIEW = 'overview'

/**
 * Head office's "Franchisee" menu, above the outlet menu. "Whole group" opens the group overview; a franchisee
 * opens their Home, view only. The choice is remembered on the server (cookie) and re-checked every time.
 * @param {{group: {name: string, franchisees: {id: string, tradingName: string}[]}, currentId: string, idSuffix?: string, onNavigate?: () => void}} props
 */
export function FranchiseePicker({ group, currentId, idSuffix = '', onNavigate }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)
  const id = `franchisee-select${idSuffix}`
  const value = pathname === '/group' ? OVERVIEW : currentId

  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="flex items-center justify-between px-1">
        <label htmlFor={id} className="text-[13px] text-ink-3">{group.name} · Franchisee</label>
        {pending ? (
          <span className="flex items-center gap-1 text-[12px] text-ink-3" aria-hidden="true">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
            Switching…
          </span>
        ) : null}
      </div>
      <select
        id={id}
        value={value}
        aria-disabled={pending}
        aria-busy={pending}
        onChange={(e) => {
          if (pending) return
          const choice = e.target.value
          if (choice === OVERVIEW) {
            onNavigate?.()
            router.push('/group')
            return
          }
          const name = group.franchisees.find((f) => f.id === choice)?.tradingName ?? ''
          startTransition(async () => {
            const res = await selectFranchisee(choice)
            setFailed(!res.ok)
            if (res.ok) {
              window.dispatchEvent(new CustomEvent(OUTLET_SWITCHED, { detail: `Now showing ${name}` }))
              onNavigate?.()
              if (pathname === '/group') router.push('/')
              else router.refresh()
            }
          })
        }}
        className="min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-[15px] font-medium text-ink shadow-panel aria-disabled:opacity-60"
      >
        <option value={OVERVIEW}>Whole group (overview)</option>
        {group.franchisees.map((f) => (
          <option key={f.id} value={f.id}>{f.tradingName}</option>
        ))}
      </select>
      {failed ? (
        <p role="alert" className="px-1 text-[13px] font-medium text-bad">
          Couldn’t switch franchisee. Please try again.
        </p>
      ) : null}
    </div>
  )
}
