import { CHANNELS, CHANNEL_LABELS } from '../channels.js'
import { feeFor, TERMINAL_RENTAL_CENTS } from '../fees.js'
import { addDays, addMonths, dayOfWeek, eachDay, monthEnd, monthStart, sgtDate, sgtHour, sgtToIso } from '../dates.js'
import { mulberry32, normal, uuidFrom, weighted } from './prng.js'
import { PROFILES } from './profiles.js'
import { PROMOTIONS, outletSuits } from '../promotions/catalogue.js'

/**
 * @typedef {import('../channels.js').Channel} Channel
 * @typedef {import('./profiles.js').ProfileKey} ProfileKey
 *
 * @typedef {object} Dataset
 * @property {{ id: string, name: string, address: string, online: boolean }[]} outlets
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
 * @property {PastPromotion[]} pastPromotions Two finished promotions (4 weeks each) whose days carry extra sales.
 *
 * @typedef {{ key: string, channel: Channel, outletIds: string[], starts_on: string, ends_on: string }} PastPromotion
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
 * Also picks 2 finished promotions from the catalogue (`pastPromotions`) and adds extra successful payments on their
 * days so those days' sales are about the catalogue lift higher (see `liftPastPromotions`).
 * @param {{ profile: ProfileKey, seed: number, start: string, end: string, today: string, outlets?: { name: string, address: string, online?: boolean }[], recentDelay?: boolean, anomalies?: boolean, category?: 'F&B' | 'Retail' }} o
 *   `outlets` replaces the profile's outlets (franchisees share a profile but each has its own shops); sales scale
 *   with the number of outlets. `recentDelay: false` leaves out the late payout in the last few days;
 *   `anomalies: false` leaves out the three October problems (a clean, healthy business).
 *   `category` is the business category the promotions must suit; by default 'Retail' for the retail profile and
 *   'F&B' for hawker and cafe (the seeder's categories).
 * @returns {Dataset}
 */
