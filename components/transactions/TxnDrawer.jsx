'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

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
 * @param {{detail: ReturnType<import('@/lib/transactions/format').toDetailView>, closeHref: string}} props
 */
export function TxnDrawer({ detail, closeHref }) {
  const router = useRouter()
  return (
    <Sheet open onOpenChange={(open) => { if (!open) router.push(closeHref, { scroll: false }) }}>
      <SheetContent side="right" className="data-[side=right]:w-full data-[side=right]:sm:max-w-md overflow-y-auto">
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
