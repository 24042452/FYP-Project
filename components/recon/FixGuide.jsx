'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'

/**
 * "How to fix this" inside a check-up problem: a bar that opens the numbered steps in place. The steps slide
 * open (no motion when the device asks for less). "Copy details" puts everything NETS needs on the clipboard.
 * @param {{guide: import('@/lib/recon/guide').Guide}} props
 */
export function FixGuide({ guide }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="mt-3 rounded-[10px] border border-nets-blue-soft" data-testid="fix-guide">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={
          'flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 bg-nets-blue-soft px-3.5 text-left text-[15px] font-semibold text-nets-blue-hover hover:brightness-[0.97] ' +
          (open ? 'rounded-t-[9px]' : 'rounded-[9px]')
        }
      >
        How to fix this
        <span aria-hidden="true" className={'text-[12px] transition-transform duration-200 motion-reduce:transition-none ' + (open ? 'rotate-180' : '')}>▼</span>
      </button>
      <div
        id={id}
        className={'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ' + (open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-3.5 pt-3 pb-3">
            <p className="m-0 rounded-lg bg-warn-bg px-3 py-2.5 text-[14px] text-warn">
              <span className="font-semibold">Why this happens:</span> {guide.why}
            </p>
            <ol className="m-0 mt-1 list-none p-0">
              {guide.steps.map((s, i) => (
                <li key={s.title} className="relative border-t border-line py-2.5 pl-10 text-[15px] leading-snug first:border-t-0">
                  <span aria-hidden="true" className="absolute top-2.5 left-0 grid size-[26px] place-items-center rounded-full bg-nets-blue-soft text-[13px] font-bold text-nets-blue-hover">
                    {i + 1}
                  </span>
                  <span className="sr-only">Step {i + 1}: </span>
                  <span className="font-semibold">{s.title}</span>
                  {s.text ? <span className="mt-0.5 block text-[14px] text-ink-2">{s.text}</span> : null}
                  {s.link ? (
                    <Link href={s.link.href} className="mt-1 inline-flex min-h-11 items-center text-[14px] font-semibold text-nets-blue-hover sm:min-h-0">
                      {s.link.label} →
                    </Link>
                  ) : null}
                  {s.details ? (
                    <>
                      <dl className="m-0 mt-2 grid grid-cols-1 gap-x-3 gap-y-0.5 rounded-lg border border-line bg-page px-3 py-2.5 text-[13px] sm:grid-cols-[auto_minmax(0,1fr)] [&>div:first-child>dt]:mt-0">
                        {s.details.map((d) => (
                          <div key={d.label} className="contents">
                            <dt className="mt-1.5 text-ink-3 sm:mt-0">{d.label}</dt>
                            <dd className="m-0 font-semibold break-words tabular-nums">{d.value}</dd>
                          </div>
                        ))}
                      </dl>
                      {guide.copyText ? <CopyButton text={guide.copyText} /> : null}
                    </>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

/** @param {{text: string}} props */
function CopyButton({ text }) {
  const [state, setState] = useState(/** @type {'idle' | 'copied' | 'failed'} */ ('idle'))
  const timer = useRef(/** @type {ReturnType<typeof setTimeout> | undefined} */ (undefined))
  useEffect(() => () => clearTimeout(timer.current), [])
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('failed')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setState('idle'), 2500)
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center rounded-lg border border-line-strong bg-white px-4 text-[14px] font-semibold text-ink-2 hover:bg-page"
      >
        {state === 'copied' ? 'Copied ✓' : 'Copy details'}
      </button>
      <span role="status" className="text-[13px] text-ink-3">
        {state === 'copied' ? 'Paste them into your email or chat to NETS.' : state === 'failed' ? 'Could not copy. Please select the details above and copy them.' : ''}
      </span>
    </div>
  )
}
