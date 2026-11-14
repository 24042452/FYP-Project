import { Pill } from './Pill'

/**
 * Recent money to the bank, with a plain status.
 * @param {{items: {key: string, dateLabel: string, amount: string, statusLabel: string, tone: 'ok' | 'bad' | 'info'}[]}} props
 */
export function SettlementList({ items }) {
  return (
    <ul className="m-0 list-none p-0">
      {items.map((s) => (
        <li key={s.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line py-3 first:border-t-0 first:pt-0">
          <div>
            <span className="block text-[13px] text-ink-3">Sales from</span>
            <span className="font-semibold">{s.dateLabel}</span>
          </div>
          <span className="font-semibold tabular-nums">{s.amount}</span>
          <Pill tone={s.tone}>{s.statusLabel}</Pill>
        </li>
      ))}
    </ul>
  )
}
