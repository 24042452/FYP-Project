'use client'

import { useState } from 'react'
import { acceptBtn } from '@/components/disputes/buttons'
import { ChannelTag } from './RunningCard'
import { FilterChips } from './FilterChips'

/** @typedef {ReturnType<typeof import('@/lib/promotions/view').buildPromotionsPage>['cards'][number]} CardView */

/**
 * "Promotions you can start": payment-type filter chips and a grid of cards (3 columns on desktop, 2 on
 * tablets, 1 on phones). Take up is white with a blue outline (like Accept on Refunds & disputes); when a
 * promotion cannot be taken up, a grey note says why instead. Notes sit above the button, so every Take up in a
 * row lines up on the card's bottom edge.
 * @param {{cards: CardView[], chips: {value: string, label: string}[], onTakeUp: (key: string) => void}} props
 */
export function PromotionCards({ cards, chips, onTakeUp }) {
  const [filter, setFilter] = useState('all')
  const shown = filter === 'all' ? cards : cards.filter((c) => c.channel === filter)

  return (
    <section aria-labelledby="start-h" className="flex min-w-0 flex-col gap-3">
      {/* Title left, filter chips right on wide screens (they wrap below it on phones). */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <h2 id="start-h" className="text-[17px] font-semibold">
          Promotions you can start
        </h2>
        {chips.length > 2 ? (
          <FilterChips chips={chips} value={filter} onChange={setFilter} label="Payment type" />
        ) : null}
      </div>
      <ul key={filter} className="fx-in m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => (
          <li
            key={c.key}
            data-testid="promotion-card"
            className="flex min-w-0 flex-col gap-2 rounded-[12px] border border-line bg-white px-4 py-4 shadow-panel sm:px-[18px]"
          >
            <ChannelTag>{c.channelLabel}</ChannelTag>
            <h3 className="text-[17px] leading-snug font-[650]">{c.name}</h3>
            <p className="text-[14px] text-ink-2">{c.when}</p>
            <div className="mt-auto flex flex-col gap-1.5 pt-1.5">
              {c.note ? <p className="text-[13px] text-ink-3">{c.note}</p> : null}
              {c.can ? (
                <button type="button" onClick={() => onTakeUp(c.key)} className={`${acceptBtn} sm:self-start`} aria-label={`Take up ${c.name}`}>
                  Take up
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
