import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentMerchant } from '@/lib/data/merchant'
import { getSelectedOutlet } from '@/lib/outlets/server'
import { getDailySales, getHeatmap, getOutletSales } from '@/lib/data/sales'
import { sgtDate } from '@/lib/dates'
import { RANGES, buildInsightsModel, insightDates, parseRange } from '@/lib/insights/model'
import { InsightBars } from '@/components/insights/InsightBars'
import { ChannelBars } from '@/components/dashboard/ChannelBars'
import { SwitchFx } from '@/components/dashboard/SwitchFx'
import { Panel, EmptyState } from '@/components/dashboard/Panel'

const FINDING_COLS = { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' }

export const metadata = { title: 'Insights · Merchant Portal' }

/** @param {{say: string}} props */
const Say = ({ say }) => (say ? <p className="m-0 mb-1 text-[15px] text-ink-2">{say}</p> : null)

export default async function InsightsPage({ searchParams }) {
  // The merchant comes only from the session, never from the address.
  const merchant = await getCurrentMerchant()
  if (merchant.tier === 'hq' && !merchant.chosen) redirect('/group')
  const sp = await searchParams
  const range = parseRange(Array.isArray(sp?.range) ? sp.range[0] : sp?.range)
  const { selected } = await getSelectedOutlet(merchant)
  const outletId = selected?.id ?? null

  const today = sgtDate(new Date().toISOString())
  const d = insightDates(range, today)
  const [rows, heat, outlets] = await Promise.all([
    getDailySales(merchant.id, d.loadFrom, today, outletId),
    getHeatmap(merchant.id, d.from, d.to, outletId),
    outletId ? Promise.resolve([]) : getOutletSales(merchant.id, d.from, d.to),
  ])
  const m = buildInsightsModel({ range, today, rows, heat, outlets })

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-bold">Insights</h1>
          <p className="mt-1 text-[14px] text-ink-3">
            Analytics · patterns in your sales{selected ? ` at ${selected.name}` : ''}, {m.dates}
          </p>
        </div>
        <nav aria-label="Time range" className="inline-flex rounded-lg border border-line-strong bg-white p-0.5 shadow-panel">
          {Object.entries(RANGES).map(([key, r]) => (
            <Link
              key={key}
              href={key === '3m' ? '/insights' : `/insights?range=${key}`}
              aria-current={key === range ? 'true' : undefined}
              className={`inline-flex min-h-11 items-center rounded-md px-3 text-[15px] font-semibold no-underline sm:px-4 ${
                key === range ? 'bg-nets-blue-soft text-info' : 'text-ink-2 hover:bg-page'
              }`}
            >
              <span className="sm:hidden">{r.label.replace('Last ', '')}</span>
              <span className="hidden sm:inline">{r.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {!m.hasData ? (
        <Panel title="Not enough sales yet">
          <EmptyState>Once you have a few weeks of sales, we&apos;ll show your best days, busiest hours and more here.</EmptyState>
        </Panel>
      ) : (
        <SwitchFx fxKey={`${range}|${outletId ?? 'all'}`} variant="panels" className="flex flex-col gap-5 sm:gap-6">
          <section aria-label="What we noticed" className={`grid gap-3 ${FINDING_COLS[m.findings.length] ?? 'md:grid-cols-3'}`} data-testid="insight-findings">
            {m.findings.map((f, i) => (
              <div
                key={f.title}
                style={{ animationDelay: `${i * 90}ms` }}
                className={`insight-in rounded-[10px] border border-line border-l-4 bg-white px-4 py-3 shadow-panel ${f.tone === 'tip' ? 'border-l-warn' : 'border-l-nets-blue'}`}
              >
                <p className="m-0 text-[15px] font-semibold">
                  {f.tone === 'tip' ? <span className="sr-only">Idea: </span> : null}
                  {f.title}
                </p>
                <p className="m-0 mt-1 text-[14px] text-ink-2">{f.text}</p>
              </div>
            ))}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Sales by month" tech="Revenue trend, last 6 months">
              <Say say={m.trend.say} />
              <InsightBars bars={m.trend.bars} ariaLabel="Sales by month" testId="chart-months" />
              <p className="m-0 mt-2 text-[13px] text-ink-3">{m.trend.note}</p>
            </Panel>
            <Panel title="Best days" tech="Average sales per weekday">
              <Say say={m.days.say} />
              <InsightBars bars={m.days.bars} ariaLabel="Average sales per weekday" testId="chart-days" />
            </Panel>
            <Panel title="Busiest hours" tech="Sales by hour">
              <Say say={m.hours.say} />
              <InsightBars bars={m.hours.bars} ariaLabel="Share of sales by hour" testId="chart-hours" />
              <p className="m-0 mt-2 text-[13px] text-ink-3">Darker bars: your busiest times.</p>
            </Panel>
            <Panel title="How customers pay" tech="Payment mix">
              <div className="mb-4"><Say say={m.mix.say} /></div>
              <ChannelBars mix={m.mix.rows} />
            </Panel>
          </div>

          {m.outlets.rows.length > 0 ? (
            <Panel title="Sales by outlet" tech="Outlet comparison">
              <div className="mb-4"><Say say={m.outlets.say} /></div>
              <ul className="m-0 flex list-none flex-col gap-3.5 p-0" data-testid="outlet-bars">
                {m.outlets.rows.map((o) => (
                  <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_3.2em] items-center gap-x-3 gap-y-1.5 text-[15px] sm:grid-cols-[14em_minmax(0,1fr)_7em_3.2em]">
                    <span className="truncate">{o.name}</span>
                    <span className="col-span-2 row-start-2 h-2 overflow-hidden rounded-full bg-mute-bg sm:col-span-1 sm:row-start-1 sm:col-start-2" aria-hidden="true">
                      <i className="block h-full rounded-full bg-nets-blue" style={{ width: `${o.pct}%` }} />
                    </span>
                    <span className="hidden text-right text-ink-2 tabular-nums sm:inline">{o.amount}</span>
                    <span className="text-right text-ink-2 tabular-nums">{o.pct}%</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </SwitchFx>
      )}
    </div>
  )
}
