import { z } from 'zod'
import { getDailySales, getHeatmap } from '../data/sales.js'
import { getTransaction, listTransactions } from '../data/transactions.js'
import { getSettlementSummary, listSettlements } from '../data/settlements.js'
import { getInvoiceWithLines, listInvoices } from '../data/invoices.js'
import { searchKb } from '../data/kb.js'
import { addDays, periodRange, sgtDate } from '../dates.js'
import { CHANNELS, CHANNEL_LABELS } from '../channels.js'
import { explainFailure } from '../failure-codes.js'
import { formatSGD } from '../money.js'
import { busiestSlot, channelMix, comparePeriods, summarise } from '../metrics/summary.js'
import { isValidDate } from '../transactions/params.js'
import { pageForSource } from './kb.js'
import { effectiveInvoiceStatus } from '../invoices/status.js'

/**
 * The assistant's tools. All are READ-ONLY and merchant-scoped: `makeTools(merchantId)` closes over the id
 * (which the route takes from getCurrentMerchant()), so no schema has a merchant field and the model can never
 * pick a merchant. The AI never writes SQL; it can only call these.
 *
 * @typedef {{
 *   name: string,
 *   description: string,
 *   inputSchema: z.ZodObject<any>,
 *   handler: (input: any) => Promise<any>,
 * }} AssistantTool
 */

const WEEKDAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MAX_TXNS = 20
const MAX_RANGE_DAYS = 400

/** The real data layer. Tests inject a fake with the same functions. */
export const realDataLayer = {
  today: () => sgtDate(new Date().toISOString()),
  getDailySales,
  getHeatmap,
  listTransactions,
  getTransaction,
  getSettlementSummary,
  listSettlements,
  listInvoices,
  getInvoiceWithLines,
  searchKb,
}

const date = z
  .string()
  .refine((s) => isValidDate(s), 'Use a real date written YYYY-MM-DD')
  .describe('A Singapore date, YYYY-MM-DD')

/** @param {{from: string, to: string}} v */
const rangeOk = (v) => v.from <= v.to && v.to <= addDays(v.from, MAX_RANGE_DAYS)

/** @param {import('zod').ZodObject<any>} s */
const withRange = (s) => s.refine(rangeOk, { message: 'from must be on or before to (within about a year)' })

/**
 * @param {string} iso UTC instant
 * @returns {string} Singapore time like '1:02pm'
 */
