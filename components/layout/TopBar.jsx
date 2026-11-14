'use client'

import { Menu, LogOut } from 'lucide-react'
import { DesktopSearch } from '@/components/search/DesktopSearch'
import { MobileSearch } from '@/components/search/MobileSearch'
import { signOut } from '@/app/login/actions'
import { NotificationBell } from './NotificationBell'

/** @param {string} name */
function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', cashier: 'Cashier', accountant: 'Accountant' }

const iconBtn =
  'relative grid size-11 flex-none place-items-center rounded-lg border border-line bg-white text-ink-2 hover:border-line-strong hover:text-ink md:size-[42px]'

/**
 * @param {{userName: string, role: string, merchantName: string, onOpenMenu: () => void, outletId?: string | null, alerts?: {unread: number, items: import('./NotificationBell').BellItem[]}}} props
 */
export function TopBar({ userName, role, merchantName, onOpenMenu, outletId = null, alerts = { unread: 0, items: [] } }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-page/90 px-4 py-2.5 backdrop-blur md:px-9">
      <button type="button" aria-label="Open menu" onClick={onOpenMenu} className={iconBtn + ' md:hidden'}>
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {/* Phones: a search icon that opens a full-screen search sheet. Larger screens: the search box. */}
      <MobileSearch outletId={outletId} triggerClassName={iconBtn + ' md:hidden'} />
      <DesktopSearch outletId={outletId} />

      <div className="flex-1" />

      <span className="hidden rounded-full bg-warn-bg px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-warn lg:inline">
        Sample data
      </span>

      <NotificationBell unread={alerts.unread} items={alerts.items} className={iconBtn} />

      <div className="hidden items-center gap-2.5 rounded-full border border-line bg-white py-1 pr-2.5 pl-1 sm:flex">
        <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-[#DCE4F7] text-[13px] font-bold text-nets-blue-hover">
          {initials(userName)}
        </span>
        <span className="text-sm leading-tight font-semibold">
          {userName}
          <span className="block text-xs font-medium text-ink-3">
            {ROLE_LABEL[role] ?? role} · {merchantName}
          </span>
        </span>
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex min-h-11 flex-none items-center justify-center gap-2 rounded-lg bg-nets-red px-3.5 text-[15px] font-semibold whitespace-nowrap text-white hover:bg-nets-red-hover focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-nets-red/40 focus-visible:ring-offset-2"
        >
          <LogOut className="size-5" aria-hidden="true" />
          Log out
        </button>
      </form>
    </header>
  )
}
