import { getCurrentMerchant } from '@/lib/data/merchant'
import { PortalShell } from '@/components/layout/PortalShell'

// Every portal page needs a valid session, so nothing here may be cached or prerendered.
export const dynamic = 'force-dynamic'

export default async function PortalLayout({ children }) {
  // The real session check (middleware only looks for the cookie).
  const merchant = await getCurrentMerchant()
  return <PortalShell merchant={merchant}>{children}</PortalShell>
}
