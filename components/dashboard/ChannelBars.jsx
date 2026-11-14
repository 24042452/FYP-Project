/**
 * How customers paid, as shares of sales.
 * @param {{mix: {channel: string, label: string, pct: number}[]}} props
 */
export function ChannelBars({ mix }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
      {mix.map((m) => (
        <li key={m.channel} className="grid grid-cols-[6.5em_1fr_3.2em] items-center gap-3 text-[15px] sm:grid-cols-[8.5em_1fr_3.2em]">
          <span>{m.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-mute-bg" aria-hidden="true">
            <i className="block h-full rounded-full bg-nets-blue" style={{ width: `${m.pct}%` }} />
          </span>
          <span className="text-right text-ink-2 tabular-nums">{m.pct}%</span>
        </li>
      ))}
    </ul>
  )
}
