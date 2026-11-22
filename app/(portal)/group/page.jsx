import { requirePage } from '@/lib/data/merchant'
import { getDailySales } from '@/lib/data/sales'
import { getSettlementSummary } from '@/lib/data/settlements'
import { getLatestRunSummary } from '@/lib/data/recon'
import { listOutlets } from '@/lib/data/outlets'
import { periodRange, sgtDate } from '@/lib/dates'
import { summarise } from '@/lib/metrics/summary'
import { buildGroupModel } from '@/lib/group/model'
import { Panel } from '@/components/dashboard/Panel'
import { Pill } from '@/components/dashboard/Pill'
import { ViewFranchiseeButton } from '@/components/group/ViewFranchiseeButton'

export const metadata = { title: 'Group overview · Merchant Portal' }

const TONE_TEXT = { ok: 'text-ok', bad: 'text-bad', mute: 'text-ink-3', warn: 'text-warn' }

/**
 * Head office's overview: every franchisee in the group side by side, this week against the same days last week.
 * The franchisee list comes from the HQ owner's own group (from the session), never from the address, and each
 * franchisee's figures come from the same data functions their own Home page uses.
 */
export default async function GroupPage() {
  const merchant = await requirePage('/group')
  const group = /** @type {NonNullable<typeof merchant.group>} */ (merchant.group)
  const today = sgtDate(new Date().toISOString())
  const r = periodRange('week', today)

  const franchisees = await Promise.all(
    group.franchisees.map(async (f) => {
      const [curr, prev, todayRows, settle, recon, outlets] = await Promise.all([
        getDailySales(f.id, r.from, r.toDate),
        getDailySales(f.id, r.prevFrom, r.prevToDate),
        getDailySales(f.id, today, today),
        getSettlementSummary(f.id, today),
        getLatestRunSummary(f.id),
        listOutlets(f.id),
      ])
      return {
        id: f.id,
        tradingName: f.tradingName,
        outlets: outlets.length,
        currCents: summarise(curr).grossCents,
        prevCents: summarise(prev).grossCents,
        todayCents: summarise(todayRows).grossCents,
        lateCount: settle.lateCount,
        lateCents: settle.lateCents,
        openProblems: recon ? recon.openCount : 0,
      }
    }),
  )
  const m = buildGroupModel({ groupName: group.name, franchisees })

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div>
        <p className="text-[14px] font-medium text-ink-2">Group overview · Head office</p>
        <h1 className="mt-1 text-[26px] leading-tight font-bold sm:text-[28px]" data-testid="group-headline">{m.headline}</h1>
        <p className="mt-1.5 max-w-[60rem] text-[15px] text-ink-2">{m.subline}</p>
      </div>

      <section aria-label="Summary" className="grid grid-cols-1 divide-y divide-line rounded-[12px] border border-line bg-white shadow-panel sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {m.tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-1 px-[18px] py-4 sm:px-[22px] sm:py-5">
            <span className="text-[14px] font-medium text-ink-2">{t.label}</span>
            <span className="text-[28px] leading-[1.15] font-semibold tracking-[-0.025em] tabular-nums sm:text-[32px]">{t.value}</span>
            <span className={`text-[14px] font-medium ${TONE_TEXT[t.tone]}`}>{t.note}</span>
          </div>
        ))}
      </section>

      <Panel title="Franchisees" tech="Merchants in the group" caption={m.best ?? undefined}>
        <ul className="-mx-4 m-0 -mb-4 list-none p-0 sm:-mx-5 sm:-mb-5" data-testid="franchisee-list">
          {m.rows.map((row) => (
            <li key={row.id} className="grid gap-3 border-t border-line px-4 py-4 first:border-t-0 sm:px-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[16px] font-semibold">{row.name}</p>
                  <Pill tone={row.status.tone}>{row.status.label}</Pill>
                </div>
                <p className="mt-0.5 text-[14px] text-ink-3">
                  {row.outlets} · Today {row.today}
                </p>
                {row.issues.length > 0 ? <p className="mt-1 text-[14px] text-warn">{row.issues.join(' · ')}</p> : null}
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[18px] font-semibold tabular-nums">{row.week}</span>
                  <span className={`text-[14px] font-medium ${TONE_TEXT[row.changeTone]}`}>{row.change}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-mute-bg" aria-hidden="true">
                  <div className="h-full rounded-full bg-nets-blue" style={{ width: `${row.sharePct}%` }} />
                </div>
                <p className="mt-1 text-[13px] text-ink-3">{row.sharePct}% of the group this week</p>
              </div>
              <ViewFranchiseeButton id={row.id} name={row.name} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
