import { getCurrentMerchant } from '@/lib/data/merchant'
import { Chat } from '@/components/assistant/Chat'

export const metadata = { title: 'Ask NETS Assistant · Merchant Portal' }

/**
 * @param {{searchParams: Promise<Record<string, string | string[] | undefined>>}} props
 */
export default async function AssistantPage({ searchParams }) {
  await getCurrentMerchant() // session check (the layout checks too)
  const sp = await searchParams
  const q = Array.isArray(sp?.q) ? sp.q[0] : sp?.q
  const mode = process.env.ASSISTANT_MODE === 'ai' ? 'ai' : 'rules'
  return <Chat mode={mode} initialQuestion={typeof q === 'string' ? q.slice(0, 1000) : undefined} />
}
