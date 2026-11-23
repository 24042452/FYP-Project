'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Check, Clock, Square, X } from 'lucide-react'
import { Pill } from '@/components/dashboard/Pill'
import { stopPromotionAction } from '@/app/(portal)/campaigns/actions'
import { declineBtn, quietBtn, secondaryBtn } from '@/components/disputes/buttons'

const PILL_ICONS = { clock: Clock, tick: Check, stop: Square }

/** A payment type with a small blue dot in front ("• NETS QR"). @param {{children: React.ReactNode}} props */
export function ChannelTag({ children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
      <i aria-hidden="true" className="inline-block size-2 rounded-full bg-nets-blue" />
      {children}
    </span>
  )
}

/**
 * The 4-week bar. It fills from empty to where the run is when it first shows (instant with reduced motion).
 * @param {{value: number, label: string}} props
 */
function WeekBar({ value, label }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  return (
    <div role="img" aria-label={label} className="h-2 overflow-hidden rounded-md bg-mute-bg">
      <i
        className="block h-full rounded-md bg-nets-blue transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        style={{ width: `${shown}%` }}
      />
    </div>
  )
}

/**
 * One promotion in "Running now": payment type, name, outlets, start, status pill, 4-week bar and Stop.
 * Stop asks in place first ("Stop this promotion? ..." with Yes, stop / Cancel).
 * @param {{
 *   r: ReturnType<typeof import('@/lib/promotions/view').buildPromotionsPage>['running'][number],
 *   className?: string, onStopped: (message: string) => void,
 * }} props
 */
export function RunningCard({ r, className = '', onStopped }) {
  const [confirming, setConfirming] = useState(false)
  // The answer is passed up from inside the action: once a promotion is stopped, the refreshed page no longer
  // lists it in Running now, so this card is gone before an effect could report it.
  const [state, formAction, pending] = useActionState(
    async (/** @type {Awaited<ReturnType<typeof stopPromotionAction>> | null} */ prev, /** @type {FormData} */ formData) => {
      const res = await stopPromotionAction(prev, formData)
      if (res.ok) onStopped(res.message)
      return res
    },
    null,
  )
  const questionRef = useRef(/** @type {HTMLParagraphElement | null} */ (null))
  const stopRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const back = useRef(false)
  const PillIcon = PILL_ICONS[r.pill.icon] ?? Clock

  useEffect(() => {
    if (confirming) questionRef.current?.focus()
    else if (back.current) {
      back.current = false
      stopRef.current?.focus()
    }
  }, [confirming])

  return (
    <article
      aria-labelledby={`run-${r.id}`}
      data-testid="running-card"
      className={`flex flex-col gap-2.5 rounded-[12px] border border-line bg-white px-4 py-4 shadow-panel sm:px-5 sm:py-[18px] ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <ChannelTag>{r.channel}</ChannelTag>
          <h3 id={`run-${r.id}`} className="mt-0.5 text-[17px] leading-snug font-[650]">
            {r.name}
          </h3>
          <p className="text-[14px] text-ink-2">
            {r.outlets} · {r.started}
          </p>
        </div>
        <Pill tone={r.pill.tone}>
          <PillIcon className="mr-1.5 -ml-0.5 size-3.5 flex-none stroke-[2.4]" aria-hidden="true" />
          {r.pill.text}
        </Pill>
      </div>
      <WeekBar value={r.progress} label={r.progressText.split(' · ')[0]} />
      {confirming ? (
        <form action={formAction} className="mt-1 flex flex-col gap-3 rounded-lg border border-line bg-page p-3.5 sm:p-4">
          <input type="hidden" name="runId" value={r.id} />
          <p ref={questionRef} tabIndex={-1} className="m-0 text-[15px] font-semibold outline-none">
            {r.scheduled ? "Stop this promotion? It won't start." : 'Stop this promotion? It ends today at all its outlets.'}
          </p>
          {state && !state.ok ? (
            <p role="alert" className="m-0 text-[14px] font-medium text-bad">
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2.5">
            <button type="submit" disabled={pending} className={declineBtn}>
              {pending ? 'Stopping…' : 'Yes, stop'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                back.current = true
                setConfirming(false)
              }}
              className={quietBtn}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-ink-3">{r.progressText}</span>
          {r.canStop ? (
            <button ref={stopRef} type="button" onClick={() => setConfirming(true)} className={secondaryBtn}>
              <X className="size-4" aria-hidden="true" />
              Stop
            </button>
          ) : r.stopNote ? (
            <span className="text-[13px] text-ink-3">{r.stopNote}</span>
          ) : null}
        </div>
      )}
    </article>
  )
}
