import { getCurrentMerchantForApi } from './auth.js'
import { listTransactions } from '../data/transactions.js'
import { listOutlets } from '../data/outlets.js'
import { listSettlements } from '../data/settlements.js'
import { getDailySales, getFeeTotals } from '../data/sales.js'
import { periodRange, sgtDate } from '../dates.js'
import { parseTxnParams, validateTxnQuery } from '../transactions/params.js'
import { validateOutletChoice } from '../outlets/selection.js'
import { toApiTransaction } from '../transactions/api.js'
import { monthBounds, parseSettlementStatus } from '../settlements/model.js'
import { settlementStatus } from '../dashboard/home-model.js'
import { comparePeriods, summarise } from '../metrics/summary.js'
import { listDisputes } from '../data/disputes.js'
import { listRefunds } from '../data/refunds.js'
import { effectiveStatus } from '../disputes/rules.js'
import { refundsRange } from '../disputes/view.js'

// Handler logic for /api/v1 (read-only). The route files are thin: they get the merchant from the
// session and call these. `merchantId` is never taken from the URL.

export const NO_STORE = { 'Cache-Control': 'private, no-store' }

/**
 * @param {number} status
 * @param {string} code
 * @param {string} message
 */
export function apiError(status, code, message) {
  return Response.json({ error: { code, message } }, { status, headers: NO_STORE })
}

/** @param {unknown} body */
export function apiOk(body) {
  return Response.json(body, { status: 200, headers: NO_STORE })
}

export const signedOut = () => apiError(401, 'signed_out', 'Please log in first. This API uses your portal session.')

/**
 * @param {URLSearchParams} usp
 * @returns {Record<string, string>} first value of each key
 */
function plain(usp) {
  /** @type {Record<string, string>} */
  const o = {}
  for (const [k, v] of usp) if (!(k in o)) o[k] = v
  return o
}

/**
 * What the signed-in person may see beyond the merchant: an outlet manager (tier "outlet") is locked to one outlet.
 * @typedef {{tier?: import('../access/rules.js').Tier, outletId?: string | null}} Scope
 */

export const forbidden = () => apiError(403, 'forbidden', 'Your login is for one outlet, so it cannot see the whole business.')

/**
 * Run a handler for the signed-in merchant, or answer 401 JSON (never a redirect).
 * @param {Request} request
 * @param {(merchantId: string, sp: Record<string, string>, today: string, scope: Scope) => Promise<Response>} fn
 */
export async function withMerchant(request, fn) {
  const merchant = await getCurrentMerchantForApi()
  if (!merchant) return signedOut()
  const today = sgtDate(new Date().toISOString())
  try {
    return await fn(merchant.id, plain(new URL(request.url).searchParams), today, { tier: merchant.tier, outletId: merchant.outletId })
  } catch (err) {
    console.error('api error', err instanceof Error ? err.message : err)
    return apiError(500, 'server_error', 'Something went wrong on our side. Please try again.')
  }
}

/**
 * GET /api/v1/transactions (optional `outlet` = one of the merchant's outlet ids)
 * @param {string} merchantId
 * @param {Record<string, string>} sp
 * @param {string} today
 */
