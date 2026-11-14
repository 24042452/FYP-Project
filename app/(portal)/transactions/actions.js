'use server'

import { getCurrentMerchant } from '@/lib/data/merchant'
import { listTransactions } from '@/lib/data/transactions'
import { parseTxnParams } from '@/lib/transactions/params'
import { toRowView } from '@/lib/transactions/format'
import { sgtDate } from '@/lib/dates'

/**
 * "Show more": the next page for the same filters. The merchant comes from the session, and
 * every filter is validated again here (the browser's values are never trusted).
 * @param {Record<string, string>} filters from, to, channel, status, q as shown on the page
 * @param {string} cursor
 */
export async function loadMoreTransactions(filters, cursor) {
  const merchant = await getCurrentMerchant()
  const today = sgtDate(new Date().toISOString())
  const p = parseTxnParams({ ...filters, cursor: String(cursor ?? '') }, today)
  const { rows, nextCursor } = await listTransactions(merchant.id, p)
  return { rows: rows.map(toRowView), nextCursor }
}
