import { requirePage } from '@/lib/data/merchant'
import { getSelectedOutlet } from '@/lib/outlets/server'
import { listOutlets } from '@/lib/data/outlets'
import { listOfferTakeups } from '@/lib/data/offers'
import { sgtDate } from '@/lib/dates'
import { buildOffersPage } from '@/lib/offers/view'
import { OffersBoard } from '@/components/offers/OffersBoard'

export const metadata = { title: 'Offers · Merchant Portal' }

export default async function OffersPage() {
  // The merchant comes only from the session. Like Promotions, an owner's page follows the outlet picked in the
  // "Showing" menu; an outlet manager only ever gets take-ups that include their own outlet.
  const merchant = await requirePage('/offers')
  const { selected } = await getSelectedOutlet(merchant)
  const outletId = selected?.id ?? merchant.outletId ?? null
  const today = sgtDate(new Date().toISOString())

  const [takeups, outlets] = await Promise.all([
    listOfferTakeups(merchant.id, { outletId: merchant.outletId ?? null }),
    listOutlets(merchant.id),
  ])

  const m = buildOffersPage({ category: merchant.category, takeups, outlets, today, access: merchant, outletId })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold">Offers</h1>
        <p className="mt-1 text-[14px] text-ink-3">
          Deals from NETS and its partners for your business{selected ? ` · ${selected.name}` : ''}
        </p>
        <p
          data-testid="offers-answer"
          className="mt-3 max-w-[46ch] text-[clamp(1.35rem,1.05rem+1.1vw,1.85rem)] leading-[1.3] font-semibold tracking-[-0.015em]"
        >
          {m.sentence.before}
          {m.sentence.figure ? <em className="text-info not-italic">{m.sentence.figure}</em> : null}
          {m.sentence.after}
        </p>
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

      <OffersBoard yours={m.yours} cards={m.cards} chips={m.chips} picker={m.picker} />
    </div>
  )
}
