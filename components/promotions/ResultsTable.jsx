import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/Panel'

/** @typedef {ReturnType<typeof import('@/lib/promotions/view').buildPromotionsPage>['results'][number]} ResultRow */

const TONE = {
  ok: { cls: 'text-ok', Icon: ArrowUpRight },
  bad: { cls: 'text-bad', Icon: ArrowDownRight },
  mute: { cls: 'text-ink-2', Icon: Minus },
}

/** "+14%" in green with an up arrow, "About the same" in grey, "−5%" in red. @param {{row: ResultRow}} props */
function Change({ row }) {
  const t = TONE[row.tone] ?? TONE.mute
  return (
    <span className={`inline-flex items-center gap-1 font-[650] tabular-nums ${t.cls}`}>
      <t.Icon className="size-4 flex-none" aria-hidden="true" />
      {row.label}
    </span>
  )
}

/**
 * Results of finished promotions, the latest first: average sales on its promotion days, and how that compares
 * with the same days in the 4 weeks before. Labelled as an estimate. A table on desktop, a list on phones.
 * @param {{rows: ResultRow[]}} props
 */
export function ResultsTable({ rows }) {
  return (
    <section aria-labelledby="results-h" className="min-w-0 rounded-[12px] border border-line bg-white shadow-panel">
      <div className="px-4 pt-4 sm:px-5 sm:pt-[18px]">
        <h2 id="results-h" className="text-[17px] font-semibold">
          Results <span className="ml-1 text-[13px] font-normal text-ink-3">Finished promotions</span>
        </h2>
      </div>
      {rows.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState>Results show here when a promotion ends.</EmptyState>
        </div>
      ) : (
        <>
          <div className="mt-2 hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-ink-2">
                  <th scope="col" className="border-b border-line px-5 py-2.5 font-semibold">Promotion</th>
                  <th scope="col" className="border-b border-line px-4 py-2.5 text-right font-semibold">Sales on promotion days</th>
                  <th scope="col" className="border-b border-line px-5 py-2.5 text-right font-semibold">Compared with before</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} data-testid="result-row" className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <b className="font-semibold">{r.name}</b>
                      <span className="block text-[13px] text-ink-3">{r.sub}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      <b className="font-semibold">{r.sales}</b>
                      {r.before ? <span className="block text-[13px] text-ink-3">{r.before}</span> : null}
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <Change row={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="m-0 mt-2 list-none p-0 sm:hidden" aria-label="Results">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 border-t border-line px-4 py-3">
                <span className="font-semibold">{r.name}</span>
                <span className="text-[13px] text-ink-3">{r.sub}</span>
                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[15px]">
                  <span className="flex flex-col">
                    <span className="font-semibold tabular-nums">{r.sales}</span>
                    {r.before ? <span className="text-[13px] text-ink-3 tabular-nums">{r.before}</span> : null}
                  </span>
                  <Change row={r} />
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="border-t border-line px-4 py-3 text-[13px] text-ink-3 sm:px-5">
        Estimate: promotion days compared with the same days in the 4 weeks before. Other things can change sales too.
      </p>
    </section>
  )
}
