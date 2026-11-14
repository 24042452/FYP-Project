import { getCurrentMerchant } from '@/lib/data/merchant'
import { listInvoiceLines, listInvoices } from '@/lib/data/invoices'
import { sgtDate } from '@/lib/dates'
import { buildInvoicesModel } from '@/lib/invoices/model'
import { Pill } from '@/components/dashboard/Pill'
import { EmptyState } from '@/components/dashboard/Panel'
import { PayNowButton } from '@/components/invoices/PayNowButton'
import { MerchantWideNote } from '@/components/layout/MerchantWideNote'

export const metadata = { title: 'Bills & charges · Merchant Portal' }

const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-white px-4 text-[14px] font-semibold text-ink-2 no-underline hover:bg-page'

export default async function InvoicesPage({ searchParams }) {
  // The merchant comes only from the session, never from the address.
  const merchant = await getCurrentMerchant()
  const sp = await searchParams
  const openId = Array.isArray(sp?.open) ? sp.open[0] : sp?.open

  const invoices = await listInvoices(merchant.id)
  const linesById = await listInvoiceLines(
    merchant.id,
    invoices.map((i) => i.id),
  )
  const m = buildInvoicesModel({ invoices, linesById, openId, today: sgtDate(new Date().toISOString()) })

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold">Bills &amp; charges</h1>
        <p className="mt-1 text-[14px] text-ink-3">Invoices · what NETS charges you each month</p>
      </div>
      <MerchantWideNote />

      <section className="min-w-0 overflow-hidden rounded-[12px] border border-line bg-white shadow-panel">
        {m.isEmpty ? (
          <div className="p-4 sm:p-5">
            <EmptyState>{m.emptyText}</EmptyState>
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {m.rows.map((r) => (
              <li key={r.key} className="border-t border-line first:border-t-0">
                <details open={r.open} className="group">
                  <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-2 p-4 hover:bg-page sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-ink-3 transition-transform group-open:rotate-90">›</span>
                      <span className="text-[16px] font-semibold">{r.monthLabel}</span>
                      <span className="text-[13px] text-ink-3">See what is in this bill</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 sm:pl-0">
                      <span className="text-[20px] leading-tight font-semibold tabular-nums">{r.total}</span>
                      <Pill tone={r.tone}>{r.statusLabel}</Pill>
                      {r.dueNote ? <span className="text-[13px] text-ink-3">{r.dueNote}</span> : null}
                    </span>
                  </summary>

                  <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                    {r.lines.length === 0 ? (
                      <p className="text-[14px] text-ink-3">No charges listed for this bill.</p>
                    ) : (
                      <ul className="m-0 list-none rounded-lg bg-page p-0">
                        {r.lines.map((l) => (
                          <li key={l.key} className="flex items-baseline justify-between gap-4 border-t border-line px-3 py-2.5 first:border-t-0">
                            <span className="min-w-0 text-[14px]">
                              {l.description}
                              {l.detail ? <span className="block text-[13px] text-ink-3">{l.detail}</span> : null}
                            </span>
                            <span className="text-[14px] font-semibold tabular-nums">{l.amount}</span>
                          </li>
                        ))}
                        <li className="flex items-baseline justify-between gap-4 border-t border-line-strong px-3 py-2.5">
                          <span className="text-[14px] font-semibold">Total</span>
                          <span className="text-[14px] font-semibold tabular-nums">{r.total}</span>
                        </li>
                      </ul>
                    )}
                    {r.hasMdr ? (
                      <p className="mt-2 text-[13px] text-ink-3">
                        What are MDR fees? They are the small fee NETS charges on each card or QR payment you take.
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={r.pdfHref} download={r.filename} className={secondary}>
                        Download PDF
                      </a>
                      {r.canPay ? <PayNowButton month={r.monthLabel} /> : null}
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
