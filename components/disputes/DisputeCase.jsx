'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, CheckCircle2, Clock, Info, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { Pill } from '@/components/dashboard/Pill'
import { useReducedMotion } from '@/components/dashboard/use-reduced-motion'
import { Track } from './Track'
import { DeclineForm } from './DeclineForm'
import { AcceptConfirm } from './AcceptConfirm'
import { FileLinks, PillIcon } from './FileLinks'
import { acceptBtn, declineBtn, quietBtn } from './buttons'

/**
 * One dispute as a case: what the customer said, where it stands (the 3-step track), what it means, and what
 * to do. Decline opens the form inside the case (it grows open; instant when the device asks for less
 * motion) and Accept asks to confirm in place. After either, the track moves on and a status line says what
 * happened.
 * @param {{d: import('@/lib/disputes/view').DisputeView, canRespond: boolean, onKeep: (id: string) => void}} props
 *   onKeep is called as soon as the person starts answering, so the case stays on screen when the saved
 *   dispute (no longer open) arrives together with the answer.
 */
export function DisputeCase({ d, canRespond, onKeep }) {
  const [mode, setMode] = useState(/** @type {'idle' | 'form' | 'confirm'} */ ('idle'))
  const [message, setMessage] = useState(/** @type {string | null} */ (null))
  const reduced = useReducedMotion()
  const headingRef = useRef(/** @type {HTMLHeadingElement | null} */ (null))
  const declineRef = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const backToButtons = useRef(false)

  const open = d.status === 'open'
  const answerable = open && canRespond
  // The form and the confirmation stay mounted until their answer is shown: the saved dispute (no longer open)
  // arrives in the same render as the action's result.
  const formShown = canRespond && (open || mode === 'form')

  useEffect(() => {
    if (mode === 'form' && headingRef.current) {
      headingRef.current.focus({ preventScroll: true })
      headingRef.current.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
    }
    if (mode === 'idle' && backToButtons.current) {
      backToButtons.current = false
      declineRef.current?.focus()
    }
  }, [mode, reduced])

  const cancel = useCallback(() => {
    backToButtons.current = true
    setMode('idle')
  }, [])
  const done = useCallback(
    (/** @type {string} */ msg) => {
      setMessage(msg)
      setMode('idle')
    },
    [],
  )

  const tile =
    d.status === 'open'
      ? { cls: 'bg-nets-red-soft text-bad', Icon: TriangleAlert }
      : d.status === 'waiting'
        ? { cls: 'bg-nets-blue-soft text-info', Icon: Clock }
        : { cls: 'bg-mute-bg text-ink-2', Icon: d.status === 'won' ? Check : RotateCcw }

  return (
    <article
      aria-labelledby={`case-${d.id}`}
      data-testid="dispute-case"
      data-status={d.status}
      className="grid grid-cols-1 gap-x-4 gap-y-1 border-t border-line p-4 first:border-t-0 sm:grid-cols-[40px_minmax(0,1fr)] sm:p-5"
    >
      <span aria-hidden="true" className={`hidden size-10 place-items-center rounded-[10px] sm:row-span-2 sm:grid ${tile.cls}`}>
        <tile.Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <h3 id={`case-${d.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[18px] leading-snug font-[650]">
          <span>{d.title}</span>
          <span className="tabular-nums">{d.amount}</span>
          <Pill tone={d.pill.tone}>
            <PillIcon icon={d.pill.icon} />
            {d.pill.text}
          </Pill>
        </h3>
        <p className="mt-1 text-[14px] text-ink-2">{d.meta}</p>
      </div>
      <div className="min-w-0 sm:col-start-2">
        <Track steps={d.steps} />

        {d.files.length > 0 && d.status === 'waiting' ? (
          <FileLinks files={d.files} label={d.filesSent ?? ''} className="mt-3" />
        ) : null}

        <p role="status" className={message ? 'mt-3 flex items-start gap-2 text-[15px] font-medium text-ok' : 'sr-only'}>
          {message ? <CheckCircle2 className="mt-0.5 size-4 flex-none" aria-hidden="true" /> : null}
          {message}
        </p>

        {d.hint ? (
          <p className="mt-3.5 flex gap-2.5 rounded-lg bg-nets-blue-soft px-3.5 py-3 text-[15px] text-info">
            <Info className="mt-0.5 size-4 flex-none" aria-hidden="true" />
            <span>{d.hint}</span>
          </p>
        ) : null}

        {open && mode === 'idle' ? (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {answerable ? (
              <>
                <button ref={declineRef} type="button" onClick={() => {
                    onKeep(d.id)
                    setMode('form')
                  }} className={declineBtn}>
                  <X className="size-4" aria-hidden="true" />
                  Decline
                </button>
                <button type="button" onClick={() => {
                    onKeep(d.id)
                    setMode('confirm')
                  }} className={acceptBtn}>
                  <Check className="size-4" aria-hidden="true" />
                  Accept and refund {d.amount}
                </button>
              </>
            ) : null}
            <Link href={d.paymentHref} scroll={false} className={quietBtn}>
              See the payment
            </Link>
          </div>
        ) : null}

        {canRespond && mode === 'confirm' ? (
          <AcceptConfirm disputeId={d.id} amount={d.amount} onCancel={cancel} onDone={done} />
        ) : null}

        {formShown ? (
          <div
            data-open={mode === 'form'}
            inert={mode !== 'form'}
            className={`grid transition-[grid-template-rows,opacity] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
              mode === 'form' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="-mx-1.5 min-h-0 overflow-hidden px-1.5 pb-1.5">
              <DeclineForm disputeId={d.id} reasons={d.reasons} headingRef={headingRef} onCancel={cancel} onDone={done} />
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}
