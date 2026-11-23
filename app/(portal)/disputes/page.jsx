import { requirePage } from '@/lib/data/merchant'
import { getSelectedOutlet } from '@/lib/outlets/server'
import { listDisputes } from '@/lib/data/disputes'
import { listRefunds } from '@/lib/data/refunds'
import { getTransaction } from '@/lib/data/transactions'
import { toDetailView } from '@/lib/transactions/format'
import { TxnDrawer } from '@/components/transactions/TxnDrawer'
import { sgtDate } from '@/lib/dates'
import { canRespond, viewOnlyNote } from '@/lib/disputes/rules'
import { buildDisputesPage, paymentHref, refundsRange } from '@/lib/disputes/view'
import { StatTile } from '@/components/dashboard/StatTile'
import { DisputesPanel } from '@/components/disputes/DisputesPanel'
import { RefundsTable } from '@/components/disputes/RefundsTable'

export const metadata = { title: 'Refunds & disputes · Merchant Portal' }

export default async function DisputesPage({ searchParams }) {
  // The merchant comes only from the session, never from the address. Like Home and Sales & payments, the
  // page follows the outlet picked in the "Showing" menu; an outlet manager always gets their own outlet.
  const merchant = await requirePage('/disputes')
  const { selected } = await getSelectedOutlet(merchant)
  const outletId = selected?.id ?? merchant.outletId ?? null
  const today = sgtDate(new Date().toISOString())

  const [disputes, refunds] = await Promise.all([
    listDisputes(merchant.id, { outletId }),
    listRefunds(merchant.id, { ...refundsRange(today), outletId }),
  ])
  const m = buildDisputesPage({ disputes, refunds, today })

  // ?payment= opens that payment in the side panel. Only a payment of a dispute or refund on this page can open,
  // so the address can never show another outlet's (or merchant's) payment.
  const sp = await searchParams
  const wanted = typeof sp?.payment === 'string' ? sp.payment : null
  const onPage = new Set([...disputes.map((d) => d.transactionId), ...refunds.map((r) => r.transactionId)])
  const payment = wanted && onPage.has(wanted) ? await getTransaction(merchant.id, wanted) : null
  const answers = canRespond(merchant)
  const note = viewOnlyNote(merchant)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[28px] leading-tight font-bold">Refunds &amp; disputes</h1>
        <p className="mt-1 text-[14px] text-ink-3">
          Chargebacks · money customers asked for back{selected ? ` · ${selected.name}` : ''}
        </p>
        <p
          data-testid="disputes-answer"
          className="mt-4 max-w-[46ch] text-[clamp(1.35rem,1.05rem+1.1vw,1.85rem)] leading-[1.3] font-semibold tracking-[-0.015em]"
        >
          {m.sentence.lead ? <span className="block">{m.sentence.lead}</span> : null}
          {m.sentence.before}
          {m.sentence.figure ? <em className="text-info not-italic tabular-nums">{m.sentence.figure}</em> : null}
          {m.sentence.after}
        </p>
        {m.hasOpen && answers ? (
          <p className="mt-2 text-base text-ink-2">
            A customer&apos;s bank asked for their money back. Accept it, or decline it and show NETS why the payment was right.
          </p>
        ) : null}
        {note ? (
          <p
            role="note"
            data-testid="view-only-note"
            className="mt-3 w-fit max-w-full rounded-lg border border-line bg-nets-blue-soft px-4 py-3 text-[15px] text-ink-2"
          >
            {note}
          </p>
        ) : null}
      </div>

      <section
        aria-label="Summary"
        className="grid grid-cols-1 divide-y divide-line rounded-[12px] border border-line bg-white shadow-panel sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {m.tiles.map((t) => (
          <StatTile key={t.label} {...t} countUp />
        ))}
      </section>

      <DisputesPanel cases={m.cases} closed={m.closed} canRespond={answers} />

      <RefundsTable rows={m.refunds} />

      {payment ? (
        <TxnDrawer
          detail={toDetailView(payment)}
          closeHref="/disputes"
          moreHref={paymentHref(payment.id, payment.createdAt)}
          moreLabel="Open in Sales & payments"
        />
      ) : null}
    </div>
  )
}
