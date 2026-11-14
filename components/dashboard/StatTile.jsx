import Link from 'next/link'

/**
 * One cell of the summary strip.
 * @param {{label: string, value: string, hint?: string, tone?: 'default' | 'attention', href?: string, linkLabel?: string}} props
 */
export function StatTile({ label, value, hint, tone = 'default', href, linkLabel }) {
  const attention = tone === 'attention'
  return (
    <div className="flex flex-col gap-1 px-[18px] py-4 sm:px-[22px] sm:py-5">
      <span className="text-[14px] font-medium text-ink-2">{label}</span>
      <span
        className={`text-[28px] leading-[1.15] font-semibold tracking-[-0.025em] tabular-nums sm:text-[32px] ${attention ? 'text-bad' : 'text-ink'}`}
      >
        {value}
      </span>
      {hint ? <span className="text-[14px] text-ink-2">{hint}</span> : null}
      {href && linkLabel ? (
        <Link href={href} className="inline-flex min-h-11 items-center text-[14px] font-semibold text-bad">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  )
}
