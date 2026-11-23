'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useReducedMotion } from '@/components/dashboard/use-reduced-motion'

/** How long the drawer takes to slide in or out (keep in step with the duration classes below). */
const SLIDE_MS = 300

const PILL = {
  ok: 'bg-ok-bg text-ok',
  bad: 'bg-bad-bg text-bad',
  mute: 'bg-mute-bg text-mute',
}
const BOX = {
  bad: 'bg-bad-bg text-bad',
  info: 'bg-info-bg text-info',
  ok: 'bg-ok-bg text-ok',
}

/**
 * Payment details. Open whenever the address has ?id=; closing goes to `closeHref` (same page
 * without id). The page only renders this for a payment that belongs to the merchant.
 *
 * Closing first lets the drawer slide out to the right, and only then changes the address
 * (changing it straight away would remove the drawer before its exit animation could play).
 * With reduced motion the drawer closes at once.
 * `moreHref`/`moreLabel` add a link to the full page (used where the panel opens on another page, e.g. Refunds & disputes).
 * @param {{detail: ReturnType<import('@/lib/transactions/format').toDetailView>, closeHref: string, moreHref?: string, moreLabel?: string}} props
 */
export function TxnDrawer({ detail, closeHref, moreHref, moreLabel }) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(true)
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))

  // A different payment opened while this one is showing: show it open again.
  const [shownId, setShownId] = useState(detail.id)
  if (shownId !== detail.id) {
    setShownId(detail.id)
    setOpen(true)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  /** @param {boolean} next */
  function onOpenChange(next) {
    if (next || !open) return
    setOpen(false)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => router.push(closeHref, { scroll: false }), reduceMotion ? 0 : SLIDE_MS)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md data-[side=right]:data-open:slide-in-from-right-full data-[side=right]:data-closed:slide-out-to-right-full data-open:duration-300 data-closed:duration-300 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
      >
        <>
            <SheetHeader className="gap-2 border-b border-line p-5 pr-14">
              <span className={`inline-flex w-fit items-center rounded-full px-3 py-[3px] text-[13px] font-semibold ${PILL[detail.pill.tone]}`}>
                {detail.pill.label}
              </span>
              <SheetTitle className="text-[32px] leading-tight font-semibold tabular-nums">{detail.amount}</SheetTitle>
              <SheetDescription className="text-[15px]">{detail.when}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-3 px-5">
              <h3 className="text-base font-semibold">What happened</h3>
              <p className={`rounded-lg px-3.5 py-3 text-[15px] ${BOX[detail.plainTone]}`}>{detail.plain}</p>
              {detail.action ? (
                <p className="rounded-lg bg-info-bg px-3.5 py-3 text-[15px] text-info">
                  <b>What to do:</b> {detail.action}
                </p>
              ) : null}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 px-5 py-2 text-[15px]">
              {detail.kv.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="text-right font-medium break-words tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            {moreHref ? (
              <div className={`px-5 ${detail.assistantHref ? '' : 'pb-6'}`}>
                <Link
                  href={moreHref}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line-strong bg-white px-4 text-[15px] font-semibold text-ink no-underline shadow-panel hover:border-ink-3"
                >
                  {moreLabel ?? 'Open the full page'}
                </Link>
              </div>
            ) : null}
            {detail.assistantHref ? (
              <div className="px-5 pb-6">
                <Link
                  href={detail.assistantHref}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line-strong bg-white px-4 text-[15px] font-semibold text-ink no-underline shadow-panel hover:border-ink-3"
                >
                  Ask the assistant about this
                </Link>
              </div>
            ) : null}
        </>
      </SheetContent>
    </Sheet>
  )
}
