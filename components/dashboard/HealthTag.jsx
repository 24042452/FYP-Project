'use client'

import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { Pill } from './Pill'
import { useReducedMotion } from './use-reduced-motion'

const TONES = {
  ok: 'bg-ok-bg text-ok',
  bad: 'bg-bad-bg text-bad',
  warn: 'bg-warn-bg text-warn',
}
const RESULT = {
  ok: 'border-ok bg-ok-bg text-ok',
  warn: 'border-warn bg-warn-bg text-warn',
  bad: 'border-bad bg-bad-bg text-bad',
}

const lowerFirst = (/** @type {string} */ s) => s.charAt(0).toLowerCase() + s.slice(1)

/** @param {{label: string, detail: string, points: number}} f */
function factorSentence(f) {
  const n = Math.abs(f.points)
  const pts = `${n} ${n === 1 ? 'point' : 'points'}`
  const change = f.points < 0 ? `minus ${pts}` : f.points > 0 ? `plus ${pts}` : 'no change'
  return `${f.label}: ${lowerFirst(f.detail)}, ${change}`
}

/**
 * The tags row, where the "Business health" tag is a button. It opens a full-width card just below the row
 * that shows how the score was worked out as a sum (a stacked list on phones). Closes on Escape, a click
 * outside, or Close; focus moves into the card and back to the tag.
 * @param {{tags: {label: string, tone: 'ok' | 'bad' | 'info' | 'warn' | 'mute',
 *   health?: {score: number, label: string, factors: {label: string, detail: string, points: number}[]}}[]}} props
 */
export function HealthTag({ tags }) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false) // in the page (kept a moment after closing so it can fade)
  const [shown, setShown] = useState(false) // expanded
  const btn = useRef(/** @type {HTMLButtonElement | null} */ (null))
  const card = useRef(/** @type {HTMLDivElement | null} */ (null))
  const id = useId()

  // Open: mount first, then expand on the next frame. Close: collapse, then unmount after the fade.
  useEffect(() => {
    if (open) {
      setMounted(true)
      if (reduced) {
        setShown(true)
        return
      }
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }
    setShown(false)
    if (reduced) {
      setMounted(false)
      return
    }
    const t = window.setTimeout(() => setMounted(false), 220)
    return () => window.clearTimeout(t)
  }, [open, reduced])

  useEffect(() => {
    if (shown) card.current?.focus()
  }, [shown])

  useEffect(() => {
    if (!open) return
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
      if (!card.current?.contains(t) && !btn.current?.contains(t)) setOpen(false)
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

  const healthTag = tags.find((t) => t.health)
  const health = healthTag?.health

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((t) =>
          t.health ? (
            <button
              key="health"
              ref={btn}
              type="button"
              aria-expanded={open}
              aria-controls={open ? id : undefined}
              onClick={() => setOpen((o) => !o)}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nets-blue"
            >
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-[3px] text-[13px] leading-snug font-semibold underline decoration-dotted underline-offset-2 ${TONES[/** @type {'ok' | 'warn' | 'bad'} */ (t.tone)] ?? TONES.warn}`}
              >
                {t.label}
                <span aria-hidden="true" className="text-[11px]">{open ? '▴' : '▾'}</span>
              </span>
            </button>
          ) : (
            <Pill key={t.label} tone={t.tone}>
              {t.label}
            </Pill>
          ),
        )}
      </div>

      {mounted && health && healthTag ? (
        <div className="health-wrap" data-open={shown}>
          <div className="min-h-0 overflow-hidden">
            <div
              ref={card}
              id={id}
              role="region"
              aria-labelledby={`${id}-title`}
              tabIndex={-1}
              data-testid="health-panel"
              className="rounded-[12px] border border-line bg-white p-4 shadow-panel outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-nets-blue sm:p-5"
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

              <ol className="mt-2 flex flex-col divide-y divide-line sm:mt-3 sm:grid sm:grid-cols-3 sm:gap-3 sm:divide-y-0 xl:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] xl:items-stretch">
                <Box testId="health-box" className="sm:bg-page">
                  <span className="sr-only">Starting score: 75</span>
                  <Visible label="Starting score" detail="We start here" value="75" valueClass="text-ink" />
                </Box>
                {health.factors.map((f) => {
                  const sign = f.points < 0 ? '−' : '+'
                  return (
                    <Fragment key={f.label}>
                      <Op>{sign}</Op>
                      <Box testId="health-box" factor>
                        <span className="sr-only">{factorSentence(f)}</span>
                        <Visible
                          label={f.label}
                          detail={f.detail}
                          value={String(Math.abs(f.points))}
                          valueClass={f.points < 0 ? 'text-bad' : f.points > 0 ? 'text-ok' : 'text-mute'}
                          prefix={f.points === 0 ? '' : sign}
                        />
                      </Box>
                    </Fragment>
                  )
                })}
                <Op>=</Op>
                <Box testId="health-box" className={`sm:border ${RESULT[/** @type {'ok' | 'warn' | 'bad'} */ (healthTag.tone)] ?? RESULT.warn}`}>
                  <span className="sr-only">{`Business health: ${health.score} out of 100, ${health.label}`}</span>
                  <Visible label="Business health" detail={health.label} value={String(health.score)} valueClass="" detailBelow />
                </Box>
              </ol>

              <p className="mt-3 border-t border-line pt-3 text-[13px] text-ink-2 sm:mt-4">Scores of 70 or more are healthy.</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

/** Operator between boxes: only on wide screens, where the five boxes sit in one row. */
function Op({ children }) {
  return (
    <li aria-hidden="true" className="hidden items-center justify-center text-2xl font-semibold text-ink-3 xl:flex">
      {children}
    </li>
  )
}

/** One box of the sum. A row on phones, a card from 640 px. */
function Box({ children, testId, factor = false, className = '' }) {
  return (
    <li
      data-testid={testId}
      {...(factor ? { 'data-factor': 'true' } : {})}
      className={`flex items-start justify-between gap-3 py-2.5 sm:flex-col sm:justify-start sm:gap-1 sm:rounded-[10px] sm:border sm:border-line sm:p-3 sm:py-3 ${className}`}
    >
      {children}
    </li>
  )
}

/** The visible text of a box (hidden from screen readers, which get the sentence instead). */
function Visible({ label, detail, value, valueClass, prefix = '', detailBelow = false }) {
  return (
    <>
      <div aria-hidden="true" className="min-w-0 sm:order-1">
        <p className="text-[13px] leading-snug font-medium text-ink-2">{label}</p>
        {detailBelow ? null : <p className="text-[13px] leading-snug text-ink-2">{detail}</p>}
      </div>
      <p
        aria-hidden="true"
        className={`shrink-0 text-[17px] leading-none font-semibold tabular-nums sm:order-2 sm:mt-auto sm:pt-1 sm:text-2xl ${valueClass}`}
      >
        {prefix ? <span className="xl:hidden">{prefix}</span> : null}
        {value}
      </p>
      {detailBelow ? (
        <p aria-hidden="true" className="hidden text-[14px] leading-snug font-semibold sm:order-3 sm:block">
          {detail}
        </p>
      ) : null}
    </>
  )
}
