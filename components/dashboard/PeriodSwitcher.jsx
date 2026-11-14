import Link from 'next/link'

const OPTIONS = [
  { kind: 'today', label: 'Today' },
  { kind: 'week', label: 'This week' },
  { kind: 'month', label: 'This month' },
]

/**
 * Today / This week / This month, as links so the choice lives in the address (?period=).
 * @param {{current: 'today' | 'week' | 'month'}} props
 */
export function PeriodSwitcher({ current }) {
  return (
    <nav aria-label="Time period" className="inline-flex rounded-lg border border-line-strong bg-white p-0.5 shadow-panel">
      {OPTIONS.map((o) => {
        const active = o.kind === current
        return (
          <Link
            key={o.kind}
            href={o.kind === 'week' ? '/' : `/?period=${o.kind}`}
            aria-current={active ? 'true' : undefined}
            className={`inline-flex min-h-11 items-center rounded-md px-3.5 text-[15px] font-semibold no-underline sm:px-4 ${
              active ? 'bg-nets-blue-soft text-info' : 'text-ink-2 hover:bg-page'
            }`}
          >
            {o.label}
          </Link>
        )
      })}
    </nav>
  )
}
