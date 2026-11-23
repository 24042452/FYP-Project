'use client'

import { useState } from 'react'
import { Pill } from '@/components/dashboard/Pill'
import { FileLinks, PillIcon } from './FileLinks'

const SHOWN = 10

/**
 * Finished disputes, latest first: what it was, how it ended, and the files sent. Shows the latest 10;
 * "Show all" opens the rest.
 * @param {{items: import('@/lib/disputes/view').DisputeView[]}} props
 */
export function ClosedList({ items }) {
  const [all, setAll] = useState(false)
  if (items.length === 0) return null
  const shown = all ? items : items.slice(0, SHOWN)
  return (
    <div className="border-t border-line px-4 pt-1 pb-4 sm:px-5">
      <h3 className="sr-only">Closed disputes</h3>
      <ul aria-label="Closed disputes" className="m-0 list-none p-0">
        {shown.map((d) => (
          <li
            key={d.id}
            data-testid="closed-dispute"
            className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <span className="block text-[15px] font-semibold tabular-nums">{d.short}</span>
              <span className="block text-[13px] text-ink-3">{d.closedSub}</span>
              {d.files.length > 0 ? <FileLinks files={d.files} label={d.filesSent ?? ''} className="mt-1 text-[13px]" /> : null}
            </div>
            <span className="flex-none">
              <Pill tone={d.pill.tone}>
                <PillIcon icon={d.pill.icon} />
                {d.pill.text}
              </Pill>
            </span>
          </li>
        ))}
      </ul>
      {items.length > SHOWN ? (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          aria-expanded={all}
          className="mt-1 inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2.5 text-[14px] font-semibold text-info hover:bg-nets-blue-soft -ml-2.5"
        >
          {all ? 'Show the latest 10' : `Show all ${items.length}`}
        </button>
      ) : null}
    </div>
  )
}
