'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentMerchant } from '@/lib/data/merchant'
import { markAllRead, markRead } from '@/lib/data/notifications'

/**
 * Mark one alert read. The merchant comes from the session, never from the caller.
 * @param {string} id
 */
export async function markNotificationRead(id) {
  const merchant = await getCurrentMerchant()
  await markRead(merchant.id, String(id))
  revalidatePath('/', 'layout')
}

/** Mark all of the signed-in merchant's alerts read. */
export async function markAllNotificationsRead() {
  const merchant = await getCurrentMerchant()
  await markAllRead(merchant.id)
  revalidatePath('/', 'layout')
}
