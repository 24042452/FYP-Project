import Link from 'next/link'
import { getCurrentMerchant } from '@/lib/data/merchant'
import { getSelectedOutlet } from '@/lib/outlets/server'
import { getTransaction, listTransactions } from '@/lib/data/transactions'
import { sgtDate } from '@/lib/dates'
import { buildHref, parseTxnParams } from '@/lib/transactions/params'
import { formatDay, toDetailView, toRowView } from '@/lib/transactions/format'
import { rangeLine } from '@/lib/search/nav'
import { X } from 'lucide-react'
import { TxnFilters } from '@/components/transactions/TxnFilters'
import { TxnTable } from '@/components/transactions/TxnTable'
import { TxnDrawer } from '@/components/transactions/TxnDrawer'

export const metadata = { title: 'Sales & payments · Merchant Portal' }

export default async function TransactionsPage({ searchParams }) {
  // The merchant comes only from the session, never from the address.
  const merchant = await getCurrentMerchant()
  const sp = await searchParams
  const today = sgtDate(new Date().toISOString())
  const p = parseTxnParams(sp ?? {}, today)
  const { selected } = await getSelectedOutlet(merchant)
  const outletId = selected?.id ?? null

  const [list, found] = await Promise.all([
    listTransactions(merchant.id, { ...p, outletId }),
    p.id ? getTransaction(merchant.id, p.id) : Promise.resolve(null),
  ])

  // `outlet` rides along so "Show more" (the API) stays on the same outlet.
  const filters = Object.fromEntries(
    Object.entries({ from: p.from, to: p.to, channel: p.channel, status: p.status, q: p.q, outlet: outletId }).filter(([, v]) => v),
  )
  const baseQuery = buildHref(p, {}).split('?')[1] ?? ''
  const tableKey = JSON.stringify(filters)

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold">Sales &amp; payments</h1>
        <p className="mt-1 text-[14px] text-ink-3">Transactions · every payment at {selected ? selected.name : 'every outlet'}</p>
      </div>
      {p.id && !found ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-line bg-white p-4 shadow-panel sm:p-5">
          <div>
            <h2 className="text-[17px] font-semibold">We couldn&apos;t find that payment</h2>
            <p className="mt-1 text-[15px] text-ink-2">
              It may have been typed wrongly or may not be one of yours. Pick a payment from the list below.
            </p>
          </div>
          <Link
            href={buildHref(p, { id: null })}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-nets-red px-4 text-[15px] font-semibold text-white no-underline hover:bg-nets-red-hover max-sm:w-full"
          >
            Back to your payments
          </Link>
        </div>
      ) : null}
      {p.q ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-line-strong bg-white py-1 pr-1 pl-4 text-[15px] shadow-panel">
            <span className="min-w-0 truncate">
              Search: <strong className="font-semibold">&lsquo;{p.q}&rsquo;</strong>
            </span>
            <Link
              href={buildHref(p, { q: null, id: null })}
              aria-label={`Clear search ${p.q}`}
              className="grid size-9 flex-none place-items-center rounded-full text-ink-2 no-underline hover:bg-page hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </Link>
          </span>
        </div>
      ) : null}
      <p className="text-lg text-ink-2">{rangeLine({ q: p.q, from: p.from, to: p.to, explicitDates: Boolean(p.explicit.from), formatDay })}</p>

      <section className="min-w-0 overflow-hidden rounded-[12px] border border-line bg-white shadow-panel">
        <TxnFilters params={p} today={today} focusSearch={sp?.focus === 'search'} />
        <TxnTable
          key={tableKey}
          initialRows={list.rows.map(toRowView)}
          initialCursor={list.nextCursor}
          filters={filters}
          baseQuery={baseQuery}
          selectedId={found?.id}
        />
      </section>

      {found ? <TxnDrawer detail={toDetailView(found)} closeHref={buildHref(p, { id: null })} /> : null}
    </div>
  )
}
