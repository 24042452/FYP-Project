'use client'

import { useFormStatus } from 'react-dom'

/**
 * Red main action; shows "Checking..." while the check-up runs.
 * @param {{children: React.ReactNode}} props
 */
export function RunButton({ children }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-nets-red px-5 text-[15px] font-semibold text-white hover:bg-nets-red-hover disabled:opacity-60"
    >
      {pending ? 'Checking…' : children}
    </button>
  )
}
