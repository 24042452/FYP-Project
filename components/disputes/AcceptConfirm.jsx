'use client'

import { useActionState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { acceptDispute } from '@/app/(portal)/disputes/actions'
import { acceptBtn, quietBtn } from './buttons'

/**
 * The inline "are you sure" before accepting a dispute: accepting refunds the customer and cannot be undone.
 * @param {{disputeId: string, amount: string, onCancel: () => void, onDone: (message: string) => void}} props
 */
export function AcceptConfirm({ disputeId, amount, onCancel, onDone }) {
  const [state, formAction, pending] = useActionState(acceptDispute, null)
  const questionRef = useRef(/** @type {HTMLParagraphElement | null} */ (null))

  useEffect(() => {
    questionRef.current?.focus()
  }, [])
  useEffect(() => {
    if (state?.ok) onDone(state.message)
  }, [state, onDone])

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-page p-3.5 sm:p-4">
      <input type="hidden" name="disputeId" value={disputeId} />
      <p ref={questionRef} tabIndex={-1} className="m-0 text-[15px] font-semibold outline-none">
        Accept and refund {amount} to the customer? You can&apos;t undo this.
      </p>
      {state && !state.ok && state.message ? (
        <p role="alert" className="m-0 text-[14px] font-medium text-bad">
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" disabled={pending} className={acceptBtn}>
          <Check className="size-4" aria-hidden="true" />
          {pending ? 'Accepting…' : 'Yes, accept'}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={quietBtn}>
          Cancel
        </button>
      </div>
    </form>
  )
}
