'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Info, Play, XIcon } from 'lucide-react'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { startPromotionAction } from '@/app/(portal)/campaigns/actions'
import { startLabel } from '@/lib/promotions/rules'
import { declineBtn, quietBtn } from '@/components/disputes/buttons'
import { ChannelTag } from './RunningCard'

/** @typedef {ReturnType<typeof import('@/lib/promotions/view').buildPromotionsPage>['cards'][number]} CardView */

/**
 * The form inside the panel. It is mounted afresh each time the panel opens, so the ticks and any earlier
 * answer start clean.
 * @param {{card: CardView, picker: boolean, onCancel: () => void, onStarted: (message: string) => void}} props
 */
function TakeUpForm({ card, picker, onCancel, onStarted }) {
  const [state, formAction, pending] = useActionState(startPromotionAction, null)
  const [ticked, setTicked] = useState(() => card.choices.filter((c) => c.ticked).map((c) => c.id))
  const free = card.choices.filter((c) => c.can).map((c) => c.id)
  const allTicked = free.length > 0 && free.every((id) => ticked.includes(id))
  const none = picker && ticked.length === 0

  useEffect(() => {
    if (state?.ok) onStarted(state.message)
  }, [state, onStarted])

  /** @param {string} id @param {boolean} on */
  const tick = (id, on) => setTicked((t) => (on ? [...new Set([...t, id])] : t.filter((x) => x !== id)))

  const row = 'flex min-h-11 items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[15px]'
  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <input type="hidden" name="key" value={card.key} />
      <div className="flex flex-col gap-2 px-5 py-4">
        <p className="flex gap-2.5 rounded-lg bg-nets-blue-soft px-3.5 py-3 text-[15px] text-info">
          <Info className="mt-0.5 size-4 flex-none" aria-hidden="true" />
          <span>{card.info}</span>
        </p>
        {picker ? (
          <fieldset className="mt-2 flex flex-col gap-2">
            <legend className="mb-2 text-base font-[650]">Which outlets?</legend>
            <label className={`${row} cursor-pointer border-line-strong font-semibold`}>
              <input
                type="checkbox"
                checked={allTicked}
                disabled={free.length === 0}
                onChange={(e) => setTicked(e.target.checked ? free : [])}
                className="mt-0.5 size-[18px] flex-none accent-nets-blue"
              />
              Select all outlets that can run it
            </label>
            {card.choices.map((c) => {
              const on = ticked.includes(c.id)
              return (
                <label
                  key={c.id}
                  data-testid="outlet-choice"
                  className={`${row} transition-colors duration-[140ms] motion-reduce:transition-none ${
                    !c.can
                      ? 'cursor-not-allowed border-line bg-page text-ink-2'
                      : on
                        ? 'cursor-pointer border-nets-blue bg-nets-blue-soft'
                        : 'cursor-pointer border-line-strong'
                  }`}
                >
                  <input
                    type="checkbox"
                    name="outletIds"
                    value={c.id}
                    checked={c.can && on}
                    disabled={!c.can}
                    onChange={(e) => tick(c.id, e.target.checked)}
                    className="mt-0.5 size-[18px] flex-none accent-nets-blue"
                  />
                  <span className="min-w-0">
                    {c.name}
                    {c.reason ? <small className="block text-[13px] text-ink-3">{c.reason}</small> : null}
                  </span>
                </label>
              )
            })}
          </fieldset>
        ) : null}
        {state && !state.ok ? (
          <p role="alert" className="mt-1 text-[14px] font-medium text-bad">
            {state.message}
          </p>
        ) : null}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2.5 border-t border-line px-5 pt-4 pb-5">
        <button type="submit" disabled={pending || none} className={declineBtn}>
          <Play className="size-4" aria-hidden="true" />
          {pending ? 'Starting…' : startLabel(picker ? ticked.length : null)}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={quietBtn}>
          Cancel
        </button>
        {none ? <p className="w-full text-[14px] text-ink-2">Pick at least one outlet.</p> : null}
      </div>
    </form>
  )
}

/**
 * The Take up panel: slides in from the right (like the payment panel on Refunds & disputes) with what the
 * promotion is, its dates, and which outlets. Clicking outside, Esc, × or Cancel closes it; the slide is off
 * with reduced motion. Focus goes to its heading when it opens.
 * @param {{card: CardView | null, open: boolean, openCount: number, picker: boolean,
 *   onOpenChange: (open: boolean) => void, onStarted: (message: string) => void}} props
 */
export function TakeUpPanel({ card, open, openCount, picker, onOpenChange, onStarted }) {
  const headingRef = useRef(/** @type {HTMLHeadingElement | null} */ (null))
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {card ? (
        <SheetContent
          side="right"
          showCloseButton={false}
          aria-describedby={`takeup-when-${card.key}`}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            headingRef.current?.focus()
          }}
          className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md data-[side=right]:data-open:slide-in-from-right-full data-[side=right]:data-closed:slide-out-to-right-full data-open:duration-300 data-closed:duration-300 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
        >
          <SheetHeader className="gap-1 border-b border-line p-5 pr-16">
            <ChannelTag>{card.channelLabel}</ChannelTag>
            <SheetTitle ref={headingRef} tabIndex={-1} className="text-[18px] leading-snug font-[650] text-ink outline-none">
              {card.name}
            </SheetTitle>
            <SheetDescription id={`takeup-when-${card.key}`} className="text-[14px] text-ink-2">
              {card.dates}
            </SheetDescription>
          </SheetHeader>
          <SheetClose
            aria-label="Close"
            className="absolute top-3 right-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-ink-2 hover:bg-nets-blue-soft hover:text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-nets-blue"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </SheetClose>
          <TakeUpForm key={`${card.key}-${openCount}`} card={card} picker={picker} onCancel={() => onOpenChange(false)} onStarted={onStarted} />
        </SheetContent>
      ) : null}
    </Sheet>
  )
}
