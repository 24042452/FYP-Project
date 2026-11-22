import Link from 'next/link'
import { redirect } from 'next/navigation'
import { canOpen } from '@/lib/access/rules'
import { getCurrentMerchant } from '@/lib/data/merchant'
import { getSelectedOutlet } from '@/lib/outlets/server'
import { getDailySales, getFeeTotals, getHeatmap } from '@/lib/data/sales'
import { getOutletSettlementShares, getRecentSettlements, getSettlementSummary } from '@/lib/data/settlements'
import { shareDays, shareSummary } from '@/lib/settlements/outlet-share'
import { getLatestRunSummary } from '@/lib/data/recon'
import { addDays, periodRange, sgtDate, sgtHour } from '@/lib/dates'
import { buildHomeModel, chartRange, parsePeriod } from '@/lib/dashboard/home-model'
import { buildNumbersModel } from '@/lib/dashboard/numbers-model'
import { Headline } from '@/components/dashboard/Headline'
import { PeriodSwitcher } from '@/components/dashboard/PeriodSwitcher'
import { HealthTag } from '@/components/dashboard/HealthTag'
import { StatTile } from '@/components/dashboard/StatTile'
import { MoneyFlow } from '@/components/dashboard/MoneyFlow'
import { NumbersPanel } from '@/components/dashboard/NumbersPanel'
import { WeekBars } from '@/components/dashboard/WeekBars'
import { ChannelBars } from '@/components/dashboard/ChannelBars'
import { SettlementList } from '@/components/dashboard/SettlementList'
import { AttentionList } from '@/components/dashboard/AttentionList'
import { CheckupCard } from '@/components/dashboard/CheckupCard'
import { SwitchFx } from '@/components/dashboard/SwitchFx'
import { Panel, EmptyState } from '@/components/dashboard/Panel'

export const metadata = { title: 'Home · Merchant Portal' }

const btnBase =
  'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-[15px] font-semibold no-underline max-sm:w-full'

export default async function HomePage({ searchParams }) {
  const merchant = await getCurrentMerchant()
  // Head office starts on the group overview until it picks a franchisee.
  if (merchant.tier === 'hq' && !merchant.chosen) redirect('/group')
  const can = (/** @type {string} */ path) => canOpen(merchant, path)
  const sp = await searchParams
  const kind = parsePeriod(sp?.period)
  const { selected } = await getSelectedOutlet(merchant)
  const outletId = selected?.id ?? null

  const now = new Date().toISOString()
  const today = sgtDate(now)
  const range = periodRange(kind, today)
  const chart = chartRange(kind, today)

  const [currRows, prevRows, todayRows, chartRows, heat, fees, settlements, settlementSummary, recon] = await Promise.all([
    getDailySales(merchant.id, range.from, range.to, outletId),
    getDailySales(merchant.id, range.prevFrom, range.prevToDate, outletId),
    getDailySales(merchant.id, today, today, outletId),
    kind === 'today' ? getDailySales(merchant.id, chart.from, chart.to, outletId) : Promise.resolve(null),
    getHeatmap(merchant.id, addDays(today, -27), today, outletId),
    getFeeTotals(merchant.id, range.from, range.toDate, outletId),
    outletId ? Promise.resolve(null) : getRecentSettlements(merchant.id, 5),
    outletId ? Promise.resolve(null) : getSettlementSummary(merchant.id, today),
    getLatestRunSummary(merchant.id, outletId),
  ])

  // With an outlet picked, the bank figures are that outlet's share of each NETS payout.
  let settlementList = settlements
  let settlementTotals = settlementSummary
  if (outletId) {
    const shares = await getOutletSettlementShares(merchant.id, outletId, { since: addDays(today, -14) })
    settlementList = shareDays(shares, 5)
    settlementTotals = shareSummary(shares, today)
  }

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
    settlements: settlementList ?? [],
    settlementSummary: settlementTotals ?? { pendingCents: 0, nextExpectedDate: null, lateCount: 0, lateCents: 0 },
    recon,
    outletName: selected?.name,
    canLink: can,
  })

  // Like for like, the same rows as the headline: the period so far against the same days before it.
  const numbers = buildNumbersModel({ kind, currRows, prevRows })

  const fxKey = `${outletId ?? 'all'}|${kind}`

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SwitchFx fxKey={fxKey} variant="ring" className="-mx-2 -my-1 px-2 py-1">
          <Headline greeting={m.greeting} headline={m.headline} subline={m.subline} />
        </SwitchFx>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <PeriodSwitcher current={kind} />
          {m.outletName ? (
            <p data-testid="home-outlet" className="text-[14px] font-medium text-ink-2">
              Outlet: <span className="font-semibold text-ink">{m.outletName}</span>
            </p>
          ) : null}
        </div>
      </div>

      <SwitchFx fxKey={fxKey} variant="panels" className="flex flex-col gap-5 sm:gap-6">
      <HealthTag tags={m.tags} />

      <section aria-label="Summary" className="grid grid-cols-1 divide-y divide-line rounded-[12px] border border-line bg-white shadow-panel sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {m.tiles.map((t) => (
          <StatTile key={t.label} {...t} />
        ))}
      </section>

      {numbers.hasData ? <NumbersPanel model={numbers} /> : null}

      <MoneyFlow flow={m.flow} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title={m.chart.title}
          action={
            can('/assistant') && (
            <Link href={`/assistant?q=${encodeURIComponent('Explain my sales this week')}`} className="inline-flex min-h-11 items-center text-[14px] font-semibold">
              Explain this
            </Link>
            )
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
          caption={m.payoutNote || undefined}
          action={
            can('/settlements') && (
            <Link href="/settlements" className="inline-flex min-h-11 items-center text-[14px] font-semibold">
              See all
            </Link>
            )
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
            {m.attention.wholeBusiness ? (
              <p className="mt-3 border-t border-line pt-3 text-[14px] text-ink-3" data-testid="whole-business-line">
                {m.attention.wholeBusiness.text}.{' '}
                <Link href={m.attention.wholeBusiness.href} className="inline-flex min-h-11 items-center font-semibold">
                  See them
                </Link>
              </p>
            ) : null}
          </Panel>
          {can('/reconciliation') ? <CheckupCard checkup={m.checkup} /> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {can('/reconciliation') ? (
        <Link href="/reconciliation" className={`${btnBase} bg-nets-red text-white hover:bg-nets-red-hover`}>
          See what needs attention
        </Link>
        ) : null}
        {can('/assistant') ? (
        <Link href="/assistant" className={`${btnBase} border border-line-strong bg-white text-ink shadow-panel hover:border-ink-3`}>
          Ask the assistant
        </Link>
        ) : null}
        <Link href="/transactions" className={`${btnBase} border border-line-strong bg-white text-ink shadow-panel hover:border-ink-3`}>
          See your payments
        </Link>
      </div>
      </SwitchFx>
    </div>
  )
}
