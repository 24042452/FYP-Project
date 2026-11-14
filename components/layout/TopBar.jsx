'use client'

import { Bell, Menu, Search, LogOut } from 'lucide-react'
import { signOut } from '@/app/login/actions'

/** @param {string} name */
function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

const ROLE_LABEL = { owner: 'Owner', manager: 'Manager', cashier: 'Cashier', accountant: 'Accountant' }

const iconBtn =
  'relative grid size-11 flex-none place-items-center rounded-lg border border-line bg-white text-ink-2 hover:border-line-strong hover:text-ink md:size-[42px]'

/**
 * @param {{userName: string, role: string, merchantName: string, onOpenMenu: () => void}} props
 */
export function TopBar({ userName, role, merchantName, onOpenMenu }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-page/90 px-4 py-2.5 backdrop-blur md:px-9">
      <button type="button" aria-label="Open menu" onClick={onOpenMenu} className={iconBtn + ' md:hidden'}>
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <label className="flex min-h-11 max-w-[460px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-white px-3 text-ink-3 focus-within:border-nets-blue focus-within:ring-3 focus-within:ring-nets-blue-soft md:min-h-[42px]">
        <span className="sr-only">Search</span>
        <Search className="size-4 flex-none" aria-hidden="true" />
        <input
          type="search"
          placeholder="Search payments, amounts, references"
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        />
      </label>

      <div className="flex-1" />

      <span className="hidden rounded-full bg-warn-bg px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-warn lg:inline">
        Sample data
      </span>

      <button type="button" aria-label="Alerts" className={iconBtn}>
        <Bell className="size-5" aria-hidden="true" />
      </button>

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
        <button type="submit" aria-label="Sign out" title="Sign out" className={iconBtn}>
          <LogOut className="size-5" aria-hidden="true" />
        </button>
      </form>
    </header>
  )
}
