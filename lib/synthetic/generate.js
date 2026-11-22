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
 *   fee_cents: number, status: 'success' | 'failed', failure_code: string | null, created_at: string,
 *   stan: string, settlement_id: string | null }[]} transactions
 * @property {{ id: string, channel: Channel, business_date: string, expected_date: string, paid_date: string | null,
 *   status: 'paid' | 'pending' | 'delayed', gross_cents: number, fee_cents: number, net_cents: number }[]} settlements
 * @property {{ id: string, period: string, issued_date: string, due_date: string, status: 'paid' | 'unpaid',
 *   total_cents: number }[]} invoices
 * @property {{ id: string, invoice_id: string, description: string, channel: Channel | null,
 *   amount_cents: number }[]} invoiceLines
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
  for (const s of settlements) s.net_cents = s.gross_cents - s.fee_cents

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
      if (t.status !== 'success') continue
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

  return { outlets, terminals, transactions, settlements, invoices, invoiceLines }
}
