'use client'

/**
 * A row of filter chips ("All", "NETS QR", ... or "All", "Lower fees", ...). The pressed chip is blue.
 * Used by the Promotions and Offers pages.
 * @param {{chips: {value: string, label: string}[], value: string, onChange: (value: string) => void, label: string}} props
 */
export function FilterChips({ chips, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {chips.map((c) => {
        const on = value === c.value
        return (
          <button
            key={c.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(c.value)}
            className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3.5 text-[14px] font-semibold transition-colors duration-[140ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-nets-blue ${
              on ? 'border-nets-blue bg-nets-blue-soft text-info' : 'border-line-strong bg-white text-ink-2 hover:border-ink-3'
            }`}
          >
            {c.label}
          </button>
        )
      })}
    </div>
  )
}
