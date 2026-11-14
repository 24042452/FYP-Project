'use client'

import { AnimatedMoney } from './AnimatedMoney'

/**
 * The answer first: one plain sentence about how business is. The first dollar amount is
 * picked out in blue. Amounts count up when they change.
 * @param {{greeting?: string, headline: string, subline: string}} props
 */
export function Headline({ greeting, headline, subline }) {
  const parts = headline.split(/(\$[\d,]+\.\d{2})/)
  let amounts = 0
  return (
    <div>
      {greeting ? <p className="mb-1 text-[15px] text-ink-2">{greeting}</p> : null}
      <h1 className="max-w-[34ch] text-[clamp(1.35rem,1.05rem+1.1vw,1.85rem)] leading-[1.3] font-semibold tracking-[-0.015em] text-balance">
        {parts.map((p, i) => {
          if (i % 2 === 0) return p
          amounts += 1
          return amounts === 1 ? (
            <em key={i} className="text-info not-italic">
              <AnimatedMoney text={p} />
            </em>
          ) : (
            <AnimatedMoney key={i} text={p} />
          )
        })}
      </h1>
      <p className="mt-2 text-base text-ink-2">{subline}</p>
    </div>
  )
}
