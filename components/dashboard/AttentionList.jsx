import Link from 'next/link'

/**
 * The things that need doing, each with a link.
 * @param {{items: {key: string, title: string, detail: string, href: string, linkLabel: string}[]}} props
 */
export function AttentionList({ items }) {
  return (
    <ul className="m-0 list-none p-0">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[8px_1fr] gap-3 border-t border-line py-3.5 first:border-t-0 first:pt-0">
          <span className="mt-2 size-2 rounded-full bg-nets-red" aria-hidden="true" />
          <div>
            <b className="block font-semibold">{i.title}</b>
            <span className="text-[14px] text-ink-2">{i.detail}</span>{' '}
            <Link href={i.href} className="inline-flex min-h-11 items-center text-[14px] font-semibold">
              {i.linkLabel}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  )
}
