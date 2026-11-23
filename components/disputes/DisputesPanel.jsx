'use client'

import { useCallback, useRef, useState } from 'react'
import { EmptyState } from '@/components/dashboard/Panel'
import { DisputeCase } from './DisputeCase'
import { ClosedList } from './ClosedList'

/**
 * The Disputes panel: open and waiting disputes as cases, then the closed ones as a short list. A dispute
 * answered on this visit stays in its case (with its moved-on track and confirmation line) instead of
 * jumping into the closed list, so the person sees what their answer did.
 * @param {{
 *   cases: import('@/lib/disputes/view').DisputeView[], closed: import('@/lib/disputes/view').DisputeView[],
 *   canRespond: boolean,
 * }} props
 */
export function DisputesPanel({ cases, closed, canRespond }) {
  const [answered, setAnswered] = useState(/** @type {string[]} */ ([]))
  const order = useRef(cases.map((c) => c.id))
  const onKeep = useCallback((/** @type {string} */ id) => setAnswered((a) => (a.includes(id) ? a : [...a, id])), [])

  const kept = closed.filter((c) => answered.includes(c.id))
  const rank = (/** @type {string} */ id) => {
    const i = order.current.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const shownCases = [...cases, ...kept].sort((a, b) => rank(a.id) - rank(b.id))
  const shownClosed = closed.filter((c) => !answered.includes(c.id))

  return (
    <section aria-labelledby="disputes-h" className="min-w-0 rounded-[12px] border border-line bg-white shadow-panel">
      <div className="px-4 pt-4 sm:px-5 sm:pt-[18px]">
        <h2 id="disputes-h" className="text-[17px] font-semibold">
          Disputes <span className="ml-1 text-[13px] font-normal text-ink-3">Chargebacks</span>
        </h2>
      </div>
      {shownCases.length === 0 && shownClosed.length === 0 ? (
        <div className="p-4 sm:p-5">
          <EmptyState>No disputes. When a customer&apos;s bank asks for money back, it shows here with what to do.</EmptyState>
        </div>
      ) : (
        <>
          {shownCases.length > 0 ? (
            <div className="mt-1">
              {shownCases.map((d) => (
                <DisputeCase key={d.id} d={d} canRespond={canRespond} onKeep={onKeep} />
              ))}
            </div>
          ) : (
            <p className="px-4 pt-2 pb-3 text-[15px] text-ink-2 sm:px-5">Nothing open. Your finished disputes are below.</p>
          )}
          <ClosedList items={shownClosed} />
        </>
      )}
    </section>
  )
}