function sgtClock(iso) {
  const d = new Date(new Date(iso).getTime() + 8 * 3_600_000)
  const h = d.getUTCHours()
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${h % 12 === 0 ? 12 : h % 12}:${m}${h < 12 ? 'am' : 'pm'}`
}

/**
 * @param {any} t a payment row
 */
function txnView(t) {
  const failed = t.status === 'failed'
  return {
    id: t.id,
    shortId: String(t.id).slice(0, 8),
    date: sgtDate(t.createdAt),
    time: sgtClock(t.createdAt),
    amountCents: t.amountCents,
    amount: formatSGD(t.amountCents),
    channel: CHANNEL_LABELS[/** @type {keyof typeof CHANNEL_LABELS} */ (t.channel)] ?? t.channel,
    status: t.status,
    ...(failed ? { reason: explainFailure(t.failureCode).plain, whatToDo: explainFailure(t.failureCode).action } : {}),
  }
}

/**
 * Build the tools for one merchant.
 * @param {string} merchantId from getCurrentMerchant(), never from the model or the request
 * @param {typeof realDataLayer} [deps] data layer (tests pass a fake)
 * @returns {AssistantTool[]}
 */
export function makeTools(merchantId, deps = realDataLayer) {
  const today = () => (deps.today ?? realDataLayer.today)()

  /** @param {string} from @param {string} to @param {string} [channel] */
  async function salesRows(from, to, channel) {
    const rows = await deps.getDailySales(merchantId, from, to)
    return channel ? rows.filter((r) => r.channel === channel) : rows
  }

  /** @param {any[]} rows */
  function salesTotals(rows) {
    const s = summarise(rows)
    return {
      grossCents: s.grossCents,
      gross: formatSGD(s.grossCents),
      // Successful payments only (gross counts only those); failed attempts are reported separately.
      txnCount: s.txnCount - s.failedCount,
      failedCount: s.failedCount,
    }
  }

  return [
    {
      name: 'get_sales_summary',
      description:
        'Total sales for a date range (Singapore dates, inclusive): gross takings from successful payments, how many payments, and how many failed. Optionally for one payment type.',
      inputSchema: withRange(
        z.strictObject({ from: date, to: date, channel: z.enum(CHANNELS).optional().describe('Only this payment type') }),
      ),
      async handler({ from, to, channel }) {
        const rows = await salesRows(from, to, channel)
        return { from, to, ...(channel ? { channel } : {}), ...salesTotals(rows) }
      },
    },
    {
      name: 'compare_periods',
      description:
        'Compare sales so far this week or this month with the same stretch of the previous week or month (like for like).',
      inputSchema: z.strictObject({ period: z.enum(['week', 'month']) }),
      async handler({ period }) {
        const r = periodRange(period, today())
        const [curr, prev] = await Promise.all([
          salesRows(r.from, r.toDate),
          salesRows(r.prevFrom, r.prevToDate),
        ])
        const c = salesTotals(curr)
        const p = salesTotals(prev)
        const { deltaCents, pct } = comparePeriods(c.grossCents, p.grossCents)
        return {
          period,
          label: r.label,
          current: { from: r.from, to: r.toDate, ...c },
          previous: { from: r.prevFrom, to: r.prevToDate, ...p },
          deltaCents,
          delta: formatSGD(Math.abs(deltaCents)),
          direction: deltaCents > 0 ? 'more' : deltaCents < 0 ? 'less' : 'same',
          pct: pct === null ? null : Math.round(pct),
        }
      },
    },
    {
      name: 'get_busiest_times',
      description: 'The busiest hour of the week and the busiest weekday by sales, for a date range.',
      inputSchema: withRange(z.strictObject({ from: date, to: date })),
      async handler({ from, to }) {
        const heat = await deps.getHeatmap(merchantId, from, to)
        const slot = busiestSlot(heat)
        /** @type {number[]} */
        const perDay = [0, 0, 0, 0, 0, 0, 0]
        for (const h of heat) perDay[h.dow] += h.grossCents
        const best = Math.max(...perDay)
        return {
          from,
          to,
          busiestSlot: slot ? slot.label : null,
          busiestDay: best > 0 ? WEEKDAY_LONG[perDay.indexOf(best)] : null,
        }
      },
    },
    {
      name: 'get_channel_mix',
      description: 'Share of sales by payment type (NETS QR, cards, and so on) for a date range.',
      inputSchema: withRange(z.strictObject({ from: date, to: date })),
      async handler({ from, to }) {
        const rows = await salesRows(from, to)
        return {
          from,
          to,
          grossCents: summarise(rows).grossCents,
          mix: channelMix(rows).map((m) => ({ channel: m.channel, label: m.label, sharePercent: Math.round(m.share * 100) })),
        }
      },
    },
    {
      name: 'find_transactions',
      description: `Find payments by date, dollar amount and/or status. Returns at most ${MAX_TXNS}, newest first.`,
      inputSchema: z.strictObject({
        date: date.optional(),
        amount: z.number().positive().max(1_000_000).optional().describe('Dollar amount, e.g. 12.5'),
        status: z.enum(['success', 'failed', 'refunded']).optional(),
      }),
      async handler({ date: d, amount, status }) {
        const { rows } = await deps.listTransactions(merchantId, {
          ...(d ? { from: d, to: d } : {}),
          ...(amount !== undefined ? { q: amount.toFixed(2) } : {}),
          ...(status ? { status } : {}),
          limit: MAX_TXNS,
        })
        const transactions = rows.slice(0, MAX_TXNS).map(txnView)
        return { date: d ?? null, amount: amount ?? null, status: status ?? null, count: transactions.length, transactions }
      },
    },
    {
      name: 'explain_failed_payment',
      description:
        'Explain why one payment failed, in plain words, and what to do. Takes the payment id (the full id or its first 8 characters).',
      inputSchema: z.strictObject({
        transaction_id: z.string().regex(/^[0-9a-fA-F-]{8,36}$/, 'A payment id (8 to 36 characters)'),
      }),
      async handler({ transaction_id: id }) {
        let t = null
        if (id.length === 36) {
          t = await deps.getTransaction(merchantId, id)
        } else {
          const { rows } = await deps.listTransactions(merchantId, { q: id, limit: 5 })
          t = rows.find((r) => String(r.id).toLowerCase().startsWith(id.toLowerCase())) ?? null
        }
        if (!t) return { found: false, transactionId: id }
        const view = txnView(t)
        if (t.status !== 'failed') {
          return { found: true, ...view, failed: false, note: `This payment did not fail. Its status is "${t.status}".` }
        }
        const why = explainFailure(t.failureCode)
        return { found: true, ...view, failed: true, reason: why.plain, whatToDo: why.action }
      },
    },
    {
      name: 'get_settlement_status',
      description:
        'Where the money to the merchant bank account is: what is on its way and when the next payout is due, what is late, and recent payouts for a date range (default the last 14 days).',
      inputSchema: z.strictObject({ from: date.optional(), to: date.optional() }),
      async handler({ from, to }) {
        const t = today()
        const f = from ?? addDays(t, -13)
        const e = to ?? t
        if (f > e) return { error: 'The from date must be on or before the to date.' }
        const [sum, list] = await Promise.all([
          deps.getSettlementSummary(merchantId, t),
          deps.listSettlements(merchantId, { from: f, to: e, today: t }),
        ])
        return {
          today: t,
          from: f,
          to: e,
          onTheWayCents: sum.pendingCents,
          onTheWay: formatSGD(sum.pendingCents),
          nextExpectedDate: sum.nextExpectedDate,
          lateCount: sum.lateCount,
          lateCents: sum.lateCents,
          late: formatSGD(sum.lateCents),
          payouts: list.slice(0, 10).map((s) => ({
            businessDate: s.businessDate,
            channel: s.channel,
            netCents: s.netCents,
            net: formatSGD(s.netCents),
            status: s.status,
            expectedDate: s.expectedDate,
            paidDate: s.paidDate,
          })),
        }
      },
    },
    {
      name: 'get_invoice',
      description: 'The monthly bill from NETS for one month (YYYY-MM): total, due date, status and each charge.',
      inputSchema: z.strictObject({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'YYYY-MM') }),
      async handler({ month }) {
        const all = await deps.listInvoices(merchantId)
        const inv = all.find((i) => String(i.period).startsWith(month))
        if (!inv) return { month, found: false }
        const full = await deps.getInvoiceWithLines(merchantId, inv.id)
        return {
          month,
          found: true,
          totalCents: inv.totalCents,
          total: formatSGD(inv.totalCents),
          status: effectiveInvoiceStatus(inv.status, inv.dueDate, today()),
          dueDate: inv.dueDate,
          lines: (full?.lines ?? []).map((l) => ({ description: l.description, amountCents: l.amountCents, amount: formatSGD(l.amountCents) })),
        }
      },
    },
    {
      name: 'search_help_centre',
      description:
        'Search the help centre for how NETS works: settlement timing, fees (MDR, GST), failed payments, bills, exports and contacting NETS. Sample help content, not official NETS policy.',
      inputSchema: z.strictObject({ query: z.string().min(1).max(200) }),
      async handler({ query }) {
        const hits = await deps.searchKb(query)
        return {
          query,
          results: hits.map((h) => ({ source: h.source, heading: h.heading, content: h.content, href: pageForSource(h) })),
        }
      },
    },
  ]
}

/**
 * Validate input with the tool's schema, then run it. Throws on an unknown tool or bad input.
 * @param {AssistantTool[]} tools
 * @param {string} name
 * @param {unknown} input
 */
export async function callTool(tools, name, input) {
  const tool = tools.find((t) => t.name === name)
  if (!tool) throw new Error(`Unknown tool: ${name}`)
  const parsed = tool.inputSchema.parse(input ?? {})
  return tool.handler(parsed)
}
