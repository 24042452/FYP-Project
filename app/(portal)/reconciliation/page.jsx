import Link from 'next/link'
import { requirePage } from '@/lib/data/merchant'
import { getLatestRunForMonth } from '@/lib/data/recon'
import { addMonths, monthStart, sgtDate } from '@/lib/dates'
import { formatSGD } from '@/lib/money'
import { formatWhen } from '@/lib/transactions/format'
import { buildRunView, EXCEPTION_KINDS } from '@/lib/recon/view'
import { monthName, shortDay } from '@/lib/recon/reconcile'
import { CHANNEL_LABELS } from '@/lib/channels'
import { Pill } from '@/components/dashboard/Pill'
import { Panel, EmptyState } from '@/components/dashboard/Panel'
import { CheckedIn, RunCheckup } from '@/components/recon/RunProgress'
import { markAsSorted } from './actions'
import { MerchantWideNote } from '@/components/layout/MerchantWideNote'
import { FixGuide } from '@/components/recon/FixGuide'
import { buildGuide } from '@/lib/recon/guide'

export const metadata = { title: 'Check-up · Merchant Portal' }

const FIRST_MONTH = '2026-05'
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const linkBtn =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-white px-4 text-[14px] font-semibold text-ink-2 no-underline hover:bg-page'

/** @param {string} ym */
const monthLabel = (ym) => `${monthName(ym)} ${ym.slice(0, 4)}`

/** @param {{e: import('@/lib/data/recon').StoredException, month: string}} props */
function SortedForm({ e, month }) {
  return (
    <details className="mt-3">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-[14px] font-semibold text-nets-blue-hover">
        Mark as sorted
      </summary>
      <form action={markAsSorted} className="mt-2 flex flex-col gap-2 sm:max-w-md">
        <input type="hidden" name="exceptionId" value={e.id} />
        <input type="hidden" name="month" value={month} />
        <label className="text-[14px] text-ink-2" htmlFor={`note-${e.id}`}>
          Add a note (optional), for example &quot;Asked NETS, they will fix it&quot;
        </label>
        <textarea
          id={`note-${e.id}`}
          name="note"
          maxLength={500}
          rows={2}
          className="rounded-lg border border-line-strong bg-white p-3 text-[15px]"
        />
        <button
          type="submit"
          className="inline-flex min-h-11 w-fit items-center rounded-lg bg-nets-blue px-4 text-[14px] font-semibold text-white hover:bg-nets-blue-hover"
        >
          Done, mark as sorted
        </button>
      </form>
    </details>
  )
}

/** @param {{e: import('@/lib/data/recon').StoredException, month: string, mid: string | null, readOnly?: boolean}} props */
function ExceptionCard({ e, month, mid, readOnly = false }) {
  const guide = buildGuide(e, { mid, month, readOnly })
  const both = e.type !== 'failed_payment' && e.expectedCents != null && e.actualCents != null
  const diff = both ? /** @type {number} */ (e.actualCents) - /** @type {number} */ (e.expectedCents) : 0
  const seeHref =
    e.day && e.channel && (e.type === 'amount_mismatch' || e.type === 'missing_settlement' || e.type === 'failed_payment')
      ? `/transactions?from=${e.day}&to=${e.day}&channel=${e.channel}`
      : null
  return (
    <li className="border-t border-line px-4 py-4 first:border-t-0 sm:px-5">
      <p className="text-[16px] font-semibold">{e.message}</p>
      {both ? (
        <dl className="mt-3 grid grid-cols-1 gap-0 border-y border-line sm:grid-cols-3">
          <div className="flex items-baseline justify-between gap-2 py-2 sm:flex-col sm:pr-3">
            <dt className="text-[13px] text-ink-2">{e.type === 'fee_mismatch' ? 'Fees from your payments' : 'We expected'}</dt>
            <dd className="text-[18px] font-semibold tabular-nums">{formatSGD(/** @type {number} */ (e.expectedCents))}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 border-t border-line py-2 sm:flex-col sm:border-t-0 sm:border-l sm:px-3">
            <dt className="text-[13px] text-ink-2">{e.type === 'fee_mismatch' ? 'Fees on your bill' : 'Arrived in your bank'}</dt>
            <dd className="text-[18px] font-semibold tabular-nums">{formatSGD(/** @type {number} */ (e.actualCents))}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 border-t border-line py-2 sm:flex-col sm:border-t-0 sm:border-l sm:pl-3">
            <dt className="text-[13px] text-ink-2">Difference</dt>
            <dd className="text-[18px] font-semibold text-bad tabular-nums">{diff < 0 ? '−' : '+'}{formatSGD(Math.abs(diff))}</dd>
          </div>
        </dl>
      ) : null}
      {guide ? <FixGuide guide={guide} /> : null}
      <div className="flex flex-wrap items-center gap-x-4">
        {readOnly ? null : <SortedForm e={e} month={month} />}
        {seeHref ? (
          <Link href={seeHref} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-nets-blue-hover">
            See the {e.day ? shortDay(e.day) : ''} payments
          </Link>
        ) : null}
      </div>
      <p className="text-[13px] text-ink-3">
        {EXCEPTION_KINDS[e.type].tech}
        {e.channel ? ` · ${CHANNEL_LABELS[e.channel]}` : ''}
      </p>
    </li>
  )
}

