import Link from 'next/link'
import { getCurrentMerchant } from '@/lib/data/merchant'
import { getDailySales, getFeeTotals, getHeatmap } from '@/lib/data/sales'
import { getRecentSettlements, getSettlementSummary } from '@/lib/data/settlements'
import { getLatestRunSummary } from '@/lib/data/recon'
import { addDays, periodRange, sgtDate, sgtHour } from '@/lib/dates'
import { buildHomeModel, chartRange, parsePeriod } from '@/lib/dashboard/home-model'
import { Headline } from '@/components/dashboard/Headline'
import { PeriodSwitcher } from '@/components/dashboard/PeriodSwitcher'
import { Pill } from '@/components/dashboard/Pill'
import { StatTile } from '@/components/dashboard/StatTile'
import { MoneyFlow } from '@/components/dashboard/MoneyFlow'
import { WeekBars } from '@/components/dashboard/WeekBars'
import { ChannelBars } from '@/components/dashboard/ChannelBars'
import { SettlementList } from '@/components/dashboard/SettlementList'
import { AttentionList } from '@/components/dashboard/AttentionList'
import { CheckupCard } from '@/components/dashboard/CheckupCard'
import { Panel, EmptyState } from '@/components/dashboard/Panel'

export const metadata = { title: 'Home · Merchant Portal' }

const btnBase =
  'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-[15px] font-semibold no-underline max-sm:w-full'

export default async function HomePage({ searchParams }) {
  const merchant = await getCurrentMerchant()
  const sp = await searchParams
  const kind = parsePeriod(sp?.period)

  const now = new Date().toISOString()
  const today = sgtDate(now)
  const range = periodRange(kind, today)
  const chart = chartRange(kind, today)

  const [currRows, prevRows, todayRows, chartRows, heat, fees, settlements, settlementSummary, recon] = await Promise.all([
    getDailySales(merchant.id, range.from, range.to),
    getDailySales(merchant.id, range.prevFrom, range.prevToDate),
    getDailySales(merchant.id, today, today),
    kind === 'today' ? getDailySales(merchant.id, chart.from, chart.to) : Promise.resolve(null),
    getHeatmap(merchant.id, addDays(today, -27), today),
    getFeeTotals(merchant.id, range.from, range.toDate),
    getRecentSettlements(merchant.id, 5),
    getSettlementSummary(merchant.id, today),
    getLatestRunSummary(merchant.id),
  ])

  const m = buildHomeModel({
    today,
    kind,
    firstName: merchant.userName,
    hour: sgtHour(now),
    currRows,
    prevRows,
    todayRows,
    chartRows: chartRows ?? currRows,
    heat,
    fees,
    settlements,
    settlementSummary,
    recon,
  })

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Headline greeting={m.greeting} headline={m.headline} subline={m.subline} />
        <PeriodSwitcher current={kind} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {m.tags.map((t) => (
          <Pill key={t.label} tone={t.tone}>
            {t.label}
          </Pill>
        ))}
      </div>

      <section aria-label="Summary" className="grid grid-cols-1 divide-y divide-line rounded-[12px] border border-line bg-white shadow-panel sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {m.tiles.map((t) => (
          <StatTile key={t.label} {...t} />
        ))}
      </section>

      <MoneyFlow flow={m.flow} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title={m.chart.title}
          action={
            <Link href={`/assistant?q=${encodeURIComponent('Explain my sales this week')}`} className="inline-flex min-h-11 items-center text-[14px] font-semibold">
              Explain this
            </Link>
          }
        >
          {m.chart.hasData ? (
            <WeekBars series={m.chart.series} bestIndex={m.chart.bestIndex} ariaLabel={m.chart.ariaLabel} />
          ) : (
            <EmptyState>No sales yet for this period</EmptyState>
          )}
        </Panel>
        <Panel title="How customers paid">
          {m.mix.length > 0 ? <ChannelBars mix={m.mix} /> : <EmptyState>No sales yet for this period</EmptyState>}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Money to your bank"
          tech="Settlements"
          action={
            <Link href="/settlements" className="inline-flex min-h-11 items-center text-[14px] font-semibold">
              See all
            </Link>
          }
        >
          {m.settlements.length > 0 ? (
            <SettlementList items={m.settlements} />
          ) : (
            <EmptyState>No money has been sent to your bank yet</EmptyState>
          )}
        </Panel>
        <div className="flex flex-col gap-5">
          <Panel title="Needs your attention">
            {m.attention.items.length > 0 ? (
              <AttentionList items={m.attention.items} />
            ) : (
              <EmptyState>Nothing needs your attention right now</EmptyState>
            )}
          </Panel>
          <CheckupCard checkup={m.checkup} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <Link href="/reconciliation" className={`${btnBase} bg-nets-red text-white hover:bg-nets-red-hover`}>
          See what needs attention
        </Link>
        <Link href="/assistant" className={`${btnBase} border border-line-strong bg-white text-ink shadow-panel hover:border-ink-3`}>
          Ask the assistant
        </Link>
        <Link href="/transactions" className={`${btnBase} border border-line-strong bg-white text-ink shadow-panel hover:border-ink-3`}>
          See your payments
        </Link>
      </div>
    </div>
  )
}