export async function transactionsResponse(merchantId, sp, today, scope = {}) {
  const problem = validateTxnQuery(sp)
  if (problem) return apiError(400, 'invalid_params', problem)
  /** @type {string | null} */
  let outletId = null
  if (sp.outlet !== undefined) {
    // Only an outlet of the signed-in merchant is accepted.
    const mine = await listOutlets(merchantId)
    const choice = validateOutletChoice(mine, sp.outlet)
    if (!choice.ok || choice.outletId === null) return apiError(400, 'invalid_params', '"outlet" must be the id of one of your outlets.')
    outletId = choice.outletId
  }
  if (scope.outletId) {
    // An outlet manager only ever sees their own outlet.
    if (outletId && outletId !== scope.outletId) return forbidden()
    outletId = scope.outletId
  }
  const p = parseTxnParams(sp, today)
  const { rows, nextCursor } = await listTransactions(merchantId, { ...p, outletId })
  return apiOk({ data: rows.map(toApiTransaction), next_cursor: nextCursor })
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * GET /api/v1/settlements?month=YYYY-MM&status=paid|on_the_way|late
 * @param {string} merchantId
 * @param {Record<string, string>} sp
 * @param {string} today
 */
export async function settlementsResponse(merchantId, sp, today, scope = {}) {
  if (scope.tier === 'outlet') return forbidden()
  if (sp.month !== undefined && !MONTH_RE.test(sp.month)) return apiError(400, 'invalid_params', '"month" must be written YYYY-MM.')
  if (sp.status !== undefined && !parseSettlementStatus(sp.status)) {
    return apiError(400, 'invalid_params', '"status" must be one of: paid, on_the_way, late.')
  }
  const month = sp.month ?? today.slice(0, 7)
  const status = parseSettlementStatus(sp.status)
  const { from, to } = monthBounds(month)
  const rows = await listSettlements(merchantId, { from, to, status, today })
  return apiOk({
    month,
    data: rows.map((r) => ({
      id: r.id,
      business_date: r.businessDate,
      channel: r.channel,
      gross_cents: r.grossCents,
      fee_cents: r.feeCents,
      refund_cents: r.refundCents,
      net_cents: r.netCents,
      status: r.status === 'paid' ? 'paid' : settlementStatus(r.status, r.expectedDate, today).late ? 'late' : 'on_the_way',
      expected_date: r.expectedDate,
      paid_date: r.paidDate,
    })),
  })
}

/**
 * GET /api/v1/summary?period=today|week|month
 * @param {string} merchantId
 * @param {Record<string, string>} sp
 * @param {string} today
 */
export async function summaryResponse(merchantId, sp, today, scope = {}) {
  const period = sp.period ?? 'week'
  if (period !== 'today' && period !== 'week' && period !== 'month') {
    return apiError(400, 'invalid_params', '"period" must be one of: today, week, month.')
  }
  const r = periodRange(period, today)
  const [currRows, prevRows, fees] = await Promise.all([
    getDailySales(merchantId, r.from, r.toDate, scope.outletId ?? null),
    getDailySales(merchantId, r.prevFrom, r.prevToDate, scope.outletId ?? null),
    getFeeTotals(merchantId, r.from, r.toDate, scope.outletId ?? null),
  ])
  // Like for like: from..toDate against prevFrom..prevToDate.
  const curr = summarise(currRows)
  const prev = summarise(prevRows)
  const { pct } = comparePeriods(curr.grossCents, prev.grossCents)
  return apiOk({
    period,
    from: r.from,
    to: r.toDate,
    compared_with: { from: r.prevFrom, to: r.prevToDate },
    gross_cents: curr.grossCents,
    txn_count: curr.txnCount - curr.failedCount,
    failed_count: curr.failedCount,
    fee_cents: fees.feeCents,
    change_pct: pct === null ? null : Math.round(pct * 10) / 10,
  })
}

const PAGE_SIZE = 50

/**
 * The outlet a disputes/refunds request is limited to: the optional `outlet` query, which must be one of
 * the merchant's outlets, and always the outlet of an outlet manager. Returns a Response on a bad request.
 * @param {string} merchantId
 * @param {Record<string, string>} sp
 * @param {Scope} scope
 * @returns {Promise<{outletId: string | null} | Response>}
 */
async function outletFor(merchantId, sp, scope) {
  /** @type {string | null} */
  let outletId = null
  if (sp.outlet !== undefined) {
    const choice = validateOutletChoice(await listOutlets(merchantId), sp.outlet)
    if (!choice.ok || choice.outletId === null) return apiError(400, 'invalid_params', '"outlet" must be the id of one of your outlets.')
    outletId = choice.outletId
  }
  if (scope.outletId) {
    if (outletId && outletId !== scope.outletId) return forbidden()
    outletId = scope.outletId
  }
  return { outletId }
}

/**
 * @param {Record<string, string>} sp
 * @returns {number | null} the page number (1 = first), or null when it is not a positive whole number
 */
function pageOf(sp) {
  if (sp.page === undefined) return 1
  return /^[1-9]\d{0,5}$/.test(sp.page) ? Number(sp.page) : null
}

/**
 * @template T
 * @param {T[]} rows
 * @param {number} page
 */
function pageBody(rows, page) {
  // Paging is in memory over a bounded list (3 months of refunds, one merchant's disputes).
  const start = (page - 1) * PAGE_SIZE
  return { page, page_size: PAGE_SIZE, has_more: rows.length > start + PAGE_SIZE, rows: rows.slice(start, start + PAGE_SIZE) }
}

/**
 * GET /api/v1/disputes?page=1 (optional `outlet`). Newest first; status is the effective one (an unanswered
 * dispute past its deadline is "missed"). No evidence files, notes or other free text.
 * @param {string} merchantId
 * @param {Record<string, string>} sp
 * @param {string} today
 * @param {Scope} scope
 */
export async function disputesResponse(merchantId, sp, today, scope = {}) {
  const page = pageOf(sp)
  if (page === null) return apiError(400, 'invalid_params', '"page" must be a whole number from 1.')
  const o = await outletFor(merchantId, sp, scope)
  if (o instanceof Response) return o
  const all = await listDisputes(merchantId, { outletId: o.outletId })
  const { rows, ...meta } = pageBody(all, page)
  return apiOk({
    data: rows.map((d) => ({
      id: d.id,
      transaction_id: d.transactionId,
      amount_cents: d.amountCents,
      reason: d.reason,
      status: effectiveStatus(d, today),
      opened_on: d.openedAt,
      respond_by: d.respondBy,
      channel: d.channel,
      paid_at: d.paidAt,
      file_count: d.fileCount,
    })),
    ...meta,
  })
}

/**
 * GET /api/v1/refunds?page=1 (optional `outlet`): refunds of the last 3 months (the Refunds & disputes page window), newest first.
 * @param {string} merchantId
 * @param {Record<string, string>} sp
 * @param {string} today
 * @param {Scope} scope
 */
export async function refundsResponse(merchantId, sp, today, scope = {}) {
  const page = pageOf(sp)
  if (page === null) return apiError(400, 'invalid_params', '"page" must be a whole number from 1.')
  const o = await outletFor(merchantId, sp, scope)
  if (o instanceof Response) return o
  const all = await listRefunds(merchantId, { ...refundsRange(today), outletId: o.outletId })
  const { rows, ...meta } = pageBody(all, page)
  return apiOk({
    data: rows.map((r) => ({
      id: r.id,
      transaction_id: r.transactionId,
      amount_cents: r.amountCents,
      reason: r.reason,
      refunded_at: r.refundedAt,
      paid_at: r.paidAt,
      channel: r.channel,
      payout: r.payout && {
        id: r.payout.id,
        business_date: r.payout.businessDate,
        status: r.payout.status,
        expected_date: r.payout.expectedDate,
        paid_date: r.payout.paidDate,
      },
    })),
    ...meta,
  })
}