export default async function ReconciliationPage({ searchParams }) {
  // The merchant comes only from the session, never from the address.
  const merchant = await requirePage('/reconciliation')
  const sp = await searchParams
  const today = sgtDate(new Date().toISOString())
  const current = today.slice(0, 7)
  const lastComplete = addMonths(monthStart(today), -1).slice(0, 7)
  const asked = Array.isArray(sp?.month) ? sp.month[0] : sp?.month
  const month = typeof asked === 'string' && MONTH_RE.test(asked) && asked >= FIRST_MONTH && asked <= current ? asked : lastComplete

  /** @type {string[]} */
  const months = []
  for (let m = current; m >= FIRST_MONTH; m = addMonths(`${m}-01`, -1).slice(0, 7)) months.push(m)

  const run = await getLatestRunForMonth(merchant.id, month)
  const view = run ? buildRunView(run) : null

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div>
        <h1 className="text-[28px] leading-tight font-bold">Check-up</h1>
        <p className="mt-1 text-[14px] text-ink-3">Reconciliation · we compare your payments, your bank deposits and your NETS bill</p>
      </div>
      <MerchantWideNote />

      {sp?.notice === 'month' ? (
        <p role="alert" className="rounded-lg bg-bad-bg px-4 py-3 text-[15px] font-medium text-bad">
          That month is not available. Please pick a month from the list.
        </p>
      ) : null}

      <section aria-label="Choose a month" className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="month" className="text-[14px] font-medium text-ink-2">Month</label>
            <select id="month" name="month" defaultValue={month} className="min-h-11 min-w-[11rem] rounded-lg border border-line-strong bg-white px-3 text-[15px]">
              {months.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>
          <button type="submit" className={linkBtn}>Show</button>
        </form>
        {merchant.readOnly ? (
          <p data-testid="view-only" className="rounded-lg bg-mute-bg px-3.5 py-3 text-[14px] text-ink-2 sm:max-w-[26rem]">
            <span className="font-semibold text-ink">View only.</span> Head office can see {merchant.tradingName}'s check-ups. The franchisee runs and sorts them.
          </p>
        ) : (
          <RunCheckup month={month} label={run ? 'Check again' : 'Run check-up'} />
        )}
      </section>

      {!view || !run ? (
        <Panel title={monthLabel(month)}>
          <EmptyState>
            {merchant.readOnly ? (
              <>{merchant.tradingName} has not run a check-up for {monthLabel(month)} yet.</>
            ) : (
              <>No check-up has been run for {monthLabel(month)} yet. Press &quot;Run check-up&quot; to compare your sales with your bank deposits and your bill.</>
            )}
          </EmptyState>
        </Panel>
      ) : view.isEmpty ? (
        <Panel title={monthLabel(month)}>
          <EmptyState>Nothing to check for this month yet.</EmptyState>
        </Panel>
      ) : (
        <>
          <section aria-label="Result" className="rounded-[12px] border border-line bg-white p-4 shadow-panel sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[20px] leading-snug font-semibold">{view.headline}</p>
                <p className="mt-1 text-[14px] text-ink-2">
                  {run.matchedCount} of {view.checked} matched ({view.matchPercent}). Last checked {formatWhen(run.runAt)}.
                  <CheckedIn runId={run.id} />
                  {view.openCount > 0 ? ` ${view.openCount} still open.` : ' Everything is sorted.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={view.openCount === 0 ? 'ok' : 'warn'}>{view.matchPercent} match</Pill>
                <a className={linkBtn} href={`/api/export/recon?run=${run.id}&format=xlsx`}>Download Excel</a>
                <a className={linkBtn} href={`/api/export/recon?run=${run.id}&format=pdf`}>Download PDF</a>
              </div>
            </div>
          </section>

          {view.groups.map((g) => (
            <Panel key={g.type} title={`${g.title} (${g.items.length})`} tech={g.tech}>
              <ul className="-mx-4 m-0 -mb-4 list-none p-0 sm:-mx-5 sm:-mb-5">
                {g.items.map((e) => (
                  <ExceptionCard key={e.id} e={e} month={month} mid={merchant.mid} readOnly={merchant.readOnly} />
                ))}
              </ul>
            </Panel>
          ))}

          {view.resolved.length > 0 ? (
            <Panel title={`Sorted (${view.resolved.length})`} tech="Resolved">
              <ul className="m-0 list-none p-0">
                {view.resolved.map((e) => (
                  <li key={e.id} className="flex flex-col gap-1 border-t border-line py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 text-ink-2">
                      <p className="text-[15px]">{e.message}</p>
                      {e.note ? <p className="text-[13px] text-ink-3">Note: {e.note}</p> : null}
                    </div>
                    <Pill tone="ok">Sorted</Pill>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          {view.failed ? (
            <Panel title="Failed payments" tech="Not a bank problem">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[15px] text-ink-2">{view.failed.text}</p>
                <Link href={view.failed.href} className={linkBtn}>See failed payments</Link>
              </div>
            </Panel>
          ) : null}

          {view.openCount === 0 && view.groups.length === 0 ? (
            <Panel title="All clear">
              <EmptyState>Everything for {monthLabel(month)} matches or has been sorted.</EmptyState>
            </Panel>
          ) : null}
        </>
      )}
    </div>
  )
}
