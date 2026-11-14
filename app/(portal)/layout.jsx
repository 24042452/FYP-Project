import { getCurrentMerchant } from '@/lib/data/merchant'
import { getSelectedOutlet } from '@/lib/outlets/server'
import { countUnread, listNotifications } from '@/lib/data/notifications'
import { timeAgo } from '@/lib/nudges/time'
import { PortalShell } from '@/components/layout/PortalShell'

// Every portal page needs a valid session, so nothing here may be cached or prerendered.
export const dynamic = 'force-dynamic'

export default async function PortalLayout({ children }) {
  // The real session check (middleware only looks for the cookie).
  const merchant = await getCurrentMerchant()
  const [unread, rows, { outlets, selected }] = await Promise.all([
    countUnread(merchant.id),
    listNotifications(merchant.id, { limit: 10 }),
    getSelectedOutlet(merchant),
  ])
  const now = new Date().toISOString()
  const items = rows.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.read,
    ago: timeAgo(n.createdAt, now),
  }))
  return (
    <PortalShell merchant={merchant} alerts={{ unread, items }} outlets={outlets} selectedId={selected?.id ?? null}>
      {children}
    </PortalShell>
  )
}