export function generateDataset({ profile, seed, start, end, today, outlets: outletOverride, recentDelay = true, anomalies = true, category }) {
  const p = PROFILES[profile]
  const rand = mulberry32(seed)
  const id = () => uuidFrom(rand)

  const outlets = (outletOverride ?? p.outlets).map((o) => ({ id: id(), ...o, online: Boolean(o.online) }))
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

  // Past promotions and their lift use a third random stream, so every payment above stays exactly the same.
  // The extra payments are added before STANs, payouts, invoices, refunds and disputes, so they behave like any other.
  const rand3 = mulberry32(seed ^ 0x9a0b)
  const pastPromotions = choosePastPromotions(rand3, {
    category: category ?? (profile === 'retail' ? 'Retail' : 'F&B'),
    outlets,
    transactions,
    start,
    today,
    lastDay,
    channels: new Set(p.channelWeights.filter(([, w]) => w > 0).map(([c]) => c)),
  })
  const extra = liftPastPromotions(rand3, { pastPromotions, transactions, terminalsByOutlet, hourWeights: p.hourWeights, medianCents: p.medianCents })
  if (extra.length) {
    transactions.push(...extra)
    // Stable sort: payments at the same second keep their order, with the extra ones after.
    transactions.sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
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

  return { outlets, terminals, transactions, settlements, invoices, invoiceLines, refunds, disputes, pastPromotions }
}

/** Day of the week as the promotion catalogue counts it: 0 = Sunday … 6 = Saturday. */
const catalogueDay = (/** @type {string} */ day) => new Date(`${day}T00:00:00Z`).getUTCDay()

/** Payment type + day pairs that carry the October check-up problems; promotions stay clear of them. */
const ANOMALY_DAYS = [['card', '2026-10-18'], ['nets_qr', '2026-10-29']]

/**
 * Successful sales per Singapore day for one promotion: its payment type, at its outlets, on its weekdays and in its hours.
 * @param {Dataset['transactions']} transactions
 * @param {import('../promotions/catalogue.js').Promotion} promo
 * @param {Set<string>} outletIds
 * @returns {Map<string, number>}
 */
function promotionDaySales(transactions, promo, outletIds) {
  /** @type {Map<string, number>} */
  const byDay = new Map()
  for (const t of transactions) {
    if (t.status !== 'success' || t.channel !== promo.channel || !outletIds.has(t.outlet_id)) continue
    const day = sgtDate(t.created_at)
    if (!promo.days.includes(catalogueDay(day))) continue
    if (promo.hours) {
      const h = sgtHour(t.created_at)
      if (h < promo.hours[0] || h >= promo.hours[1]) continue
    }
    byDay.set(day, (byDay.get(day) ?? 0) + t.amount_cents)
  }
  return byDay
}

/**
 * The promotion's weekdays between two dates (inclusive), and their sales.
 * @param {Map<string, number>} sales
 * @param {import('../promotions/catalogue.js').Promotion} promo
 * @param {string} from
 * @param {string} to
 */
function windowSales(sales, promo, from, to) {
  const days = eachDay(from, to).filter((d) => promo.days.includes(catalogueDay(d)))
  const total = days.reduce((x, d) => x + (sales.get(d) ?? 0), 0)
  return { days, total, average: days.length ? total / days.length : 0 }
}

/**
 * Two finished promotions for the demo: one ending 4 to 8 weeks before `today`, one 9 to 13 weeks before, each 28 days
 * long, on different payment types. Only catalogue promotions for the business category, on payment types the business
 * takes and with at least one suitable outlet (payment type ↔ outlet rule) are used; each runs at every suitable outlet.
 * A window never covers an October check-up problem day of its payment type, and a Cards window stays out of October
 * (the October card fee line). Windows whose own normal sales are already up on the 4 weeks before are passed over
 * when another fits, so the demo lift reads as the catalogue lift.
 * @param {() => number} rand
 * @param {{ category: 'F&B' | 'Retail', outlets: Dataset['outlets'], transactions: Dataset['transactions'], start: string,
 *   today: string, lastDay: string, channels: Set<string> }} o
 * @returns {PastPromotion[]}
 */
function choosePastPromotions(rand, { category, outlets, transactions, start, today, lastDay, channels }) {
  const eligible = PROMOTIONS.filter(
    (pr) => pr.categories.includes(category) && channels.has(pr.channel) && outlets.some((o) => outletSuits(pr.channel, o)),
  )
  // Shuffle (Fisher–Yates) so businesses get different promotions.
  for (let i = eligible.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[eligible[i], eligible[j]] = [eligible[j], eligible[i]]
  }
  /** @type {PastPromotion[]} */
  const chosen = []
  for (const [minDays, maxDays] of [[28, 56], [63, 91]]) {
    const span = maxDays - minDays + 1
    const first = Math.floor(rand() * span)
    /** @type {PastPromotion | null} */
    let pick = null
    // If no window fits well, the one whose normal sales rose least on the 4 weeks before.
    /** @type {{ run: PastPromotion, natural: number } | null} */
    let fallback = null
    for (const promo of eligible) {
      if (chosen.some((c) => c.channel === promo.channel)) continue
      const outletIds = outlets.filter((o) => outletSuits(promo.channel, o)).map((o) => o.id)
      const sales = promotionDaySales(transactions, promo, new Set(outletIds))
      for (let k = 0; k < span && !pick; k++) {
        const ends_on = addDays(today, -(minDays + ((first + k) % span)))
        const starts_on = addDays(ends_on, -27)
        if (ends_on >= lastDay || addDays(starts_on, -28) < start) continue
        if (ANOMALY_DAYS.some(([c, d]) => c === promo.channel && d >= starts_on && d <= ends_on)) continue
        if (promo.channel === 'card' && starts_on <= '2026-10-31' && ends_on >= '2026-10-01') continue
        const before = windowSales(sales, promo, addDays(starts_on, -28), addDays(starts_on, -1))
        const during = windowSales(sales, promo, starts_on, ends_on)
        if (!before.average || !during.days.length) continue
        const run = { key: promo.key, channel: promo.channel, outletIds, starts_on, ends_on }
        const natural = during.average / before.average - 1
        if (natural <= promo.liftPct / 100 - 0.03 && natural >= -0.25) pick = run
        else if (!fallback || natural < fallback.natural) fallback = { run, natural }
      }
      if (pick) break
    }
    pick ??= fallback?.run ?? null
    if (pick) chosen.push(pick)
  }
  return chosen
}

/**
 * Extra successful payments for each past promotion: on its days (and hours), at its outlets, of its payment type,
 * until the promotion days average about `liftPct` percent more than the same weekdays in the 4 weeks before.
 * The shortfall is spread evenly over the promotion days; whatever a day ends up over or under its share moves to the
 * next day's share, so the window total lands within about half a payment of the target.
 * @param {() => number} rand
 * @param {{ pastPromotions: PastPromotion[], transactions: Dataset['transactions'],
 *   terminalsByOutlet: Map<string, { id: string }[]>, hourWeights: [number, number][], medianCents: number }} o
 * @returns {Dataset['transactions']}
 */
function liftPastPromotions(rand, { pastPromotions, transactions, terminalsByOutlet, hourWeights, medianCents }) {
  /** @type {Dataset['transactions']} */
  const extra = []
  for (const run of pastPromotions) {
    const promo = /** @type {import('../promotions/catalogue.js').Promotion} */ (PROMOTIONS.find((pr) => pr.key === run.key))
    const sales = promotionDaySales(transactions, promo, new Set(run.outletIds))
    const before = windowSales(sales, promo, addDays(run.starts_on, -28), addDays(run.starts_on, -1))
    const during = windowSales(sales, promo, run.starts_on, run.ends_on)
    let remaining = before.average * (1 + promo.liftPct / 100) * during.days.length - during.total
    const [fromHour, toHour] = promo.hours ?? [0, 24]
    const hours = hourWeights.filter(([h]) => h >= fromHour && h < toHour)
    during.days.forEach((day, i) => {
      const need = remaining / (during.days.length - i)
      let added = 0
      for (;;) {
        const amount_cents = Math.max(50, Math.round(medianCents * Math.exp(0.6 * normal(rand))))
        // Stop when this payment would overshoot the day's share by more than it would leave short.
        if (need - added < amount_cents / 2) break
        const hour = weighted(rand, hours)
        const created_at = sgtToIso(day, hour, Math.floor(rand() * 60), Math.floor(rand() * 60))
        const outletId = run.outletIds[Math.floor(rand() * run.outletIds.length)]
        const terms = /** @type {{ id: string }[]} */ (terminalsByOutlet.get(outletId))
        extra.push({
          id: uuidFrom(rand),
          outlet_id: outletId,
          terminal_id: terms[Math.floor(rand() * terms.length)].id,
          channel: run.channel,
          amount_cents,
          fee_cents: feeFor(run.channel, amount_cents),
          status: 'success',
          failure_code: null,
          created_at,
          stan: '',
          settlement_id: null,
        })
        added += amount_cents
      }
      remaining -= added
    })
  }
  return extra
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
