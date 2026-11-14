import Link from 'next/link'
import { getCurrentMerchant } from '@/lib/data/merchant'
import { listLatestRunIds } from '@/lib/data/recon'
import { addMonths, monthEnd, monthStart, sgtDate } from '@/lib/dates'
import { monthName } from '@/lib/recon/reconcile'
import { Panel } from '@/components/dashboard/Panel'
import { MerchantWideNote } from '@/components/layout/MerchantWideNote'

export const metadata = { title: 'Reports · Merchant Portal' }

const FIRST_MONTH = '2026-05'
const linkBtn =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-white px-4 text-[14px] font-semibold text-ink-2 no-underline hover:bg-page'

export default async function ReportsPage() {
  const merchant = await getCurrentMerchant()
  const today = sgtDate(new Date().toISOString())
  const lastComplete = addMonths(monthStart(today), -1).slice(0, 7)
  const runs = new Map((await listLatestRunIds(merchant.id)).map((r) => [r.period.slice(0, 7), r.id]))

  /** @type {string[]} */
  const months = []
  for (let m = lastComplete; m >= FIRST_MONTH; m = addMonths(`${m}-01`, -1).slice(0, 7)) months.push(m)

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold">Reports</h1>
        <p className="mt-1 text-[14px] text-ink-3">Finance reporting · files to download for you or your accountant</p>
      </div>
      <MerchantWideNote />

      <Panel title="Monthly downloads">
        <ul className="m-0 list-none p-0">
          {months.map((m) => {
            const from = `${m}-01`
            const to = monthEnd(from)
            const runId = runs.get(m)
            return (
              <li key={m} className="flex flex-col gap-3 border-t border-line py-4 first:border-t-0 first:pt-0 lg:flex-row lg:items-center lg:justify-between">
                <h3 className="text-[16px] font-semibold">
                  {monthName(m)} {m.slice(0, 4)}
                </h3>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <a className={linkBtn} href={`/api/export/transactions?from=${from}&to=${to}&format=xlsx`}>
                    Payments (Excel)
                  </a>
                  {runId ? (
                    <>
                      <a className={linkBtn} href={`/api/export/recon?run=${runId}&format=xlsx`}>
                        Check-up (Excel)
                      </a>
                      <a className={linkBtn} href={`/api/export/recon?run=${runId}&format=pdf`}>
                        Check-up (PDF)
                      </a>
                    </>
                  ) : (
                    <Link href={`/reconciliation?month=${m}`} className="inline-flex min-h-11 items-center px-1 text-[14px] font-semibold text-nets-blue-hover">
                      Run a check-up first
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}
