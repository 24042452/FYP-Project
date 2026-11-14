'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV, ASK_HREF } from '@/lib/nav'
import { NavIcon } from './nav-icons'

/** @param {string} pathname @param {string} href */
function isActive(pathname, href) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
}

/**
 * The navigation itself: brand, outlet picker, grouped links, assistant button.
 * Used in the desktop sidebar and inside the phone menu Sheet.
 * @param {{merchantName: string, onNavigate?: () => void}} props
 */
export function SidebarContent({ merchantName, onNavigate }) {
  const pathname = usePathname()
  const askActive = isActive(pathname, ASK_HREF)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 p-3">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5 rounded-lg px-2 py-1 text-ink no-underline">
        <span className="grid size-8 place-items-center rounded-lg bg-nets-red text-[15px] font-extrabold text-white">M</span>
        <span className="text-base font-bold">Merchant Portal</span>
      </Link>

      <div className="flex flex-col gap-1 px-1">
        <label htmlFor="outlet-select" className="px-1 text-[13px] text-ink-3">Showing</label>
        <select
          id="outlet-select"
          disabled
          title="Choosing an outlet is coming soon"
          className="min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-[15px] font-medium text-ink shadow-panel"
        >
          <option>{merchantName}: all outlets</option>
        </select>
      </div>

      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-4">
        {NAV.map((g) => (
          <nav key={g.group} aria-label={g.group} className="flex flex-col gap-px">
            <div className="px-3 pt-1.5 pb-0.5 text-xs font-semibold tracking-wider text-ink-3 uppercase">{g.group}</div>
            {g.items.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={
                    'grid min-h-11 grid-cols-[20px_1fr_auto] items-center gap-x-2.5 rounded-lg px-3 py-1.5 no-underline transition-colors ' +
                    (active
                      ? 'bg-nets-blue-soft text-nets-blue-hover'
                      : item.built
                        ? 'text-ink hover:bg-mute-bg'
                        : 'text-ink-3 hover:bg-mute-bg')
                  }
                >
                  <NavIcon name={item.icon} className={'size-5 ' + (active ? 'text-nets-blue' : 'text-ink-3')} />
                  <span className={'text-[15px] leading-tight ' + (active ? 'font-semibold' : 'font-medium')}>
                    {item.label}
                    {item.sub && item.built && (
                      <span className="block text-xs font-normal text-ink-3">{item.sub}</span>
                    )}
                  </span>
                  {item.built ? (
                    <span />
                  ) : (
                    <span className="rounded-full bg-mute-bg px-[7px] py-0.5 text-[11px] font-semibold text-ink-2">Soon</span>
                  )}
                </Link>
              )
            })}
          </nav>
        ))}
      </div>

      <Link
        href={ASK_HREF}
        onClick={onNavigate}
        aria-current={askActive ? 'page' : undefined}
        className="flex min-h-12 flex-none items-center gap-2.5 rounded-lg bg-nets-blue px-3.5 text-[15px] font-semibold text-white no-underline hover:bg-nets-blue-hover aria-[current=page]:bg-nets-blue-hover"
      >
        <NavIcon name="chat" className="size-5 text-white" />
        Ask NETS Assistant
      </Link>
    </div>
  )
}

/** Desktop sidebar (hidden below 768px; phones use the menu Sheet). */
export function Sidebar({ merchantName }) {
  return (
    <aside
      aria-label="Main menu"
      className="sticky top-0 hidden h-screen w-[264px] flex-none overflow-hidden border-r border-line bg-white md:block"
    >
      <SidebarContent merchantName={merchantName} />
    </aside>
  )
}
