import { Check, Clock, FileText, RotateCcw, TriangleAlert } from 'lucide-react'

const PILL_ICONS = { alert: TriangleAlert, clock: Clock, tick: Check, refund: RotateCcw }

/**
 * The small icon in front of a dispute status pill.
 * @param {{icon: 'alert' | 'clock' | 'tick' | 'refund'}} props
 */
export function PillIcon({ icon }) {
  const Icon = PILL_ICONS[icon] ?? Clock
  return <Icon className="mr-1.5 -ml-0.5 size-3.5 flex-none stroke-[2.4]" aria-hidden="true" />
}

/**
 * "2 files sent" with a link to open each evidence file (in a new tab). On phones the files are a list under
 * the label; from 640px they sit on one line after it.
 * @param {{files: import('@/lib/disputes/view').FileView[], label: string, className?: string}} props
 */
export function FileLinks({ files, label, className = '' }) {
  return (
    <div className={`flex flex-col gap-x-3 text-[14px] text-ink-2 sm:flex-row sm:flex-wrap sm:items-center ${className}`}>
      <span>{label}:</span>
      <ul className="m-0 flex min-w-0 list-none flex-col p-0 sm:flex-row sm:flex-wrap sm:gap-x-3">
        {files.map((f) => (
          <li key={f.id} className="min-w-0">
            <a
              href={f.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 max-w-full items-center gap-1.5 font-semibold text-info underline-offset-[3px] hover:text-ink sm:min-h-0"
            >
              <FileText className="size-4 flex-none" aria-hidden="true" />
              <span className="min-w-0 truncate">{f.name}</span>
              <span className="sr-only">(opens in a new tab, {f.size})</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
