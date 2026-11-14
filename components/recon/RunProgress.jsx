'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check } from 'lucide-react'
import { CHECKUP_STEPS, describeDuration, estimateFromStored, progressAt } from '@/lib/recon/progress'

export const DURATION_KEY = 'checkupDurationMs'
export const DURATION_EVENT = 'checkup:duration'

/** @returns {string | null} */
function readStored() {
  try {
    return window.localStorage.getItem(DURATION_KEY)
  } catch {
    return null
  }
}

/** @param {number} ms */
function storeDuration(ms) {
  try {
    window.localStorage.setItem(DURATION_KEY, String(Math.round(ms)))
  } catch {
    // Private windows can refuse storage; the bar just uses the default estimate next time.
  }
  window.dispatchEvent(new CustomEvent(DURATION_EVENT, { detail: Math.round(ms) }))
}

/**
 * Shows how far the check-up has got while its form is submitting. The check-up is one request, so the
 * bar is an estimate: it eases towards 90% using the last run's real time (6 seconds the first time)
 * and only the answer coming back fills it to 100%. Put it inside the form that runs the check-up.
 */
export function RunProgress() {
  const { pending } = useFormStatus()
  const [phase, setPhase] = useState(/** @type {'idle' | 'running' | 'done'} */ ('idle'))
  const [elapsed, setElapsed] = useState(0)
  const startedAt = useRef(0)
  const estimate = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    if (pending && phaseRef.current !== 'running') {
      startedAt.current = performance.now()
      estimate.current = estimateFromStored(readStored())
      setElapsed(0)
      setPhase('running')
    } else if (!pending && phaseRef.current === 'running') {
      storeDuration(performance.now() - startedAt.current)
      setPhase('done')
    }
  }, [pending])

  useEffect(() => {
    if (phase !== 'running') return
    const t = setInterval(() => setElapsed(performance.now() - startedAt.current), 250)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'done') return
    const t = setTimeout(() => setPhase('idle'), 1500)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === 'idle') return null

  const done = phase === 'done'
  const p = progressAt(elapsed, estimate.current)
  const percent = done ? 100 : Math.round(p.percent)
  const current = done ? CHECKUP_STEPS.length : p.stepIndex
  const timeText = done
    ? 'Done'
    : p.almostDone || p.secondsLeft < 1
      ? 'Almost done…'
      : `About ${p.secondsLeft} ${p.secondsLeft === 1 ? 'second' : 'seconds'} left`

  return (
    <div className="w-full rounded-[12px] border border-line bg-white p-4 shadow-panel" data-testid="checkup-progress">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-semibold text-ink" aria-live="polite">
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
        {CHECKUP_STEPS.map((label, i) => {
          const finished = i < current
          const active = i === current && !done
          return (
            <li
              key={label}
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
                {label}
                {finished ? <span className="sr-only"> (done)</span> : null}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/**
 * "Checked in 3 seconds" on the results card, from how long the last run really took in this browser.
 * Shows nothing when the browser has no stored time.
 */
export function CheckedIn() {
  const [text, setText] = useState('')
  useEffect(() => {
    const update = (/** @type {unknown} */ v) => {
      const n = Number(v)
      setText(Number.isFinite(n) && n > 0 ? describeDuration(n) : '')
    }
    update(readStored())
    const onEvent = (/** @type {Event} */ e) => update(/** @type {CustomEvent} */ (e).detail)
    window.addEventListener(DURATION_EVENT, onEvent)
    return () => window.removeEventListener(DURATION_EVENT, onEvent)
  }, [])
  return text ? <span data-testid="checked-in"> {text}.</span> : null
}
