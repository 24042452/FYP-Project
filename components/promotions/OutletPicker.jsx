'use client'

import { useState } from 'react'

/** @typedef {{id: string, name: string, can: boolean, ticked: boolean, reason: string | null}} OutletChoice */

/**
 * The ticked outlets of a picker, starting with the outlets that can take it.
 * @param {OutletChoice[]} choices
 */
export function useOutletTicks(choices) {
  const [ticked, setTicked] = useState(() => choices.filter((c) => c.ticked).map((c) => c.id))
  return { ticked, setTicked }
}

/**
 * "Which outlets?": a "Select all" row and one checkbox per outlet (field name `outletIds`). Outlets that
 * cannot take it are greyed out with the reason underneath. Used in the Promotions and Offers take-up panels.
 * @param {{choices: OutletChoice[], ticked: string[], onChange: (ids: string[]) => void, allLabel: string}} props
 */
export function OutletPicker({ choices, ticked, onChange, allLabel }) {
  const free = choices.filter((c) => c.can).map((c) => c.id)
  const allTicked = free.length > 0 && free.every((id) => ticked.includes(id))
  /** @param {string} id @param {boolean} on */
  const tick = (id, on) => onChange(on ? [...new Set([...ticked, id])] : ticked.filter((x) => x !== id))

  const row = 'flex min-h-11 items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[15px]'
  return (
    <fieldset className="mt-2 flex flex-col gap-2">
      <legend className="mb-2 text-base font-[650]">Which outlets?</legend>
      <label className={`${row} cursor-pointer border-line-strong font-semibold`}>
        <input
          type="checkbox"
          checked={allTicked}
          disabled={free.length === 0}
          onChange={(e) => onChange(e.target.checked ? free : [])}
          className="mt-0.5 size-[18px] flex-none accent-nets-blue"
        />
        {allLabel}
      </label>
      {choices.map((c) => {
        const on = ticked.includes(c.id)
        return (
          <label
            key={c.id}
            data-testid="outlet-choice"
            className={`${row} transition-colors duration-[140ms] motion-reduce:transition-none ${
              !c.can
                ? 'cursor-not-allowed border-line bg-page text-ink-2'
                : on
                  ? 'cursor-pointer border-nets-blue bg-nets-blue-soft'
                  : 'cursor-pointer border-line-strong'
            }`}
          >
            <input
              type="checkbox"
              name="outletIds"
              value={c.id}
              checked={c.can && on}
              disabled={!c.can}
              onChange={(e) => tick(c.id, e.target.checked)}
              className="mt-0.5 size-[18px] flex-none accent-nets-blue"
            />
            <span className="min-w-0">
              {c.name}
              {c.reason ? <small className="block text-[13px] text-ink-3">{c.reason}</small> : null}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
