import Link from 'next/link'
import { formatSGD } from '@/lib/money'
import { Panel, EmptyState } from './Panel'

/**
 * The signature panel: sales, then NETS fees, then what reaches your bank.
 * @param {{flow: {title: string, hasData: boolean, grossCents: number, feeCents: number, netCents: number, ariaLabel: string}}} props
 */
export function MoneyFlow({ flow }) {
  return (
    <Panel
      title={flow.title}
      action={
        <Link href="/assistant?q=How%20do%20NETS%20fees%20work%3F" className="inline-flex min-h-11 items-center text-[14px] font-semibold">
          How fees work
        </Link>
      }
    >
      {flow.hasData ? (
        <>
          <div role="img" aria-label={flow.ariaLabel} className="flex h-10 gap-0.5 overflow-hidden rounded-md">
            <i className="block bg-nets-blue" style={{ flex: Math.max(flow.netCents, 1) }} />
            {flow.feeCents > 0 ? <i className="block min-w-2.5 bg-nets-red" style={{ flex: flow.feeCents }} /> : null}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-[14px] text-ink-2 sm:gap-6">
            <div className="min-w-0">
              <b className="block text-base font-semibold text-ink tabular-nums sm:text-lg break-words">{formatSGD(flow.grossCents)}</b>
              Your sales
            </div>
            <div className="min-w-0">
              <b className="block text-base font-semibold text-bad tabular-nums sm:text-lg break-words">
                {flow.feeCents > 0 ? `−${formatSGD(flow.feeCents)}` : formatSGD(0)}
              </b>
              NETS fees
            </div>
            <div className="min-w-0">
              <b className="block text-base font-semibold text-ink tabular-nums sm:text-lg break-words">{formatSGD(flow.netCents)}</b>
              To your bank
            </div>
          </div>
        </>
      ) : (
        <EmptyState>No sales yet for this period</EmptyState>
      )}
    </Panel>
  )
}
