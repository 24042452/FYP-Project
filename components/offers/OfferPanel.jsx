'use client'

import { useActionState, useEffect } from 'react'
import { Check, Info } from 'lucide-react'
import { takeUpOfferAction } from '@/app/(portal)/offers/actions'
import { takeUpLabel } from '@/lib/offers/view'
import { declineBtn, quietBtn } from '@/components/disputes/buttons'
import { OutletPicker, useOutletTicks } from '@/components/promotions/OutletPicker'
import { SidePanel } from '@/components/promotions/SidePanel'

/** @typedef {ReturnType<typeof import('@/lib/offers/view').buildOffersPage>['cards'][number]} OfferView */

/**
 * The form inside the panel, mounted afresh each time the panel opens so the ticks and any earlier answer
 * start clean.
 * @param {{card: OfferView, picker: boolean, onCancel: () => void, onTaken: (message: string) => void}} props
 */
function OfferForm({ card, picker, onCancel, onTaken }) {
  const [state, formAction, pending] = useActionState(takeUpOfferAction, null)
  const { ticked, setTicked } = useOutletTicks(card.choices)
  const none = picker && ticked.length === 0

  useEffect(() => {
    if (state?.ok) onTaken(state.message)
  }, [state, onTaken])

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      <input type="hidden" name="key" value={card.key} />
      <div className="flex flex-col gap-3 px-5 py-4">
        <p className="text-[15px] text-ink">{card.detail}</p>
        <p data-testid="offer-sample-note" className="flex gap-2.5 rounded-lg bg-nets-blue-soft px-3.5 py-3 text-[15px] text-info">
          <Info className="mt-0.5 size-4 flex-none" aria-hidden="true" />
          <span>{card.sampleNote}</span>
        </p>
        {picker ? (
          <OutletPicker choices={card.choices} ticked={ticked} onChange={setTicked} allLabel="Select all outlets that can take it" />
        ) : null}
        {state && !state.ok ? (
          <p role="alert" className="mt-1 text-[14px] font-medium text-bad">
            {state.message}
          </p>
        ) : null}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2.5 border-t border-line px-5 pt-4 pb-5">
        <button type="submit" disabled={pending || none} className={declineBtn}>
          <Check className="size-4" aria-hidden="true" />
          {pending ? 'Taking up…' : takeUpLabel(picker ? ticked.length : null)}
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
 * The Take up panel for an offer: what it is, how long, the sample-offer note and which outlets.
 * @param {{card: OfferView | null, open: boolean, openCount: number, picker: boolean,
 *   onOpenChange: (open: boolean) => void, onTaken: (message: string) => void}} props
 */
export function OfferPanel({ card, open, openCount, picker, onOpenChange, onTaken }) {
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      id={card?.key ?? ''}
      tag={card?.kindLabel ?? ''}
      title={card?.name ?? ''}
      description={card?.dates ?? ''}
    >
      {card ? <OfferForm key={`${card.key}-${openCount}`} card={card} picker={picker} onCancel={() => onOpenChange(false)} onTaken={onTaken} /> : null}
    </SidePanel>
  )
}
