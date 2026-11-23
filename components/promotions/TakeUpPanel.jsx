'use client'

import { useActionState, useEffect } from 'react'
import { Info, Play } from 'lucide-react'
import { startPromotionAction } from '@/app/(portal)/campaigns/actions'
import { startLabel } from '@/lib/promotions/rules'
import { declineBtn, quietBtn } from '@/components/disputes/buttons'
import { OutletPicker, useOutletTicks } from './OutletPicker'
import { SidePanel } from './SidePanel'

/** @typedef {ReturnType<typeof import('@/lib/promotions/view').buildPromotionsPage>['cards'][number]} CardView */

/**
 * The form inside the panel. It is mounted afresh each time the panel opens, so the ticks and any earlier
 * answer start clean.
 * @param {{card: CardView, picker: boolean, onCancel: () => void, onStarted: (message: string) => void}} props
 */
function TakeUpForm({ card, picker, onCancel, onStarted }) {
  const [state, formAction, pending] = useActionState(startPromotionAction, null)
  const { ticked, setTicked } = useOutletTicks(card.choices)
  const none = picker && ticked.length === 0

  useEffect(() => {
    if (state?.ok) onStarted(state.message)
  }, [state, onStarted])

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <input type="hidden" name="key" value={card.key} />
      <div className="flex flex-col gap-2 px-5 py-4">
        <p className="flex gap-2.5 rounded-lg bg-nets-blue-soft px-3.5 py-3 text-[15px] text-info">
          <Info className="mt-0.5 size-4 flex-none" aria-hidden="true" />
          <span>{card.info}</span>
        </p>
        {picker ? (
          <OutletPicker choices={card.choices} ticked={ticked} onChange={setTicked} allLabel="Select all outlets that can run it" />
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
 * The Take up panel: what the promotion is, its dates, and which outlets (see SidePanel for how it opens
 * and closes).
 * @param {{card: CardView | null, open: boolean, openCount: number, picker: boolean,
 *   onOpenChange: (open: boolean) => void, onStarted: (message: string) => void}} props
 */
export function TakeUpPanel({ card, open, openCount, picker, onOpenChange, onStarted }) {
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      id={card?.key ?? ''}
      tag={card?.channelLabel ?? ''}
      title={card?.name ?? ''}
      description={card?.dates ?? ''}
    >
      {card ? (
        <TakeUpForm key={`${card.key}-${openCount}`} card={card} picker={picker} onCancel={() => onOpenChange(false)} onStarted={onStarted} />
      ) : null}
    </SidePanel>
  )
}
