'use server'

import { revalidatePath } from 'next/cache'
import { requirePage } from '@/lib/data/merchant'
import { getSessionUser } from '@/lib/auth/session'
import { answerDispute, listDisputes } from '@/lib/data/disputes'
import { canRespond, declineReasons, parseDecline } from '@/lib/disputes/rules'
import { checkFiles } from '@/lib/disputes/files'
import { formatDay } from '@/lib/transactions/format'
import { formatSGD } from '@/lib/money'
import { sgtDate } from '@/lib/dates'

/**
 * @typedef {{declineReason: string, evidence: string[], note: string}} DeclineValues what was typed, to refill the form
 * @typedef {{ok: true, message: string}
 *   | {ok: false, message?: string, errors?: Record<string, string>, values?: DeclineValues}} ActionResult
 */

const VIEW_ONLY = 'Only the owner can answer disputes.'
const NOT_FOUND = "We couldn't find that dispute."
/** @type {Record<string, string>} */
const FAILED = {
  not_found: NOT_FOUND,
  already_answered: 'This dispute was already answered.',
  too_late: 'The time to answer has passed.',
}

/** The longest stored file name (dispute_files.file_name is VARCHAR(200)). */
const MAX_NAME = 200

/**
 * The signed-in person and their access, or a refusal when they may not answer disputes. Checked on the
 * server, so a view-only login cannot answer even by sending the form by hand.
 */
async function answerer() {
  const merchant = await requirePage('/disputes')
  if (!canRespond(merchant)) return null
  const user = await getSessionUser()
  return user ? { merchant, userId: user.id } : null
}

/**
 * This merchant's (and, for an outlet manager, this outlet's) dispute, or undefined.
 * @param {{id: string, outletId: string | null}} merchant
 * @param {string} disputeId
 */
async function findDispute(merchant, disputeId) {
  const rows = await listDisputes(merchant.id, { outletId: merchant.outletId })
  return rows.find((d) => d.id === disputeId)
}

/** @param {FormData} formData */
const disputeIdOf = (formData) => String(formData.get('disputeId') ?? '')

/** @param {FormData} formData @returns {DeclineValues} */
function typedValues(formData) {
  const str = (/** @type {unknown} */ v) => (typeof v === 'string' ? v : '')
  return {
    declineReason: str(formData.get('declineReason')),
    evidence: formData.getAll('evidence').filter((v) => typeof v === 'string'),
    note: str(formData.get('note')),
  }
}

/**
 * The picked files. A file input with nothing picked still sends one empty, unnamed file; it is skipped.
 * @param {FormData} formData
 * @returns {File[]}
 */
function pickedFiles(formData) {
  return formData
    .getAll('files')
    .filter((f) => typeof f === 'object' && f !== null && typeof f.arrayBuffer === 'function' && (f.size > 0 || f.name !== ''))
    .map((f) => /** @type {File} */ (f))
}

/** Today's date in Singapore, 'YYYY-MM-DD'. */
const today = () => sgtDate(new Date().toISOString())

/**
 * "Accept": the customer gets the money back and the dispute closes.
 * @param {unknown} _prev the previous answer (unused; for useActionState)
 * @param {FormData} formData field `disputeId`
 * @returns {Promise<ActionResult>}
 */
export async function acceptDispute(_prev, formData) {
  const who = await answerer()
  if (!who) return { ok: false, message: VIEW_ONLY }
  const { merchant, userId } = who
  const disputeId = disputeIdOf(formData)
  const dispute = await findDispute(merchant, disputeId)
  if (!dispute) return { ok: false, message: NOT_FOUND }

  const res = await answerDispute(merchant.id, disputeId, { action: 'accept', userId, outletId: merchant.outletId, today: today() })
  if (!res.ok) return { ok: false, message: FAILED[res.reason] ?? NOT_FOUND }
  revalidatePath('/disputes')
  return { ok: true, message: `Accepted. ${formatSGD(dispute.amountCents)} goes back to the customer.` }
}

/**
 * "Send my answer to NETS": decline the dispute with a reason, the kinds of proof, an optional note and up
 * to 3 photos or PDFs. On any problem the answer carries what was typed so the form can keep it.
 * @param {unknown} _prev the previous answer (unused; for useActionState)
 * @param {FormData} formData fields `disputeId`, `declineReason`, `evidence` (repeated), `note`, `files` (repeated File)
 * @returns {Promise<ActionResult>}
 */
export async function declineDispute(_prev, formData) {
  const values = typedValues(formData)
  const who = await answerer()
  if (!who) return { ok: false, message: VIEW_ONLY, values }
  const { merchant, userId } = who
  const disputeId = disputeIdOf(formData)
  const dispute = await findDispute(merchant, disputeId)
  if (!dispute) return { ok: false, message: NOT_FOUND, values }

  // The form's fields, then the reason must be one offered for THIS dispute's reason.
  const parsed = parseDecline(formData)
  /** @type {Record<string, string>} */
  const errors = parsed.ok ? {} : { ...parsed.errors }
  const offered = declineReasons(dispute.reason).map((r) => r.value)
  if (!errors.declineReason && !offered.includes(values.declineReason)) errors.declineReason = 'Choose why you disagree.'

  // The files: count and sizes first (no bytes read), then the real type from the first bytes.
  const picked = pickedFiles(formData)
  const heads = await Promise.all(picked.map(async (f) => new Uint8Array(await f.slice(0, 8).arrayBuffer())))
  const fileCheck = checkFiles(picked.map((f, i) => ({ name: f.name, size: f.size, head: heads[i] })))

  if (Object.keys(errors).length > 0 || !fileCheck.ok || !parsed.ok) {
    return {
      ok: false,
      ...(fileCheck.ok ? {} : { message: fileCheck.message }),
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
      values,
    }
  }

  const files = await Promise.all(
    picked.map(async (f, i) => ({
      name: (f.name || 'evidence').slice(0, MAX_NAME),
      mime: fileCheck.mimes[i],
      bytes: Buffer.from(await f.arrayBuffer()),
    })),
  )
  const day = today()
  const res = await answerDispute(merchant.id, disputeId, {
    action: 'decline',
    userId,
    outletId: merchant.outletId,
    today: day,
    declineReason: parsed.value.declineReason,
    evidence: parsed.value.evidence,
    note: parsed.value.note,
    files,
  })
  if (!res.ok) return { ok: false, message: FAILED[res.reason] ?? NOT_FOUND, values }
  revalidatePath('/disputes')
  return { ok: true, message: `Sent to NETS on ${formatDay(day)}. NETS usually decides within 30 days.` }
}
