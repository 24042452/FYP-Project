'use client'

import { useState } from 'react'
import { CalendarDays, CheckCircle2 } from 'lucide-react'
import { acceptBtn } from '@/components/disputes/buttons'
import { ChannelTag } from '@/components/promotions/RunningCard'
import { FilterChips } from '@/components/promotions/FilterChips'

/** @typedef {ReturnType<typeof import('@/lib/offers/view').buildOffersPage>['cards'][number]} OfferView */

/** The grey "Sample offer" tag: these are not real NETS terms yet. */
export function SampleTag() {
  return (
    <span className="inline-flex items-center rounded-md border border-line-strong bg-page px-2 py-0.5 text-[12px] font-semibold text-ink-2">
      Sample offer
    </span>
  )
}

/**
 * "Offers for you": kind filter chips (All, Lower fees, Equipment, Partner deals) and a grid of cards (3
 * columns on desktop, 2 on tablets, 1 on phones). Take up is white with a blue outline; an offer already
 * active at every outlet says until when instead.
 * @param {{cards: OfferView[], chips: {value: string, label: string}[], onTakeUp: (key: string) => void}} props
 */
export function OfferCards({ cards, chips, onTakeUp }) {
  const [filter, setFilter] = useState('all')
  const shown = filter === 'all' ? cards : cards.filter((c) => c.kind === filter)

  return (
    <section aria-labelledby="for-you-h" className="flex min-w-0 flex-col gap-3">
      {/* Title left, filter chips right on wide screens (they wrap below it on phones). */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 id="for-you-h" className="text-[17px] font-semibold">
          Offers for you
        </h2>
        {chips.length > 2 ? <FilterChips chips={chips} value={filter} onChange={setFilter} label="Kind of offer" /> : null}
      </div>
      <ul key={filter} className="fx-in m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <li
            key={c.key}
            data-testid="offer-card"
            className="flex min-w-0 flex-col gap-2 rounded-[12px] border border-line bg-white px-4 py-4 shadow-panel sm:px-[18px]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ChannelTag>{c.kindLabel}</ChannelTag>
              {c.sample ? <SampleTag /> : null}
            </div>
            <h3 className="text-[17px] leading-snug font-[650]">{c.name}</h3>
            <p className="text-[14px] text-ink-2">{c.detail}</p>
            <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3">
              <CalendarDays className="size-3.5 flex-none" aria-hidden="true" />
              {c.length}
            </p>
            <div className="mt-auto flex flex-col gap-1.5 pt-1.5">
              {c.note ? <p className="text-[13px] text-ink-3">{c.note}</p> : null}
              {c.can ? (
                <button type="button" onClick={() => onTakeUp(c.key)} className={`${acceptBtn} sm:self-start`} aria-label={`Take up ${c.name}`}>
                  Take up
                </button>
              ) : null}
              {c.activeNote ? (
                <p data-testid="offer-active-note" className="flex items-start gap-1.5 text-[14px] font-semibold text-ok">
                  <CheckCircle2 className="mt-0.5 size-4 flex-none" aria-hidden="true" />
                  {c.activeNote}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
