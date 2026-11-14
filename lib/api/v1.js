import { getCurrentMerchantForApi } from './auth.js'
import { listTransactions } from '../data/transactions.js'
import { listSettlements } from '../data/settlements.js'
import { getDailySales, getFeeTotals } from '../data/sales.js'
import { periodRange, sgtDate } from '../dates.js'
import { parseTxnParams, validateTxnQuery } from '../transactions/params.js'
import { toApiTransaction } from '../transactions/api.js'
import { monthBounds, parseSettlementStatus } from '../settlements/model.js'
import { settlementStatus } from '../dashboard/home-model.js'
import { comparePeriods, summarise } from '../metrics/summary.js'

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
 * Run a handler for the signed-in merchant, or answer 401 JSON (never a redirect).
 * @param {Request} request
 * @param {(merchantId: string, sp: Record<string, string>, today: string) => Promise<Response>} fn
 */
export async function withMerchant(request, fn) {
  const merchant = await getCurrentMerchantForApi()
  if (!merchant) return signedOut()
  const today = sgtDate(new Date().toISOString())
  try {
    return await fn(merchant.id, plain(new URL(request.url).searchParams), today)
  } catch (err) {
    console.error('api error', err instanceof Error ? err.message : err)
    return apiError(500, 'server_error', 'Something went wrong on our side. Please try again.')
  }
}

/**
 * GET /api/v1/transactions
 * @param {string} merchantId
 * @param {Record<string, string>} sp
 * @param {string} today
 */
export async function transactionsResponse(merchantId, sp, today) {
  const problem = validateTxnQuery(sp)
  if (problem) return apiError(400, 'invalid_params', problem)
  const p = parseTxnParams(sp, today)
  const { rows, nextCursor } = await listTransactions(merchantId, p)
  return apiOk({ data: rows.map(toApiTransaction), next_cursor: nextCursor })
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * GET /api/v1/settlements?month=YYYY-MM&status=paid|on_the_way|late
 * @param {string} merchantId
 * @param {Record<string, string>} sp
 * @param {string} today
 */
export async function settlementsResponse(merchantId, sp, today) {
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
export async function summaryResponse(merchantId, sp, today) {
  const period = sp.period ?? 'week'
  if (period !== 'today' && period !== 'week' && period !== 'month') {
    return apiError(400, 'invalid_params', '"period" must be one of: today, week, month.')
  }
  const r = periodRange(period, today)
  const [currRows, prevRows, fees] = await Promise.all([
    getDailySales(merchantId, r.from, r.toDate),
    getDailySales(merchantId, r.prevFrom, r.prevToDate),
    getFeeTotals(merchantId, r.from, r.toDate),
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
