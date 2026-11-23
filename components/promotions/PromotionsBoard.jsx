'use client'

import { useCallback, useRef, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/Panel'
import { RunningCard } from './RunningCard'
import { PromotionCards } from './PromotionCards'
import { TakeUpPanel } from './TakeUpPanel'

/** @typedef {ReturnType<typeof import('@/lib/promotions/view').buildPromotionsPage>} PageView */

/**
 * "Running now" and "Promotions you can start", with the Take up panel. Everything happens on the page:
 * Take up opens the panel; after starting, the panel closes, the new promotion slides into Running now and a
 * status line says until when it runs. Stopping (asked in place) shows its answer on the same line.
 * @param {{running: PageView['running'], cards: PageView['cards'], chips: PageView['chips'], picker: boolean}} props
 */
export function PromotionsBoard({ running, cards, chips, picker }) {
  const [message, setMessage] = useState(/** @type {string | null} */ (null))
  const [panelKey, setPanelKey] = useState(/** @type {string | null} */ (null))
  const [open, setOpen] = useState(false)
  const [openCount, setOpenCount] = useState(0)
  const statusRef = useRef(/** @type {HTMLParagraphElement | null} */ (null))
  // Runs on screen when the page first showed; any other run is new (just taken up) and slides in.
  const firstIds = useRef(new Set(running.map((r) => r.id)))

  const card = cards.find((c) => c.key === panelKey) ?? null

  const say = useCallback((/** @type {string} */ msg) => {
    setMessage(msg)
    requestAnimationFrame(() => statusRef.current?.focus({ preventScroll: true }))
  }, [])
  const onStarted = useCallback(
    (/** @type {string} */ msg) => {
      setOpen(false)
      say(msg)
    },
    [say],
  )

  return (
    <>
      <section aria-labelledby="running-h" className="flex min-w-0 flex-col gap-3">
        <h2 id="running-h" className="text-[17px] font-semibold">
          Running now
        </h2>
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          data-testid="promotions-status"
          className={message ? 'flex items-start gap-2 text-[15px] font-medium text-ok outline-none' : 'sr-only'}
        >
          {message ? <CheckCircle2 className="mt-0.5 size-4 flex-none" aria-hidden="true" /> : null}
          {message}
        </p>
        {running.length === 0 ? (
          <EmptyState>Nothing running. Pick one below.</EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {running.map((r) => (
              <RunningCard key={r.id} r={r} onStopped={say} className={firstIds.current.has(r.id) ? '' : 'promo-in'} />
            ))}
          </div>
        )}
      </section>

      <PromotionCards
        cards={cards}
        chips={chips}
        onTakeUp={(key) => {
          setPanelKey(key)
          setOpenCount((n) => n + 1)
          setOpen(true)
        }}
      />

      <TakeUpPanel card={card} open={open} openCount={openCount} picker={picker} onOpenChange={setOpen} onStarted={onStarted} />
    </>
  )
}
