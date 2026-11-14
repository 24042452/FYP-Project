'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { TABS } from '@/lib/nav'
import { Sidebar, SidebarContent } from './Sidebar'
import { TopBar } from './TopBar'
import { NavIcon } from './nav-icons'

/**
 * The portal frame: sidebar (desktop), top bar, page, and on phones a menu Sheet plus bottom tabs.
 * @param {{merchant: {tradingName: string, role: string, userName: string}, children: React.ReactNode}} props
 */
export function PortalShell({ merchant, children }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const tabClass = (/** @type {boolean} */ active) =>
    'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium no-underline ' +
    (active ? 'text-nets-blue-hover' : 'text-ink-2')

  return (
    <div className="flex min-h-screen">
      <Sidebar merchantName={merchant.tradingName} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          userName={merchant.userName}
          role={merchant.role}
          merchantName={merchant.tradingName}
          onOpenMenu={() => setOpen(true)}
        />
        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pt-6 pb-24 md:px-9 md:pb-16">{children}</main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-[300px] max-w-[85vw] gap-0 bg-white p-0 sm:max-w-[300px]">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">All the pages in the portal</SheetDescription>
          <SidebarContent merchantName={merchant.tradingName} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <nav
        aria-label="Quick links"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {TABS.map((t) => {
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
              <NavIcon name={t.icon} className={'size-5 ' + (active ? 'text-nets-blue' : 'text-ink-3')} />
              {t.label}
            </Link>
          )
        })}
        <button type="button" onClick={() => setOpen(true)} className={tabClass(false)}>
          <Menu className="size-5 text-ink-3" aria-hidden="true" />
          More
        </button>
      </nav>
    </div>
  )
}
