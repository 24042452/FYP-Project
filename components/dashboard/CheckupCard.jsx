import Link from 'next/link'
import { Panel } from './Panel'

/**
 * Where the latest check-up (reconciliation) stands.
 * @param {{checkup: {hasRun: boolean, lastRun: string, summary: string, openCount: number}, caption?: string}} props
 */
export function CheckupCard({ checkup, caption }) {
  return (
    <Panel title="Your latest check-up" tech="Reconciliation" caption={caption}>
      {checkup.hasRun ? (
        <div className="flex flex-col gap-1">
          <p className="text-ink-2">{checkup.lastRun}</p>
          <p className="text-[17px] font-semibold">{checkup.summary}</p>
        </div>
      ) : (
        <p className="text-ink-2">
          No check-up has been run yet. A check-up compares your sales with the money NETS sent to your bank.
        </p>
      )}
      <Link href="/reconciliation" className="mt-3 inline-flex min-h-11 items-center text-[15px] font-semibold">
        {checkup.hasRun ? 'Open your check-up' : 'Go to Check-up'}
      </Link>
    </Panel>
  )
}
