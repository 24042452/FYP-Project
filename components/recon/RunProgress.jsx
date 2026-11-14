'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { runReconciliation } from '@/app/(portal)/reconciliation/actions'
import { CHECKUP_STEPS, canFinish, describeDuration, estimateFromStored, progressAt } from '@/lib/recon/progress'

const DURATION_KEY = 'checkupDurationMs'
const DONE_SHOW_MS = 600

/** Where a finished run's duration is kept for the results card (this tab only). @param {string} runId */
const runKey = (runId) => `checkup:${runId}`

/** @returns {string | null} */
function readEstimate() {
  try {
    return window.localStorage.getItem(DURATION_KEY)
  } catch {
    return null
  }
}

/**
 * @param {string} runId
 * @param {number} durationMs the real time the server took
 */
function rememberRun(runId, durationMs) {
  const ms = String(Math.round(durationMs))
  try {
    window.localStorage.setItem(DURATION_KEY, ms) // next run's estimate: the real time, not the padded display time
  } catch {
    // Private windows can refuse storage; the bar just uses the default estimate next time.
  }
  try {
    window.sessionStorage.setItem(runKey(runId), ms)
  } catch {
    // Then the results card simply does not say how long it took.
  }
}

/**
 * The "Run check-up" form with its progress panel. The check-up is one request, so the bar is an estimate:
 * it eases towards 90% (using the last run's real time, 6 seconds the first time) and fills to 100% only
 * when the answer is back AND the panel has been showing for 2.5 seconds. Then "Done", then the result opens.
 * @param {{month: string, label: string}} props
 */
export function RunCheckup({ month, label }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(runReconciliation, null)
  const [phase, setPhase] = useState(/** @type {'idle' | 'running' | 'done'} */ ('idle'))
  const [elapsed, setElapsed] = useState(0)
  const [message, setMessage] = useState('')
  const startedAt = useRef(0)
  const estimate = useRef(0)
  const result = useRef(/** @type {typeof state} */ (null))
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  // Start when the form is sent.
  useEffect(() => {
    if (pending && phaseRef.current !== 'running') {
      startedAt.current = performance.now()
      estimate.current = estimateFromStored(readEstimate())
      result.current = null
      setElapsed(0)
      setMessage('')
      setPhase('running')
    }
  }, [pending])

  // The answer came back.
  useEffect(() => {
    if (!state || phaseRef.current !== 'running') return
    if (state.ok) {
      rememberRun(state.runId, state.durationMs)
      result.current = state
    } else {
      setMessage(state.message)
      setPhase('idle')
    }
  }, [state])

  // Tick the bar; finish only when allowed.
  useEffect(() => {
    if (phase !== 'running') return
    const t = setInterval(() => {
      const e = performance.now() - startedAt.current
      setElapsed(e)
      if (canFinish(e, result.current !== null)) setPhase('done')
    }, 100)
    return () => clearInterval(t)
  }, [phase])

  // Show "Done" briefly, then open the result.
  useEffect(() => {
    if (phase !== 'done') return
    const r = result.current
    const t = setTimeout(() => {
      setPhase('idle')
      if (r && r.ok) router.push(`/reconciliation?month=${r.month}&run=${r.runId}`)
    }, DONE_SHOW_MS)
    return () => clearTimeout(t)
  }, [phase, router])

  const busy = phase !== 'idle' || pending
  const done = phase === 'done'
  const p = progressAt(elapsed, estimate.current)
  const percent = done ? 100 : Math.round(p.percent)
  const current = done ? CHECKUP_STEPS.length : p.stepIndex
  const timeText = done
    ? 'Done ✓'
    : p.almostDone || p.secondsLeft < 1
      ? 'Almost done…'
      : `About ${p.secondsLeft} ${p.secondsLeft === 1 ? 'second' : 'seconds'} left`

  return (
    <form action={formAction} className="flex w-full flex-col gap-3 sm:w-[26rem] sm:items-end sm:pt-[26px]">
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-nets-red px-5 text-[15px] font-semibold text-white hover:bg-nets-red-hover disabled:opacity-60"
      >
        {busy ? 'Checking…' : label}
      </button>

      {message ? (
        <p role="alert" className="w-full rounded-lg bg-bad-bg px-4 py-3 text-[15px] font-medium text-bad">
          {message}
        </p>
      ) : null}

      {phase !== 'idle' ? (
        <div className="w-full rounded-[12px] border border-line bg-white p-4 shadow-panel" data-testid="checkup-progress">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-semibold text-ink" aria-live="polite" data-testid="checkup-step">
              {done ? 'Your check-up is ready' : `${CHECKUP_STEPS[current]}…`}
            </p>
            <p className="text-[14px] font-semibold text-nets-blue-hover tabular-nums">{percent}%</p>
          </div>
          <div
            role="progressbar"
            aria-label="Check-up progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={`${percent} percent. ${timeText}`}
            className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-mute-bg"
          >
            <div
              className="h-full rounded-full bg-nets-blue transition-[width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-2 text-[14px] text-ink-2">{timeText}</p>
          <ol className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0">
            {CHECKUP_STEPS.map((step, i) => {
              const finished = i < current
              const active = i === current && !done
              return (
                <li
                  key={step}
                  aria-current={active ? 'step' : undefined}
                  className={'flex items-start gap-2 text-[14px] ' + (finished ? 'text-ink' : active ? 'font-semibold text-ink' : 'text-ink-3')}
                >
                  <span
                    aria-hidden="true"
                    className={
                      'mt-0.5 grid size-4 flex-none place-items-center rounded-full ' +
                      (finished ? 'bg-ok text-white' : active ? 'border-2 border-nets-blue' : 'border border-line-strong')
                    }
                  >
                    {finished ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span>
                    {step}
                    {finished ? <span className="sr-only"> (done)</span> : null}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}
    </form>
  )
}

/**
 * "Checked in 3 seconds" on the results card, only for a run that was started in this tab (its time is kept
 * in sessionStorage under the run's id). Any other run, reload in another browser, or old run shows nothing.
 * @param {{runId: string}} props
 */
export function CheckedIn({ runId }) {
  const [text, setText] = useState('')
  useEffect(() => {
    let raw = null
    try {
      raw = window.sessionStorage.getItem(runKey(runId))
    } catch {
      // storage blocked: show nothing
    }
    const n = raw === null ? NaN : Number(raw)
    setText(Number.isFinite(n) && n >= 0 ? describeDuration(n) : '')
  }, [runId])
  return text ? <span data-testid="checked-in"> {text}.</span> : null
}
