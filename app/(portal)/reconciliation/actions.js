'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentMerchant } from '@/lib/data/merchant'
import { markExceptionSorted } from '@/lib/data/recon'
import { runAndSaveReconciliation } from '@/lib/recon/run'
import { sgtDate } from '@/lib/dates'

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

/**
 * "Run check-up": compare the month's payments, deposits and bill, store the result, and show it.
 * The merchant comes from the session only.
 * @param {string | FormData} input a YYYY-MM month, or a form with a `month` field
 */
export async function runReconciliation(input) {
  const merchant = await getCurrentMerchant()
  const month = String(input instanceof FormData ? input.get('month') : input)
  const today = sgtDate(new Date().toISOString())
  if (!MONTH_RE.test(month) || month > today.slice(0, 7)) throw new Error('Please pick a valid month.')
  const runId = await runAndSaveReconciliation(merchant.id, month, today)
  revalidatePath('/reconciliation')
  revalidatePath('/')
  redirect(`/reconciliation?month=${month}&run=${runId}`)
}

/**
 * "Mark as sorted": resolve one problem, with an optional note (at most 500 characters).
 * @param {FormData} formData fields `exceptionId`, `note`, `month`
 */
export async function markAsSorted(formData) {
  const merchant = await getCurrentMerchant()
  const id = String(formData.get('exceptionId') ?? '')
  const rawNote = String(formData.get('note') ?? '').trim()
  const month = String(formData.get('month') ?? '')
  const note = rawNote === '' ? null : rawNote.slice(0, 500)
  await markExceptionSorted(merchant.id, id, note)
  revalidatePath('/reconciliation')
  revalidatePath('/')
  redirect(`/reconciliation${MONTH_RE.test(month) ? `?month=${month}` : ''}`)
}
