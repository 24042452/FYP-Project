import { CHANNELS, CHANNEL_LABELS } from '../channels.js'
import { feeFor, TERMINAL_RENTAL_CENTS } from '../fees.js'
import { addDays, addMonths, dayOfWeek, eachDay, monthEnd, monthStart, sgtDate, sgtToIso } from '../dates.js'
import { mulberry32, normal, uuidFrom, weighted } from './prng.js'
import { PROFILES } from './profiles.js'

/**
 * @typedef {import('../channels.js').Channel} Channel
 * @typedef {import('./profiles.js').ProfileKey} ProfileKey
 *
 * @typedef {object} Dataset
 * @property {{ id: string, name: string, address: string }[]} outlets
 * @property {{ id: string, outlet_id: string, label: string }[]} terminals
 * @property {{ id: string, outlet_id: string, terminal_id: string, channel: Channel, amount_cents: number,
 *   fee_cents: number, status: 'success' | 'failed' | 'refunded', failure_code: string | null, created_at: string,
 *   stan: string, settlement_id: string | null }[]} transactions
 * @property {{ id: string, channel: Channel, business_date: string, expected_date: string, paid_date: string | null,
 *   status: 'paid' | 'pending' | 'delayed', gross_cents: number, fee_cents: number, refund_cents: number, net_cents: number }[]} settlements
 * @property {{ id: string, period: string, issued_date: string, due_date: string, status: 'paid' | 'unpaid',
 *   total_cents: number }[]} invoices
 * @property {{ id: string, invoice_id: string, description: string, channel: Channel | null,
 *   amount_cents: number }[]} invoiceLines
 * @property {Refund[]} refunds
 * @property {Dispute[]} disputes
 *
 * @typedef {{ id: string, transaction_id: string, amount_cents: number,
 *   reason: 'wrong_order' | 'charged_twice' | 'sold_out' | 'changed_mind' | 'other',
 *   refunded_at: string, settlement_id: string }} Refund
 * @typedef {{ id: string, transaction_id: string, amount_cents: number,
 *   reason: 'charged_twice' | 'not_received' | 'not_recognised' | 'wrong_amount', opened_at: string,
 *   respond_by: string, status: 'open' | 'accepted' | 'declined' | 'won' | 'lost', answered_at: string | null,
 *   decline_reason: string | null, evidence: string[] | null, note: string | null, decide_by: string | null,
 *   decided_at: string | null, files: number }} Dispute
 */

/** @type {[string, number][]} */
const FAILURE_WEIGHTS = [['51', 35], ['05', 25], ['91', 15], ['TO', 15], ['CX', 10]]

/**
 * Generate a deterministic synthetic NETS-style dataset (no merchant_id; the seeder adds it).
 * Contains exactly 3 injected October 2026 anomalies plus one recent delayed settlement for the demo.
 * @param {{ profile: ProfileKey, seed: number, start: string, end: string, today: string, outlets?: { name: string, address: string }[], recentDelay?: boolean, anomalies?: boolean }} o
 *   `outlets` replaces the profile's outlets (franchisees share a profile but each has its own shops); sales scale
 *   with the number of outlets. `recentDelay: false` leaves out the late payout in the last few days;
 *   `anomalies: false` leaves out the three October problems (a clean, healthy business).
 * @returns {Dataset}
 */
