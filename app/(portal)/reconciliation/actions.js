'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentMerchant } from '@/lib/data/merchant'
import { markExceptionSorted } from '@/lib/data/recon'
import { runAndSaveReconciliation } from '@/lib/recon/run'
import { sgtDate } from '@/lib/dates'

const FIRST_MONTH = '2026-05'
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

/**
 * "Run check-up": compare the month's payments, deposits and bill and store the result. Used with
 * useActionState, so it answers instead of redirecting: the page shows its progress bar and then opens the
 * result. The merchant comes from the session only.
 * @param {unknown} _prev the previous answer (unused)
 * @param {FormData} formData a form with a `month` field (YYYY-MM)
 * @returns {Promise<{ok: true, runId: string, month: string, durationMs: number} | {ok: false, message: string}>}
 */
export async function runReconciliation(_prev, formData) {
  const merchant = await getCurrentMerchant()
  const month = String(formData.get('month'))
  const today = sgtDate(new Date().toISOString())
  if (!MONTH_RE.test(month) || month < FIRST_MONTH || month > today.slice(0, 7)) {
    return { ok: false, message: 'That month is not available. Please pick a month from the list.' }
  }
  const started = Date.now()
  const runId = await runAndSaveReconciliation(merchant.id, month, today)
  const durationMs = Date.now() - started
  revalidatePath('/')
  return { ok: true, runId, month, durationMs }
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
