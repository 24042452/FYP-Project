import Link from 'next/link'
import { CHANNELS, CHANNEL_LABELS } from '@/lib/channels'
import { monthStart } from '@/lib/dates'
import { buildHref } from '@/lib/transactions/params'

const RESULTS = [
  { value: null, label: 'All' },
  { value: 'success', label: 'Went through' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
]

const field =
  'min-h-11 rounded-lg border border-line-strong bg-white px-3 text-[15px] text-ink focus:border-nets-blue focus:outline-none focus:ring-3 focus:ring-nets-blue-soft'

/**
 * Filters live in the address (GET form + links), so they work without JavaScript and can be bookmarked.
 * @param {{params: import('@/lib/transactions/params').TxnParams, today: string}} props
 */
export function TxnFilters({ params: p, today }) {
  const presets = [
    { label: 'Today', from: today, to: today },
    { label: 'Last 7 days', from: null, to: null },
    { label: 'This month', from: monthStart(today), to: today },
  ]
  const activePreset = !p.explicit.from
    ? 'Last 7 days'
    : p.from === today && p.to === today
      ? 'Today'
      : p.from === monthStart(today) && p.to === today
        ? 'This month'
        : null

  return (
    <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5">
      <form action="/transactions" method="get" className="flex flex-wrap items-end gap-3">
        {p.explicit.status ? <input type="hidden" name="status" value={p.explicit.status} /> : null}
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[13px] font-semibold text-ink-2">
          Find a payment
          <input
            type="search"
            name="q"
            defaultValue={p.explicit.q ?? ''}
            maxLength={40}
            placeholder="Amount like 12.50, or a reference"
            className={`${field} font-normal`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2 max-sm:flex-1">
          From
          <input type="date" name="from" defaultValue={p.from} max={today} className={`${field} font-normal`} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2 max-sm:flex-1">
          To
          <input type="date" name="to" defaultValue={p.to} max={today} className={`${field} font-normal`} />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold text-ink-2 max-sm:w-full">
          How paid
          <select name="channel" defaultValue={p.explicit.channel ?? ''} className={`${field} font-normal`}>
            <option value="">Any way of paying</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-nets-blue px-5 text-[15px] font-semibold text-white hover:bg-nets-blue-hover max-sm:w-full"
        >
          Apply
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <nav aria-label="Result" className="inline-flex max-w-full flex-wrap rounded-lg border border-line-strong bg-white p-0.5">
          {RESULTS.map((r) => {
            const active = (p.explicit.status ?? null) === r.value
            return (
              <Link
                key={r.label}
                href={buildHref(p, { status: r.value, id: null })}
                aria-current={active ? 'true' : undefined}
                className={`inline-flex min-h-11 items-center rounded-md px-3 text-[14px] font-semibold no-underline ${
                  active ? 'bg-nets-blue-soft text-info' : 'text-ink-2 hover:bg-page'
                }`}
              >
                {r.label}
              </Link>
            )
          })}
        </nav>
        <nav aria-label="Dates" className="flex flex-wrap items-center gap-1">
          {presets.map((d) => (
            <Link
              key={d.label}
              href={buildHref(p, { from: d.from, to: d.to, id: null })}
              aria-current={activePreset === d.label ? 'true' : undefined}
              className={`inline-flex min-h-11 items-center rounded-md px-3 text-[14px] font-semibold no-underline ${
                activePreset === d.label ? 'bg-nets-blue-soft text-info' : 'text-ink-2 hover:bg-page'
              }`}
            >
              {d.label}
            </Link>
          ))}
        </nav>
        {Object.keys(p.explicit).length > 0 ? (
          <Link href="/transactions" className="inline-flex min-h-11 items-center text-[14px] font-semibold">
            Clear filters
          </Link>
        ) : null}
      </div>
    </div>
  )
}