export function generateDataset({ profile, seed, start, end, today, outlets: outletOverride, recentDelay = true, anomalies = true }) {
  const p = PROFILES[profile]
  const rand = mulberry32(seed)
  const id = () => uuidFrom(rand)

  const outlets = (outletOverride ?? p.outlets).map((o) => ({ id: id(), ...o }))
  const terminals = outlets.flatMap((o) =>
    Array.from({ length: p.terminalsPerOutlet }, (_, i) => ({ id: id(), outlet_id: o.id, label: `Terminal ${i + 1}` })),
  )
  const terminalsByOutlet = new Map(outlets.map((o) => [o.id, terminals.filter((t) => t.outlet_id === o.id)]))

  const lastDay = end < today ? end : today

  /** @type {Dataset['transactions']} */
  const transactions = []
  for (const day of eachDay(start, lastDay)) {
    const n = Math.round(p.txnsPerDay * (outlets.length / p.outlets.length) * p.dowFactor[dayOfWeek(day)] * (0.9 + 0.2 * rand()))
    /** @type {Dataset['transactions']} */
    const dayTxns = []
    for (let i = 0; i < n; i++) {
      const hour = weighted(rand, p.hourWeights)
      const created_at = sgtToIso(day, hour, Math.floor(rand() * 60), Math.floor(rand() * 60))
      const channel = weighted(rand, p.channelWeights)
      const amount_cents = Math.max(50, Math.round(p.medianCents * Math.exp(0.6 * normal(rand))))
      const outlet = outlets[Math.floor(rand() * outlets.length)]
      const terms = /** @type {{ id: string }[]} */ (terminalsByOutlet.get(outlet.id))
      const terminal = terms[Math.floor(rand() * terms.length)]
      const failed = rand() < p.failureRate
      dayTxns.push({
        id: id(),
        outlet_id: outlet.id,
        terminal_id: terminal.id,
        channel,
        amount_cents,
        fee_cents: failed ? 0 : feeFor(channel, amount_cents),
        status: failed ? 'failed' : 'success',
        failure_code: failed ? weighted(rand, FAILURE_WEIGHTS) : null,
        created_at,
        stan: '',
        settlement_id: null,
      })
    }
    dayTxns.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
    transactions.push(...dayTxns)
  }

  // STAN (System Trace Audit Number): each terminal numbers its payments 000001, 000002, ... in time order.
  /** @type {Map<string, number>} */
  const stanByTerminal = new Map()
  for (const t of transactions) {
    const n = (stanByTerminal.get(t.terminal_id) ?? 0) + 1
    stanByTerminal.set(t.terminal_id, n)
    t.stan = String(n % 1_000_000).padStart(6, '0')
  }

  // Settlements: one per (SGT business date, channel)
  /** @type {Map<string, Dataset['settlements'][number]>} */
  const settleMap = new Map()
  for (const t of transactions) {
    if (t.status !== 'success') continue
    const bd = sgtDate(t.created_at)
    const key = `${bd}|${t.channel}`
    let s = settleMap.get(key)
    if (!s) {
      const expected_date = addDays(bd, t.channel === 'card' ? 2 : 1)
      const pending = expected_date >= today
      s = {
        id: id(),
        channel: t.channel,
        business_date: bd,
        expected_date,
        paid_date: pending ? null : expected_date,
        status: pending ? 'pending' : 'paid',
        gross_cents: 0,
        fee_cents: 0,
        refund_cents: 0,
        net_cents: 0,
      }
      settleMap.set(key, s)
    }
    s.gross_cents += t.amount_cents
    s.fee_cents += t.fee_cents
    t.settlement_id = s.id
  }
  const settlements = [...settleMap.values()].sort((a, b) =>
    a.business_date !== b.business_date
      ? a.business_date < b.business_date ? -1 : 1
      : CHANNELS.indexOf(a.channel) - CHANNELS.indexOf(b.channel),
  )

  /** @param {Dataset['settlements'][number]} s */
  const markDelayed = (s) => {
    s.status = 'delayed'
    s.paid_date = null
  }
  // Anomaly (a): October card settlement short by $42.10
  const a = settleMap.get('2026-10-18|card')
  if (a && anomalies) a.gross_cents -= 4210
  // Anomaly (b): October NETS QR settlement delayed
  const b = settleMap.get('2026-10-29|nets_qr')
  if (b && anomalies) markDelayed(b)
  // Demo extra: one delayed settlement among the most recent business days (kept out of October)
  const demo = settlements.find(
    (s) =>
      s.business_date >= addDays(lastDay, -3) &&
      s.business_date < lastDay &&
      s.expected_date < today &&
      s.status === 'paid' &&
      !s.business_date.startsWith('2026-10'),
  )
  if (demo && recentDelay) markDelayed(demo)

  // Refunds and disputes use their own random stream so every value above stays the same.
  const rand2 = mulberry32(seed ^ 0x5eed)
  const noRefund = new Set(['2026-10-18|card', '2026-10-29|nets_qr'])
  if (demo && recentDelay) noRefund.add(`${demo.business_date}|${demo.channel}`)
  const refunds = makeRefunds(rand2, transactions, settleMap, noRefund, today)
  for (const s of settlements) s.net_cents = s.gross_cents - s.fee_cents - s.refund_cents
  const disputes = makeDisputes(rand2, transactions, today)

  // Invoices: one per full month inside the range
  /** @type {Dataset['invoices']} */
  const invoices = []
  /** @type {Dataset['invoiceLines']} */
  const invoiceLines = []
  /** @type {string[]} */
  const periods = []
  for (let m = monthStart(start); monthEnd(m) <= lastDay; m = addMonths(m, 1)) {
    if (m >= start) periods.push(m)
  }
  periods.forEach((period, idx) => {
    const last = monthEnd(period)
    const invId = id()
    /** @type {Partial<Record<Channel, number>>} */
    const fees = {}
    for (const t of transactions) {
      if (t.status === 'failed') continue // refunded payments were paid out, and billed, on their own day
      const d = sgtDate(t.created_at)
      if (d >= period && d <= last) fees[t.channel] = (fees[t.channel] ?? 0) + t.fee_cents
    }
    /** @type {Dataset['invoiceLines']} */
    const lines = CHANNELS.filter((c) => fees[c] !== undefined).map((c) => {
      let amount = /** @type {number} */ (fees[c])
      if (anomalies && period === '2026-10-01' && c === 'card') amount += 360 // anomaly (c)
      return { id: id(), invoice_id: invId, description: `MDR fees – ${CHANNEL_LABELS[c]}`, channel: c, amount_cents: amount }
    })
    lines.push({ id: id(), invoice_id: invId, description: 'Terminal rental', channel: null, amount_cents: TERMINAL_RENTAL_CENTS * terminals.length })
    lines.push({ id: id(), invoice_id: invId, description: 'Monthly portal fee', channel: null, amount_cents: 0 })
    invoiceLines.push(...lines)
    invoices.push({
      id: invId,
      period,
      issued_date: addDays(last, 1),
      due_date: addDays(last, 15),
      status: idx === periods.length - 1 ? 'unpaid' : 'paid',
      total_cents: lines.reduce((x, l) => x + l.amount_cents, 0),
    })
  })

  return { outlets, terminals, transactions, settlements, invoices, invoiceLines, refunds, disputes }
}

