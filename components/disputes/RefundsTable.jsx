import Link from 'next/link'
import { Download } from 'lucide-react'
import { Pill } from '@/components/dashboard/Pill'
import { EmptyState } from '@/components/dashboard/Panel'

/**
 * Refunds of the last 3 months, newest first, with the payout each one was taken from. A table on desktop,
 * a stacked list on phones. Each refund links to its payment.
 * @param {{rows: import('@/lib/disputes/view').RefundView[]}} props
 */
export function RefundsTable({ rows }) {
  // Paid: plain text (money leaving is not a success state). Still to come: a blue pill.
  const payoutCell = (/** @type {import('@/lib/disputes/view').RefundView['payout']} */ p) =>
    p.paid ? <span className="text-ink-2">{p.text}</span> : <Pill tone="info">{p.text}</Pill>
  return (
    <section aria-labelledby="refunds-h" className="min-w-0 rounded-[12px] border border-line bg-white shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-3 sm:px-5 sm:pt-[10px]">
        <h2 id="refunds-h" className="py-1 text-[17px] font-semibold">
          Refunds <span className="ml-1 text-[13px] font-normal text-ink-3">Last 3 months</span>
        </h2>
        {rows.length > 0 ? (
          <a
            href="/api/export/refunds"
            className="-mr-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-[14px] font-semibold text-info hover:bg-nets-blue-soft"
          >
            <Download className="size-4" aria-hidden="true" />
            Download Excel
          </a>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState>No refunds in the last 3 months.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-2 hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr className="text-left text-[13px] text-ink-2">
                <th scope="col" className="border-b border-line px-5 py-2.5 font-semibold whitespace-nowrap">Refunded on</th>
                <th scope="col" className="border-b border-line px-4 py-2.5 font-semibold whitespace-nowrap">Bought on</th>
                <th scope="col" className="border-b border-line px-4 py-2.5 font-semibold whitespace-nowrap">Paid with</th>
                <th scope="col" className="border-b border-line px-4 py-2.5 font-semibold">Reason</th>
                <th scope="col" className="border-b border-line px-4 py-2.5 text-right font-semibold">Amount</th>
                <th scope="col" className="border-b border-line px-5 py-2.5 font-semibold">Payout</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-testid="refund-row" className="border-b border-line last:border-0 hover:bg-page">
                  <td className="px-5 py-3 whitespace-nowrap">
                    <Link href={r.href} className="font-semibold text-info underline-offset-[3px] hover:text-ink">
                      {r.refundedOn}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-2">{r.boughtOn}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.channel}</td>
                  <td className="px-4 py-3">{r.reason}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.amount}</td>
                  <td className="px-5 py-3 whitespace-nowrap">{payoutCell(r.payout)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <ul className="m-0 mt-2 list-none p-0 sm:hidden" aria-label="Refunds">
            {rows.map((r) => (
              <li key={r.id} className="border-t border-line">
                <Link href={r.href} className="flex flex-col gap-1.5 px-4 py-3 text-ink no-underline hover:bg-page">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{r.reason}</span>
                    <span className="font-semibold tabular-nums">{r.amount}</span>
                  </span>
                  <span className="text-[13px] text-ink-3">
                    Refunded {r.refundedOn} · {r.channel} · bought {r.boughtOn}
                  </span>
                  <span className="text-[13px]">{r.payout.paid ? <span className="text-ink-2">Taken from the {r.payout.text}</span> : payoutCell(r.payout)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
