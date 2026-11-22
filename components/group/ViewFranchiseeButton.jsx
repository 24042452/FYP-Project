'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { selectFranchisee } from '@/app/franchise-actions'
import { OUTLET_SWITCHED } from '@/components/layout/OutletToast'

/**
 * "Open" on the group overview: switch head office to this franchisee and go to their Home (view only).
 * @param {{id: string, name: string}} props
 */
export function ViewFranchiseeButton({ id, name }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex flex-col gap-1 lg:items-end">
      <button
        type="button"
        aria-disabled={pending}
        onClick={() => {
          if (pending) return
          startTransition(async () => {
            const res = await selectFranchisee(id)
            setFailed(!res.ok)
            if (res.ok) {
              window.dispatchEvent(new CustomEvent(OUTLET_SWITCHED, { detail: `Now showing ${name}` }))
              router.push('/')
            }
          })
        }}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line-strong bg-white px-4 text-[14px] font-semibold text-ink shadow-panel hover:border-ink-3 aria-disabled:opacity-60 max-lg:w-full"
      >
        {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
        Open {name}
      </button>
      {failed ? (
        <p role="alert" className="text-[13px] font-medium text-bad">Couldn’t open it. Please try again.</p>
      ) : null}
    </div>
  )
}
