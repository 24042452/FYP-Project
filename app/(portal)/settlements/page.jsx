import Link from 'next/link'
import { requirePage } from '@/lib/data/merchant'
import { getSettlementTotals, listSettlements } from '@/lib/data/settlements'
import { sgtDate } from '@/lib/dates'
import { buildSettlementsModel, monthBounds, parseMonth, parseSettlementStatus } from '@/lib/settlements/model'
import { Pill } from '@/components/dashboard/Pill'
import { StatTile } from '@/components/dashboard/StatTile'
import { EmptyState } from '@/components/dashboard/Panel'
import { MerchantWideNote } from '@/components/layout/MerchantWideNote'

export const metadata = { title: 'Money to my bank · Merchant Portal' }

const navLink =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-white px-4 text-[14px] font-semibold text-ink-2 no-underline hover:bg-page'

export default async function SettlementsPage({ searchParams }) {
  // The merchant comes only from the session, never from the address.
  const merchant = await requirePage('/settlements')
  const sp = await searchParams
  const today = sgtDate(new Date().toISOString())
  const month = parseMonth(Array.isArray(sp?.month) ? sp.month[0] : sp?.month, today)
  const status = parseSettlementStatus(Array.isArray(sp?.status) ? sp.status[0] : sp?.status)
  const { from, to } = monthBounds(month)

  const [rows, totals] = await Promise.all([
    listSettlements(merchant.id, { from, to, status, today }),
    getSettlementTotals(merchant.id, { from, to, today }),
  ])
  const m = buildSettlementsModel({ month, today, status, rows, totals })

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold">Money to my bank</h1>
        <p className="mt-1 text-[14px] text-ink-3">Settlements · when your money reaches your bank</p>
      </div>
      <MerchantWideNote />

      <section aria-label="Summary" className="grid grid-cols-1 divide-y divide-line rounded-[12px] border border-line bg-white shadow-panel sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {m.tiles.map((t) => (
          <StatTile key={t.label} {...t} />
        ))}
      </section>

      <section className="min-w-0 overflow-hidden rounded-[12px] border border-line bg-white shadow-panel">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <nav aria-label="Month" className="flex items-center justify-between gap-2 sm:justify-start">
            <Link href={m.prevHref} className={navLink} aria-label="Earlier month">
              ‹ Earlier
            </Link>
            <h2 className="min-w-[9.5rem] text-center text-[17px] font-semibold">{m.monthLabel}</h2>
            {m.nextHref ? (
              <Link href={m.nextHref} className={navLink} aria-label="Later month">
                Later ›
              </Link>
            ) : (
              <span className={`${navLink} cursor-default opacity-40`} aria-hidden="true">
                Later ›
              </span>
            )}
          </nav>
          <nav aria-label="Status" className="inline-flex max-w-full flex-wrap rounded-lg border border-line-strong bg-white p-0.5">
            {m.filters.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                aria-current={f.active ? 'true' : undefined}
                className={`inline-flex min-h-11 items-center rounded-md px-3 text-[14px] font-semibold no-underline ${
                  f.active ? 'bg-nets-blue-soft text-info' : 'text-ink-2 hover:bg-page'
                }`}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="p-4 sm:p-5">
          {m.isEmpty ? (
            <EmptyState>{m.emptyText}</EmptyState>
          ) : (
            <div className="flex flex-col gap-6">
              {m.groups.map((g) => (
                <section key={g.key} aria-label={`Sales from ${g.dateLabel}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="text-[15px] font-semibold">
                      <span className="font-normal text-ink-3">Sales from </span>
                      {g.dateLabel}
                    </h3>
                    <span className="text-[13px] text-ink-3 tabular-nums">Day total {g.totalNet}</span>
                  </div>
                  <ul className="m-0 mt-2 list-none p-0">
                    {g.rows.map((r) => (
                      <li key={r.key} className="flex flex-col gap-2 border-t border-line py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <div className="min-w-0">
                          <span className="block text-[15px] font-semibold">{r.channelLabel}</span>
                          <span className="block text-[13px] text-ink-3">{r.detail}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:justify-end">
                          <span className="text-[20px] leading-tight font-semibold tabular-nums">{r.net}</span>
                          <Pill tone={r.tone}>{r.statusLabel}</Pill>
                          {r.dateNote ? <span className="text-[13px] text-ink-3">{r.dateNote}</span> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
