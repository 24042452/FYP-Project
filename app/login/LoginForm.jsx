'use client'

import { useActionState, useState, useTransition } from 'react'
import { Building2, ChevronRight, Store } from 'lucide-react'
import { signIn, signInAsDemo } from './actions'

const inputClass =
  'min-h-12 w-full rounded-lg border border-line-strong bg-white px-3.5 text-base text-ink outline-none focus:border-nets-blue focus:ring-3 focus:ring-nets-blue-soft'

const DEMOS = [
  { profile: 'hawker', title: 'Try as Ah Hock Chicken Rice', sub: 'Hawker stall · 1 outlet · Owner', Icon: Store },
  { profile: 'retail', title: 'Try as Tan & Sons Retail', sub: '3 outlets incl. online shop · Accountant', Icon: Building2 },
]

/** @param {{demoMode: boolean}} props */
export function LoginForm({ demoMode }) {
  const [state, formAction, pending] = useActionState(signIn, null)
  const [demoError, setDemoError] = useState('')
  const [demoPending, startDemo] = useTransition()
  const busy = pending || demoPending
  const error = state?.error || demoError

  /** @param {'hawker' | 'retail'} profile */
  function tryDemo(profile) {
    setDemoError('')
    startDemo(async () => {
      const result = await signInAsDemo(profile) // redirects on success
      if (result?.error) setDemoError(result.error)
    })
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col gap-5">
      <form action={formAction} className="flex flex-col gap-5">
        <div>
          <h2 className="text-[26px] font-bold">Log in</h2>
          <p className="mt-1 text-ink-2">Use the email your business registered with NETS.</p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-bad-bg px-3.5 py-3 text-[15px] font-medium text-bad">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[15px] font-semibold">Email</label>
          <input
            id="email" name="email" type="email" autoComplete="email" required
            placeholder="you@yourbusiness.sg" className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-[15px] font-semibold">Password</label>
          <input
            id="password" name="password" type="password" autoComplete="current-password" required
            className={inputClass}
          />
        </div>

        <button
          type="submit" disabled={busy}
          className="min-h-12 rounded-lg bg-nets-red px-4 text-base font-semibold text-white hover:bg-nets-red-hover disabled:opacity-60"
        >
          {pending ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      {demoMode && (
        <>
          <div className="flex items-center gap-3 text-sm text-ink-3 before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            Just looking? Try a sample business
          </div>
          <div className="flex flex-col gap-2.5">
            {DEMOS.map(({ profile, title, sub, Icon }) => (
              <button
                key={profile} type="button" disabled={busy}
                onClick={() => tryDemo(/** @type {'hawker' | 'retail'} */ (profile))}
                className="grid min-h-16 grid-cols-[44px_1fr_20px] items-center gap-3.5 rounded-xl border border-line-strong bg-white px-4 py-3.5 text-left hover:border-nets-blue hover:ring-3 hover:ring-nets-blue-soft disabled:opacity-60"
              >
                <span className="grid size-11 place-items-center rounded-[10px] bg-nets-blue-soft text-nets-blue-hover">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <b className="block font-semibold">{title}</b>
                  <span className="text-sm text-ink-2">{sub}</span>
                </span>
                <ChevronRight className="size-5 text-ink-3" aria-hidden="true" />
              </button>
            ))}
          </div>
          <p className="text-center text-[13px] text-ink-3">
            Sample businesses use made-up data. Nothing you do there is real.
          </p>
        </>
      )}
    </div>
  )
}
