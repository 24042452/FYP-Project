/**
 * The 3-step track of a dispute: Customer disputed, Your answer, NETS decides. Done steps are blue; the
 * current step has a red ring while it is the merchant's turn and a blue ring while NETS decides.
 * Colours and the line fill change with a short transition when the dispute moves on (after Accept or
 * Decline), and not at all when the device asks for less motion. Across on desktop, down on phones.
 * @param {{steps: {label: string, sub: string, state: 'done' | 'now' | 'wait' | 'todo'}[]}} props
 */
export function Track({ steps }) {
  const ease = 'duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none'
  return (
    <ol aria-label="Where this dispute is" className="m-0 mt-3.5 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-3 sm:gap-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        const filled = s.state === 'done'
        return (
          <li
            key={s.label + i}
            data-state={s.state}
            className="relative flex flex-col gap-0.5 pl-[26px] text-[13px] text-ink-2 sm:pt-[22px] sm:pr-2 sm:pl-0 sm:text-[14px]"
          >
            {last ? null : (
              <span
                aria-hidden="true"
                className="absolute top-4 -bottom-3 left-1.5 w-0.5 overflow-hidden bg-line-strong sm:top-[7px] sm:right-0 sm:bottom-auto sm:left-0 sm:h-0.5 sm:w-auto"
              >
                <span
                  className={`block size-full origin-top bg-nets-blue transition-transform sm:origin-left ${ease} ${
                    filled ? 'scale-100' : 'max-sm:scale-y-0 sm:scale-x-0'
                  }`}
                />
              </span>
            )}
            <span
              aria-hidden="true"
              className={`absolute top-0.5 left-0 size-3.5 rounded-full border-2 transition-[background-color,border-color,box-shadow] sm:top-px ${ease} ${
                s.state === 'done'
                  ? 'border-nets-blue bg-nets-blue'
                  : s.state === 'now'
                    ? 'border-nets-red bg-white shadow-[0_0_0_4px_var(--nets-red-soft)]'
                    : s.state === 'wait'
                      ? 'border-nets-blue bg-white shadow-[0_0_0_4px_var(--nets-blue-soft)]'
                      : 'border-line-strong bg-white'
              }`}
            />
            <b
              className={`font-semibold transition-colors ${ease} ${
                s.state === 'now' ? 'text-bad' : s.state === 'wait' ? 'text-info' : 'text-ink'
              }`}
            >
              {s.label}
              <span className="sr-only">
                {s.state === 'done' ? ' (done)' : s.state === 'now' ? ' (your turn)' : s.state === 'wait' ? ' (in progress)' : ' (not yet)'}
              </span>
            </b>
            {s.sub ? <span>{s.sub}</span> : null}
          </li>
        )
      })}
    </ol>
  )
}