/** @type {[Refund['reason'], number][]} */
const REFUND_REASONS = [['wrong_order', 35], ['charged_twice', 20], ['sold_out', 20], ['changed_mind', 15], ['other', 10]]

/** Payment types the demo refunds (the spec: NETS QR, cards and NETS Click). */
const REFUNDABLE = new Set(['nets_qr', 'card', 'nets_click'])

/**
 * Full refunds of 3 to 5 successful NETS QR, card or NETS Click payments per calendar month, 1 to 14 days after
 * the purchase, each taken from the payout of the refund day (same payment type). The payment keeps counting in its own day's payout.
 * Mutates the chosen payments (status 'refunded') and the refund payouts (refund_cents).
 * @param {() => number} rand
 * @param {Dataset['transactions']} transactions
 * @param {Map<string, Dataset['settlements'][number]>} settleMap keyed `business_date|channel`
 * @param {Set<string>} noRefund `business_date|channel` payouts kept free of refunds (check-up problems, late payout)
 * @param {string} today
 * @returns {Refund[]}
 */
function makeRefunds(rand, transactions, settleMap, noRefund, today) {
  /** @type {Map<string, Dataset['transactions']>} */
  const byMonth = new Map()
  for (const t of transactions) {
    const day = sgtDate(t.created_at)
    if (t.status !== 'success' || !REFUNDABLE.has(t.channel) || day >= addDays(today, -1) || noRefund.has(`${day}|${t.channel}`)) continue
    const m = day.slice(0, 7)
    if (!byMonth.has(m)) byMonth.set(m, [])
    byMonth.get(m)?.push(t)
  }
  /** @type {Refund[]} */
  const refunds = []
  for (const candidates of byMonth.values()) {
    const want = 3 + Math.floor(rand() * 3)
    let made = 0
    for (let tries = 0; made < want && tries < 50; tries++) {
      const t = candidates[Math.floor(rand() * candidates.length)]
      if (t.status !== 'success') continue // already refunded
      const day = sgtDate(t.created_at)
      const first = addDays(day, 1 + Math.floor(rand() * 14))
      // That day's payout of this payment type, or one of the next 3 days (still within 14 days and before today).
      let refundDay = null
      for (let k = 0; k <= 3; k++) {
        const d = addDays(first, k)
        if (d > addDays(day, 14) || d >= today) break
        const s = settleMap.get(`${d}|${t.channel}`)
        if (s && !noRefund.has(`${d}|${t.channel}`) && s.gross_cents - s.fee_cents - s.refund_cents >= t.amount_cents) {
          refundDay = d
          break
        }
      }
      if (!refundDay) continue
      const s = /** @type {Dataset['settlements'][number]} */ (settleMap.get(`${refundDay}|${t.channel}`))
      t.status = 'refunded'
      s.refund_cents += t.amount_cents
      refunds.push({
        id: uuidFrom(rand),
        transaction_id: t.id,
        amount_cents: t.amount_cents,
        reason: weighted(rand, REFUND_REASONS),
        refunded_at: sgtToIso(refundDay, 11 + Math.floor(rand() * 9), Math.floor(rand() * 60), Math.floor(rand() * 60)),
        settlement_id: s.id,
      })
      made++
    }
  }
  return refunds.sort((a, b) => (a.refunded_at < b.refunded_at ? -1 : 1))
}

