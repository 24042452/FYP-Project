'use client'

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useReducedMotion } from '@/components/dashboard/use-reduced-motion'

const STRONG = '#0B4DB8'
const LIGHT = '#A8C3F0'

/**
 * One-measure bar chart for Insights. Highlighted bars are dark blue, the rest light blue; a part-finished
 * period is striped. Hover (or tap) shows the bar's sentence. Bars grow in, unless the device asks for less
 * motion. Screen readers get the same sentences as a list.
 * @param {{
 *   bars: {key: string, label: string, grossCents: number, highlight?: boolean, partial?: boolean, top?: string, value: string}[],
 *   ariaLabel: string, height?: number, testId?: string,
 * }} props
 */
export function InsightBars({ bars, ariaLabel, height = 200, testId }) {
  const reduced = useReducedMotion()
  const many = bars.length > 8
  const data = bars.map((b) => ({ ...b, dollars: b.grossCents / 100 }))
  const patternId = `stripe-${testId ?? 'bars'}`
  return (
    <div data-testid={testId}>
      <div aria-hidden="true" style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height }}>
          <BarChart data={data} margin={{ top: 22, right: 2, left: 2, bottom: 0 }} barCategoryGap={many ? 2 : '18%'}>
            <defs>
              <pattern id={patternId} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="7" height="7" fill="#FFFFFF" />
                <rect width="4" height="7" fill={LIGHT} />
              </pattern>
            </defs>
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: '#CBD3DE' }}
              interval={many ? 'preserveStartEnd' : 0}
              minTickGap={2}
              tick={{ fontSize: 12, fill: '#46536A' }}
            />
            <Tooltip
              cursor={{ fill: '#F5F7FA' }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <div className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] font-medium text-ink shadow-panel">{payload[0].payload.value}</div>
                ) : null
              }
            />
            <Bar dataKey="dollars" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={!reduced} animationDuration={600} animationEasing="ease-out">
              {data.map((d) => (
                <Cell key={d.key} fill={d.partial ? `url(#${patternId})` : d.highlight ? STRONG : LIGHT} stroke={d.partial ? LIGHT : undefined} />
              ))}
              <LabelList dataKey="top" position="top" style={{ fontSize: 11, fill: '#46536A', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only" aria-label={ariaLabel}>
        {bars.map((b) => (
          <li key={b.key}>{b.value}</li>
        ))}
      </ul>
    </div>
  )
}
