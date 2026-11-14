'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { markAllNotificationsRead, markNotificationRead } from './notification-actions'

/**
 * @typedef {{id: string, title: string, body: string, link: string | null, ago: string, read: boolean}} BellItem
 */

/**
 * The alerts bell: red count badge, a dropdown of recent alerts, click one to mark it read and go to it.
 * @param {{unread: number, items: BellItem[], className: string}} props
 */
export function NotificationBell({ unread, items, className }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const label = unread > 0 ? `Alerts, ${unread} new` : 'Alerts'

  /** @param {BellItem} item */
  const open = (item) =>
    startTransition(async () => {
      try {
        if (!item.read) await markNotificationRead(item.id)
      } finally {
        if (item.link && item.link.startsWith('/') && !item.link.startsWith('//')) router.push(item.link)
      }
    })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={label} className={className}>
          <Bell className="size-5" aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-nets-red px-1 text-[11px] leading-none font-bold text-white"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={12}
        className="w-[min(22rem,calc(100vw-1.5rem))] bg-white p-0"
      >
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-3">
          <span className="text-[15px] font-semibold text-ink">Alerts</span>
          {unread > 0 && (
            <DropdownMenuItem
              disabled={pending}
              onSelect={(e) => {
                e.preventDefault()
                startTransition(async () => {
                  await markAllNotificationsRead()
                })
              }}
              className="min-h-11 px-2 text-[14px] font-semibold text-nets-blue"
            >
              Mark all as read
            </DropdownMenuItem>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-[14px] text-ink-3">Nothing new right now</p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="border-b border-line last:border-b-0">
                <DropdownMenuItem
                  onSelect={() => open(item)}
                  className="flex min-h-11 items-start gap-2.5 rounded-none px-3 py-2.5"
                >
                  <span
                    aria-hidden="true"
                    className={'mt-1.5 size-2 flex-none rounded-full ' + (item.read ? 'bg-transparent' : 'bg-nets-red')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={'block text-[14px] text-ink ' + (item.read ? 'font-medium' : 'font-semibold')}>
                      {item.title}
                      {!item.read && <span className="sr-only"> (new)</span>}
                    </span>
                    {item.body && <span className="block text-[13px] text-ink-2">{item.body}</span>}
                    <span className="mt-0.5 block text-xs text-ink-3">{item.ago}</span>
                  </span>
                </DropdownMenuItem>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
