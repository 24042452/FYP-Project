import { getCurrentMerchant } from '@/lib/data/merchant'
import { getSelectedOutlet } from '@/lib/outlets/server'

/**
 * For pages that cannot be split by outlet (money to the bank, bills, check-up, reports, assistant):
 * when one outlet is picked in the "Showing" menu, say plainly that this page still covers all of them.
 */
export async function MerchantWideNote() {
  const merchant = await getCurrentMerchant()
  const { selected } = await getSelectedOutlet(merchant)
  if (!selected) return null
  return (
    <p
      role="note"
      data-testid="all-outlets-note"
      className="rounded-lg border border-line bg-nets-blue-soft px-4 py-3 text-[15px] text-ink-2"
    >
      Showing all outlets: NETS pays and bills {merchant.tradingName} as one business.
    </p>
  )
}
