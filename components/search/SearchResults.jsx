'use client'

import { Loader2 } from 'lucide-react'

const PILL = {
  ok: 'bg-ok-bg text-ok',
  bad: 'bg-bad-bg text-bad',
  mute: 'bg-mute-bg text-mute',
}

/**
 * What a search shows under the box (desktop) or in the sheet (phone): rows, a "See all" row, or a plain
 * message. Rows and the footer are listbox options so a screen reader can follow the highlight.
 * @param {{
 *   q: string,
 *   state: import('./useTxnSearch').SearchState,
 *   rows: import('./useTxnSearch').Suggestion[],
 *   highlight: number,
 *   idPrefix: string,
 *   large?: boolean,
 *   showOutlet?: boolean,
 *   onPick: (id: string) => void,
 *   onSeeAll: () => void,
 *   onHover?: (index: number) => void
 * }} props
 */
export function SearchResults({ q, state, rows, highlight, idPrefix, large = false, showOutlet = true, onPick, onSeeAll, onHover }) {
  const text = q.trim()

  return (
    <div>
      {state === 'loading' ? (
        <p className="flex items-center gap-2 px-4 py-4 text-[15px] text-ink-2">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Searching…
        </p>
      ) : null}

      {state === 'error' ? (
        <p role="alert" className="px-4 py-4 text-[15px] text-bad">
          Search isn&apos;t working right now. Please try again.
        </p>
      ) : null}

      {state === 'empty' ? (
        <p className="px-4 py-4 text-[15px] text-ink-2">
          No payments match &lsquo;{text}&rsquo;. Try an amount like 12.50 or the start of a reference.
        </p>
      ) : null}

      {state === 'ok' ? (
        <ul id={`${idPrefix}-list`} role="listbox" aria-label="Matching payments" className="m-0 list-none p-0">
          {rows.map((r, i) => (
            <li
              key={r.id}
              id={`${idPrefix}-opt-${i}`}
              role="option"
              aria-selected={highlight === i}
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => onHover?.(i)}
              onClick={() => onPick(r.id)}
              className={`grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 border-b border-line px-4 py-2.5 aria-selected:bg-nets-blue-soft ${
                large ? 'min-h-16 py-3' : ''
              }`}
            >
              <span className="min-w-0 text-[15px] font-semibold text-ink">{r.when}</span>
              <span className="text-right text-[15px] font-semibold whitespace-nowrap tabular-nums text-ink">{r.amount}</span>
              <span className="min-w-0 truncate text-[13px] text-ink-2">
                {r.how}{showOutlet ? ` · ${r.outlet}` : ''}
              </span>
              <span className="text-right">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-[2px] text-[12px] leading-snug font-semibold whitespace-nowrap ${PILL[r.pill.tone]}`}
                >
                  {r.pill.label}
                </span>
              </span>
            </li>
          ))}
          <li
            id={`${idPrefix}-opt-${rows.length}`}
            role="option"
            aria-selected={highlight === rows.length}
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={() => onHover?.(rows.length)}
            onClick={onSeeAll}
            className={
              large
                ? 'm-3 flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-line-strong bg-white px-4 text-[15px] font-semibold text-nets-blue'
                : 'flex min-h-11 cursor-pointer items-center px-4 text-[15px] font-semibold text-nets-blue aria-selected:bg-nets-blue-soft'
            }
          >
            See all results for &lsquo;{text}&rsquo;
          </li>
        </ul>
      ) : null}
    </div>
  )
}
