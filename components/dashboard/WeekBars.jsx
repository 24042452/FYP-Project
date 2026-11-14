'use client'

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { formatSGD } from '@/lib/money'
import { useReducedMotion } from './use-reduced-motion'

const BEST = '#0B4DB8'
const OTHER = '#A8C3F0'

/**
 * Daily sales bars. The highest day is dark blue, the rest light blue.
 * @param {{series: {day: string, label: string, grossCents: number, isFuture?: boolean}[], bestIndex: number, ariaLabel: string}} props
 */
export function WeekBars({ series, bestIndex, ariaLabel }) {
  const reduced = useReducedMotion()
  const few = series.length <= 7
  const data = series.map((s) => ({
    ...s,
    dollars: s.grossCents / 100,
    tick: few ? s.label : String(Number(s.day.slice(8))),
  }))
  return (
    <div role="img" aria-label={ariaLabel} className="h-[220px] w-full">
      <div aria-hidden="true" className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 220 }}>
          <BarChart data={data} margin={{ top: 22, right: 4, left: 4, bottom: 0 }}>
            <XAxis
              dataKey="tick"
              tickLine={false}
              axisLine={{ stroke: '#CBD3DE' }}
              interval={few ? 0 : 'preserveStartEnd'}
              tick={{ fontSize: 13, fill: '#46536A' }}
            />
            <Tooltip
              cursor={{ fill: '#F5F7FA' }}
              formatter={(/** @type {number} */ v) => [formatSGD(Math.round(v * 100)), 'Sales']}
              labelFormatter={(_l, p) => p?.[0]?.payload?.day ?? ''}
            />
            <Bar dataKey="dollars" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={!reduced} animationDuration={500} animationEasing="ease-out">
              {data.map((d, i) => (
                <Cell key={d.day} fill={i === bestIndex ? BEST : OTHER} />
              ))}
              {few ? (
                <LabelList
                  dataKey="dollars"
                  position="top"
                  formatter={(/** @type {number} */ v) => (v > 0 ? `$${Math.round(v)}` : '')}
                  style={{ fontSize: 11, fill: '#5C6980' }}
                />
              ) : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
