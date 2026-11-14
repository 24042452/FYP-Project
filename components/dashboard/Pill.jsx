const TONES = {
  ok: 'bg-ok-bg text-ok',
  bad: 'bg-bad-bg text-bad',
  info: 'bg-info-bg text-info',
  warn: 'bg-warn-bg text-warn',
  mute: 'bg-mute-bg text-mute',
}

/**
 * Status pill: always words, colour only helps.
 * @param {{tone: 'ok' | 'bad' | 'info' | 'warn' | 'mute', children: React.ReactNode}} props
 */
export function Pill({ tone, children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-[3px] text-[13px] leading-snug font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}
