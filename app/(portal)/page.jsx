import { getCurrentMerchant } from '@/lib/data/merchant'

export const metadata = { title: 'Home · Merchant Portal' }

// Placeholder: Task 7 builds the real dashboard.
export default async function HomePage() {
  const merchant = await getCurrentMerchant()
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-[28px] leading-tight font-bold">{merchant.tradingName}</h1>
      <p className="text-ink-2">Your dashboard is coming in the next step.</p>
    </div>
  )
}
