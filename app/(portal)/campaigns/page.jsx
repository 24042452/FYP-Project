import { requirePage } from '@/lib/data/merchant'
import { getSelectedOutlet } from '@/lib/outlets/server'
import { listOutlets } from '@/lib/data/outlets'
import { getPromotionSales, listPromotionRuns } from '@/lib/data/promotions'
import { sgtDate } from '@/lib/dates'
import { buildPromotionsPage, resultsPlan } from '@/lib/promotions/view'
import { PromotionsBoard } from '@/components/promotions/PromotionsBoard'
import { ResultsTable } from '@/components/promotions/ResultsTable'

export const metadata = { title: 'Promotions · Merchant Portal' }

export default async function PromotionsPage() {
  // The merchant comes only from the session. Like Refunds & disputes, an owner's page follows the outlet picked
  // in the "Showing" menu; an outlet manager only ever gets runs at their own outlet.
  const merchant = await requirePage('/campaigns')
  const { selected } = await getSelectedOutlet(merchant)
  const outletId = selected?.id ?? merchant.outletId ?? null
  const today = sgtDate(new Date().toISOString())

  const [runs, outlets] = await Promise.all([
    listPromotionRuns(merchant.id, { outletId: merchant.outletId ?? null }),
    listOutlets(merchant.id),
  ])

  // Results: each finished run's promotion days, and the same weekdays in the 4 weeks before it started.
  const plan = resultsPlan(runs, today, outletId)
  const sales = Object.fromEntries(
    await Promise.all(
      plan.map(async (p) => {
        const [promoDays, baseDays] = await Promise.all([getPromotionSales(merchant.id, p.promo), getPromotionSales(merchant.id, p.base)])
        return [p.runId, { promoDays, baseDays }]
      }),
    ),
  )

  const m = buildPromotionsPage({ category: merchant.category, runs, outlets, sales, today, access: merchant, outletId })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold">Promotions</h1>
        <p className="mt-1 text-[14px] text-ink-3">
          Marketing campaigns · deals NETS runs for your customers{selected ? ` · ${selected.name}` : ''}
        </p>
        <p
          data-testid="promotions-answer"
          className="mt-3 max-w-[46ch] text-[clamp(1.35rem,1.05rem+1.1vw,1.85rem)] leading-[1.3] font-semibold tracking-[-0.015em]"
        >
          {m.sentence.before}
          {m.sentence.figure ? <em className="text-info not-italic">{m.sentence.figure}</em> : null}
          {m.sentence.after}
        </p>
        {m.sentence.before.includes('Take one up') ? null : <p className="mt-2 max-w-[65ch] text-base text-ink-2">{m.sub}</p>}
        {m.note ? (
          <p
            role="note"
            data-testid="view-only-note"
            className="mt-3 w-fit max-w-full rounded-lg border border-line bg-nets-blue-soft px-4 py-3 text-[15px] text-ink-2"
          >
            {m.note}
          </p>
        ) : null}
      </div>

      <PromotionsBoard running={m.running} cards={m.cards} chips={m.chips} picker={m.picker} />

      <ResultsTable rows={m.results} />
    </div>
  )
}
