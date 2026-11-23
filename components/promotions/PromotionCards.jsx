'use client'

import { useState } from 'react'
import { acceptBtn } from '@/components/disputes/buttons'
import { ChannelTag } from './RunningCard'

/** @typedef {ReturnType<typeof import('@/lib/promotions/view').buildPromotionsPage>['cards'][number]} CardView */

/**
 * "Promotions you can start": payment-type filter chips and a grid of cards (3 columns on desktop, 2 on
 * tablets, 1 on phones). Take up is white with a blue outline (like Accept on Refunds & disputes); when a
 * promotion cannot be taken up, a grey note says why instead.
 * @param {{cards: CardView[], chips: {value: string, label: string}[], onTakeUp: (key: string) => void}} props
 */
export function PromotionCards({ cards, chips, onTakeUp }) {
  const [filter, setFilter] = useState('all')
  const shown = filter === 'all' ? cards : cards.filter((c) => c.channel === filter)

  return (
    <section aria-labelledby="start-h" className="flex min-w-0 flex-col gap-3">
      <h2 id="start-h" className="text-[17px] font-semibold">
        Promotions you can start
      </h2>
      {chips.length > 2 ? (
        <div role="group" aria-label="Payment type" className="flex flex-wrap gap-2">
          {chips.map((c) => {
            const on = filter === c.value
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(c.value)}
                className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3.5 text-[14px] font-semibold transition-colors duration-[140ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-nets-blue ${
                  on ? 'border-nets-blue bg-nets-blue-soft text-info' : 'border-line-strong bg-white text-ink-2 hover:border-ink-3'
                }`}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      ) : null}
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
              {c.can ? (
                <button type="button" onClick={() => onTakeUp(c.key)} className={`${acceptBtn} sm:self-start`} aria-label={`Take up ${c.name}`}>
                  Take up
                </button>
              ) : null}
              {c.note ? <p className="text-[13px] text-ink-3">{c.note}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
