'use client'

import { useCallback, useRef, useState } from 'react'
import { Check, CheckCircle2, Clock } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/Panel'
import { Pill } from '@/components/dashboard/Pill'
import { ChannelTag } from '@/components/promotions/RunningCard'
import { OfferCards } from './OfferCards'
import { OfferPanel } from './OfferPanel'

/** @typedef {ReturnType<typeof import('@/lib/offers/view').buildOffersPage>} PageView */

const PILL_ICONS = { clock: Clock, tick: Check }

/** One offer in "Your offers": kind, name, outlets, when it was taken up and an "Active until" pill. */
function YourOffer({ y, className = '' }) {
  const PillIcon = PILL_ICONS[/** @type {keyof typeof PILL_ICONS} */ (y.pill.icon)] ?? Check
  return (
    <article
      aria-labelledby={`offer-${y.id}`}
      data-testid="your-offer"
      className={`flex flex-wrap items-start justify-between gap-3 rounded-[12px] border border-line bg-white px-4 py-4 shadow-panel sm:px-5 sm:py-[18px] ${className}`}
    >
      <div className="min-w-0">
        <ChannelTag>{y.kindLabel}</ChannelTag>
        <h3 id={`offer-${y.id}`} className="mt-0.5 text-[17px] leading-snug font-[650]">
          {y.name}
        </h3>
        <p className="text-[14px] text-ink-2">
          {y.outlets} · {y.taken}
        </p>
      </div>
      <Pill tone={y.pill.tone}>
        <PillIcon className="mr-1.5 -ml-0.5 size-3.5 flex-none stroke-[2.4]" aria-hidden="true" />
        {y.pill.text}
      </Pill>
    </article>
  )
}

/**
 * "Your offers" and "Offers for you", with the Take up panel. After taking up, the panel closes, the offer
 * slides into Your offers and a status line says until when it is active.
 * @param {{yours: PageView['yours'], cards: PageView['cards'], chips: PageView['chips'], picker: boolean}} props
 */
export function OffersBoard({ yours, cards, chips, picker }) {
  const [message, setMessage] = useState(/** @type {string | null} */ (null))
  const [panelKey, setPanelKey] = useState(/** @type {string | null} */ (null))
  const [open, setOpen] = useState(false)
  const [openCount, setOpenCount] = useState(0)
  const statusRef = useRef(/** @type {HTMLParagraphElement | null} */ (null))
  // Offers on screen when the page first showed; any other is new (just taken up) and slides in.
  const firstIds = useRef(new Set(yours.map((y) => y.id)))

  const card = cards.find((c) => c.key === panelKey) ?? null

  const onTaken = useCallback((/** @type {string} */ msg) => {
    setOpen(false)
    setMessage(msg)
    requestAnimationFrame(() => statusRef.current?.focus({ preventScroll: true }))
  }, [])

  return (
    <>
      <section aria-labelledby="yours-h" className="flex min-w-0 flex-col gap-3">
        <h2 id="yours-h" className="text-[17px] font-semibold">
          Your offers
        </h2>
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          data-testid="offers-status"
          className={message ? 'flex items-start gap-2 text-[15px] font-medium text-ok outline-none' : 'sr-only'}
        >
          {message ? <CheckCircle2 className="mt-0.5 size-4 flex-none" aria-hidden="true" /> : null}
          {message}
        </p>
        {yours.length === 0 ? (
          <EmptyState>No offers taken up yet. Pick one below.</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {yours.map((y) => (
              <YourOffer key={y.id} y={y} className={firstIds.current.has(y.id) ? '' : 'promo-in'} />
            ))}
          </div>
        )}
      </section>

      <OfferCards
        cards={cards}
        chips={chips}
        onTakeUp={(key) => {
          setPanelKey(key)
          setOpenCount((n) => n + 1)
          setOpen(true)
        }}
      />

      <OfferPanel card={card} open={open} openCount={openCount} picker={picker} onOpenChange={setOpen} onTaken={onTaken} />
    </>
  )
}
