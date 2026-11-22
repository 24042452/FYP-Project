'use client'

import { useEffect, useState } from 'react'
import { AnimatedMoney } from './AnimatedMoney'
import { useReducedMotion } from './use-reduced-motion'

const TONE = {
  ok: 'bg-ok-bg text-ok',
  bad: 'bg-bad-bg text-bad',
  mute: 'bg-mute-bg text-ink-2',
}
const ARROW = { up: '▲', down: '▼', flat: '' }
const WORD = { up: 'up', down: 'down', flat: 'no change,' }

/**
 * "This week in numbers": four key numbers with their change (left), and what drove the change in sales, by
 * payment type (right; stacked on phones). The bars grow from the centre line when the panel appears or the
 * numbers change; with reduced motion they are drawn at once.
 * @param {{model: ReturnType<typeof import('@/lib/dashboard/numbers-model').buildNumbersModel>}} props
 */
export function NumbersPanel({ model }) {
  const reduced = useReducedMotion()
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const show = grown || reduced

  return (
    <section aria-labelledby="numbers-title" data-testid="numbers-panel" className="min-w-0 rounded-[12px] border border-line bg-white shadow-panel">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 pt-4 sm:px-5 sm:pt-[18px]">
        <h2 id="numbers-title" className="text-[17px] font-semibold">{model.title}</h2>
        <span className="text-[13px] text-ink-3">{model.compared}</span>
      </div>

      <div className="mt-3 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <dl className="m-0 grid grid-cols-2">
          {model.tiles.map((t, i) => (
            <div
              key={t.label}
              className={
                'flex flex-col gap-1 border-line px-4 py-3.5 sm:px-5 ' +
                (i % 2 === 0 ? 'border-r ' : '') +
                (i >= 2 ? 'border-t ' : 'border-t lg:border-t-0 ')
              }
            >
              <dt className="text-[14px] font-medium text-ink-2">{t.label}</dt>
              <dd className="m-0 text-[24px] leading-[1.15] font-semibold tracking-[-0.02em] tabular-nums sm:text-[26px]">
                <AnimatedMoney text={t.value} />
              </dd>
              <dd className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
                {t.change ? (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-[2px] text-[13px] font-semibold whitespace-nowrap ${TONE[t.tone]}`}>
                    <span aria-hidden="true">{ARROW[t.direction]}</span>
                    <span className="sr-only">{WORD[t.direction]}</span>
                    {t.change}
                  </span>
                ) : null}
                <span className="text-[13px] text-ink-3">{t.was}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="border-t border-line px-4 py-4 sm:px-5 lg:border-t-0 lg:border-l">
          <p className="m-0 text-[15px] leading-snug" data-testid="numbers-summary">{model.summary}</p>
          {model.drivers.length > 0 ? (
            <ul className="m-0 mt-3 list-none p-0" aria-label="Change in sales by payment type">
              {model.drivers.map((d) => (
                <li key={d.channel} className="grid grid-cols-[6.2em_minmax(0,1fr)_5.6em] items-center gap-3 border-t border-line py-2 text-[14px] first:border-t-0 sm:grid-cols-[8em_minmax(0,1fr)_6.5em]">
                  <span>{d.label}</span>
                  <span className="relative h-3" aria-hidden="true">
                    <span className="absolute inset-y-[-4px] left-1/2 w-px bg-line-strong" />
                    <i
                      className={
                        'absolute top-0 h-3 rounded-[3px] transition-[width] duration-700 ease-out motion-reduce:transition-none ' +
                        (d.tone === 'ok' ? 'left-1/2 bg-ok' : 'right-1/2 bg-bad')
                      }
                      style={{ width: show ? `${d.size / 2}%` : '0%' }}
                    />
                  </span>
                  <span className="text-right tabular-nums">
                    {d.delta}
                    <span className="block text-[12px] text-ink-3">{d.pct}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  )
}
