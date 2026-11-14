'use client'

import { useEffect, useId, useRef, useState } from 'react'

const TONES = {
  ok: 'bg-ok-bg text-ok',
  bad: 'bg-bad-bg text-bad',
  warn: 'bg-warn-bg text-warn',
}

/** @param {number} n signed, with a real minus sign */
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0')

/**
 * The "Business health" pill. It is a button: it opens a small panel that shows how the score was worked out.
 * Closes on Escape, a click outside, or the Close button; focus moves into the panel and back to the button.
 * @param {{label: string, tone: 'ok' | 'warn' | 'bad',
 *   health: {score: number, label: string, factors: {label: string, detail: string, points: number}[]}}} props
 */
export function HealthTag({ label, tone, health }) {
  const [open, setOpen] = useState(false)
  const btn = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const panel = useRef(/** @type {HTMLDivElement | null} */ (null))
  const id = useId()

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btn.current?.focus()
      }
    }
    /** @param {PointerEvent} e */
    const onPointer = (e) => {
      const t = /** @type {Node} */ (e.target)
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    btn.current?.focus()
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nets-blue"
      >
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-[3px] text-[13px] leading-snug font-semibold underline decoration-dotted underline-offset-2 ${TONES[tone]}`}
        >
          {label}
          <span aria-hidden="true" className="text-[11px]">{open ? '▴' : '▾'}</span>
        </span>
      </button>
      {open ? (
        <div
          ref={panel}
          id={id}
          role="region"
          aria-labelledby={`${id}-title`}
          tabIndex={-1}
          data-testid="health-panel"
          className="health-panel w-full max-w-full rounded-[12px] border border-line bg-white p-4 shadow-panel outline-none focus-visible:ring-2 focus-visible:ring-nets-blue sm:max-w-[420px]"
        >
          <div className="flex items-start justify-between gap-3">
            <h2 id={`${id}-title`} className="text-[16px] leading-snug font-semibold text-ink">
              How we worked this out
            </h2>
            <button
              type="button"
              onClick={close}
              className="-mt-2 -mr-2 inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-lg text-[14px] font-semibold text-nets-blue hover:bg-nets-blue-soft focus-visible:outline-2 focus-visible:outline-nets-blue"
            >
              Close
            </button>
          </div>
          <p className="mt-1 text-[14px] text-ink-2">We start at 75.</p>
          <ul className="mt-2 divide-y divide-line">
            {health.factors.map((f) => (
              <li key={f.label} data-testid="health-factor" className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[14px] leading-snug font-medium text-ink">{f.label}</p>
                  <p className="text-[13px] leading-snug text-ink-2">{f.detail}</p>
                </div>
                <p
                  className={`shrink-0 text-[15px] font-semibold tabular-nums ${
                    f.points < 0 ? 'text-bad' : f.points > 0 ? 'text-ok' : 'text-mute'
                  }`}
                >
                  {signed(f.points)}
                </p>
              </li>
            ))}
          </ul>
          <p className="border-t border-line pt-3 text-[15px] font-semibold text-ink">
            = {health.score} out of 100 · {health.label}
          </p>
          <p className="mt-1 text-[13px] text-ink-2">Scores of 70 or more are healthy.</p>
        </div>
      ) : null}
    </>
  )
}