/** Payment types a customer's bank can dispute (chargebacks). */
const DISPUTABLE = new Set(['card', 'nets_click', 'enets'])

/**
 * Four disputes relative to `today`: one open (to answer live), one waiting for NETS, one won, one accepted.
 * Each is on a successful card, NETS Click or eNETS payment nearest to its target day; a dispute is left out
 * when no such payment exists.
 * @param {() => number} rand
 * @param {Dataset['transactions']} transactions
 * @param {string} today
 * @returns {Dispute[]}
 */
function makeDisputes(rand, transactions, today) {
  /** @type {Map<string, Dataset['transactions']>} */
  const byDay = new Map()
  /** @type {Map<string, number>} payments per SGT day + terminal + channel + amount */
  const sameAmount = new Map()
  for (const t of transactions) {
    const day = sgtDate(t.created_at)
    const key = `${day}|${t.terminal_id}|${t.channel}|${t.amount_cents}`
    sameAmount.set(key, (sameAmount.get(key) ?? 0) + 1)
    if (t.status !== 'success' || !DISPUTABLE.has(t.channel)) continue
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)?.push(t)
  }
  /** @type {Set<string>} */
  const used = new Set()
  /** @typedef {Dataset['transactions'][number]} Txn */
  /**
   * A payment on the day `daysAgo` before today, or the nearest day that has one (up to 14 days either side).
   * @param {number} daysAgo
   * @param {(t: Txn) => boolean} [ok]
   * @returns {Txn | null}
   */
  const pick = (daysAgo, ok = () => true) => {
    const target = addDays(today, -daysAgo)
    for (let k = 0; k <= 14; k++) {
      for (const d of k === 0 ? [target] : [addDays(target, -k), addDays(target, k)]) {
        if (d >= today) continue
        const list = (byDay.get(d) ?? []).filter((t) => !used.has(t.id) && ok(t))
        if (list.length) {
          const t = list[Math.floor(rand() * list.length)]
          used.add(t.id)
          return t
        }
      }
    }
    return null
  }
  /** @param {number} n @param {number} h @param {number} m */
  const at = (n, h, m) => sgtToIso(addDays(today, n), h, m)

  /** @type {Dispute[]} */
  const disputes = []
  /**
   * @param {Txn | null} t
   * @param {Omit<Dispute, 'id' | 'transaction_id' | 'amount_cents' | 'respond_by'>} d
   */
  const add = (t, d) => {
    if (!t) return
    disputes.push({
      id: uuidFrom(rand),
      transaction_id: t.id,
      amount_cents: t.amount_cents,
      ...d,
      respond_by: addDays(sgtDate(d.opened_at), 10),
    })
  }
  const blank = { answered_at: null, decline_reason: null, evidence: null, note: null, decide_by: null, decided_at: null, files: 0 }

  // Open: "charged twice", with only one payment of that amount that day at that terminal, so declining may win.
  /** @param {Txn} t */
  const unique = (t) => sameAmount.get(`${sgtDate(t.created_at)}|${t.terminal_id}|${t.channel}|${t.amount_cents}`) === 1
  add(pick(10, unique), { ...blank, reason: 'charged_twice', opened_at: at(-3, 10, 0), status: 'open' })
  add(pick(25), {
    ...blank,
    reason: 'not_recognised',
    opened_at: at(-18, 9, 30),
    status: 'declined',
    answered_at: at(-14, 15, 20),
    decline_reason: 'made_payment',
    evidence: ['receipt', 'printout'],
    note: 'The customer paid at the counter and took the receipt.',
    decide_by: addDays(today, -14 + 30),
    files: 2,
  })
  add(pick(60), {
    ...blank,
    reason: 'not_received',
    opened_at: at(-55, 11, 10),
    status: 'won',
    answered_at: at(-50, 14, 5),
    decline_reason: 'received',
    evidence: ['photo'],
    note: 'Photo of the order handed over at the counter.',
    decide_by: addDays(today, -50 + 30),
    decided_at: at(-20, 10, 0),
    files: 1,
  })
  add(pick(80), { ...blank, reason: 'wrong_amount', opened_at: at(-75, 10, 45), status: 'accepted', answered_at: at(-72, 16, 30) })
  return disputes
}
