import { describe, expect, it } from 'vitest'
import { generateDataset } from '@/lib/synthetic/generate'
import { addDays, sgtDate, sgtHour, sgtToIso } from '@/lib/dates'
import { promotionByKey, outletSuits } from '@/lib/promotions/catalogue'
import { DEMOS } from '../../scripts/seed.mjs'
import { CHANNELS } from '@/lib/channels'
import { feeFor } from '@/lib/fees'

const opts = { start: '2026-05-01', end: '2026-11-11', today: '2026-11-11', seed: 42 }
const hawker = generateDataset({ ...opts, profile: 'hawker' })
const retail = generateDataset({ ...opts, profile: 'retail' })

describe('sgtDate', () => {
  it('buckets a UTC timestamp into the Singapore calendar day', () => {
    expect(sgtDate('2026-10-31T16:30:00Z')).toBe('2026-11-01')
    expect(sgtDate('2026-10-31T15:59:59Z')).toBe('2026-10-31')
  })

  it('assigns a transaction at SGT 00:30 to that Singapore business date', () => {
    const iso = sgtToIso('2026-10-18', 0, 30)
    expect(iso).toBe('2026-10-17T16:30:00.000Z')
    expect(sgtDate(iso)).toBe('2026-10-18')
  })
})

describe('generateDataset', () => {
  it('is deterministic for the same seed', () => {
    const again = generateDataset({ ...opts, profile: 'hawker' })
    expect(again.transactions.slice(0, 50)).toEqual(hawker.transactions.slice(0, 50))
  })

  it('differs for a different seed', () => {
    const other = generateDataset({ ...opts, seed: 7, profile: 'hawker' })
    expect(other.transactions[0]).not.toEqual(hawker.transactions[0])
  })

  it('produces positive integer amounts and correct fees', () => {
    for (const t of hawker.transactions) {
      expect(Number.isInteger(t.amount_cents)).toBe(true)
      expect(t.amount_cents).toBeGreaterThan(0)
      expect(t.fee_cents).toBe(t.status === 'failed' ? 0 : feeFor(t.channel, t.amount_cents))
    }
  })

  it('has a realistic failure rate between 0.5% and 3%', () => {
    for (const d of [hawker, retail]) {
      const failed = d.transactions.filter((t) => t.status === 'failed')
      const rate = failed.length / d.transactions.length
      expect(rate).toBeGreaterThan(0.005)
      expect(rate).toBeLessThan(0.03)
      expect(failed.every((t) => t.failure_code && t.settlement_id === null)).toBe(true)
    }
  })

  it('uses all five channels', () => {
    for (const d of [hawker, retail]) {
      expect(new Set(d.transactions.map((t) => t.channel))).toEqual(new Set(CHANNELS))
    }
  })

  it('creates the profile outlet and terminal counts', () => {
    expect(hawker.outlets).toHaveLength(1)
    expect(hawker.terminals).toHaveLength(2)
    expect(retail.outlets).toHaveLength(3)
    expect(retail.terminals).toHaveLength(6)
  })

  it('never generates transactions after today', () => {
    expect(hawker.transactions.every((t) => sgtDate(t.created_at) <= opts.today)).toBe(true)
  })

  it('settles each transaction on its Singapore business date and channel', () => {
    const byId = new Map(hawker.settlements.map((s) => [s.id, s]))
    for (const t of hawker.transactions.filter((t) => t.status === 'success')) {
      const s = byId.get(t.settlement_id)
      expect(s.business_date).toBe(sgtDate(t.created_at))
      expect(s.channel).toBe(t.channel)
    }
  })

  it('keeps settlement gross equal to its transactions except the injected mismatch', () => {
    const sums = new Map()
    for (const t of hawker.transactions) {
      if (t.settlement_id) sums.set(t.settlement_id, (sums.get(t.settlement_id) ?? 0) + t.amount_cents)
    }
    for (const s of hawker.settlements) {
      const expected = sums.get(s.id)
      if (s.business_date === '2026-10-18' && s.channel === 'card') {
        expect(s.gross_cents).toBe(expected - 4210)
      } else {
        expect(s.gross_cents).toBe(expected)
      }
      expect(s.net_cents).toBe(s.gross_cents - s.fee_cents - s.refund_cents)
    }
  })

  it('injects a delayed NETS QR settlement on 29 Oct 2026', () => {
    const s = hawker.settlements.find((s) => s.business_date === '2026-10-29' && s.channel === 'nets_qr')
    expect(s.status).toBe('delayed')
    expect(s.paid_date).toBeNull()
  })

  it('injects a $3.60 overcharge on the October cards MDR invoice line', () => {
    const oct = hawker.invoices.find((i) => i.period === '2026-10-01')
    const line = hawker.invoiceLines.find((l) => l.invoice_id === oct.id && l.channel === 'card')
    const computed = hawker.transactions
      .filter((t) => t.channel === 'card' && t.status !== 'failed' && sgtDate(t.created_at).startsWith('2026-10'))
      .reduce((a, t) => a + t.fee_cents, 0)
    expect(line.amount_cents).toBe(computed + 360)
    const lines = hawker.invoiceLines.filter((l) => l.invoice_id === oct.id)
    expect(oct.total_cents).toBe(lines.reduce((a, l) => a + l.amount_cents, 0))
  })

  it('bills only full months, with October unpaid and earlier months paid', () => {
    expect(hawker.invoices.map((i) => i.period)).toEqual([
      '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01',
    ])
    expect(hawker.invoices.find((i) => i.period === '2026-10-01').status).toBe('unpaid')
    expect(hawker.invoices.find((i) => i.period === '2026-09-01').status).toBe('paid')
  })

  it('marks settlements pending when their expected date is today or later', () => {
    for (const s of hawker.settlements) {
      if (s.expected_date >= opts.today && s.status !== 'delayed') expect(s.status).toBe('pending')
      if (s.status === 'paid') expect(s.paid_date).toBe(s.expected_date)
    }
  })

  it('includes one delayed settlement in the last few days for the demo', () => {
    const recent = hawker.settlements.filter((s) => s.business_date >= '2026-11-08' && s.status === 'delayed')
    expect(recent.length).toBe(1)
  })

  it("numbers each terminal's payments with a 6-digit STAN, unique per terminal", () => {
    const seen = new Set()
    for (const t of hawker.transactions) {
      expect(t.stan).toMatch(/^\d{6}$/)
      const key = `${t.terminal_id}|${t.stan}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})

describe('generateDataset options for franchisees', () => {
  const base = { profile: /** @type {const} */ ('cafe'), seed: 5005, start: '2026-05-01', end: '2026-11-15', today: '2026-11-15' }
  it('uses the outlets it is given, and leaves out the October problems and recent delay when asked', () => {
    const d = generateDataset({
      ...base,
      outlets: [{ name: 'Woodlands', address: 'x' }],
      recentDelay: false,
      anomalies: false,
    })
    expect(d.outlets.map((o) => o.name)).toEqual(['Woodlands'])
    expect(d.settlements.filter((s) => s.status === 'delayed')).toEqual([])
  })
  it('scales sales with the number of outlets', () => {
    const one = generateDataset({ ...base, outlets: [{ name: 'A', address: 'x' }] })
    const two = generateDataset({ ...base, outlets: [{ name: 'A', address: 'x' }, { name: 'B', address: 'y' }] })
    expect(two.transactions.length / one.transactions.length).toBeGreaterThan(1.8)
  })
})

describe('refunds and disputes in the demo data', () => {
  const today = '2026-11-23'
  const demo = generateDataset({ profile: 'hawker', seed: 1001, start: '2026-05-01', end: today, today })
  const others = [
    generateDataset({ profile: 'retail', seed: 2002, start: '2026-05-01', end: today, today }),
    generateDataset({
      profile: 'cafe', seed: 3003, start: '2026-05-01', end: today, today, recentDelay: false,
      outlets: [{ name: 'A', address: 'x' }, { name: 'B', address: 'y' }],
    }),
    generateDataset({ profile: 'cafe', seed: 4004, start: '2026-05-01', end: today, today, outlets: [{ name: 'A', address: 'x' }] }),
    generateDataset({
      profile: 'cafe', seed: 5005, start: '2026-05-01', end: today, today, recentDelay: false, anomalies: false,
      outlets: [{ name: 'A', address: 'x' }],
    }),
  ]
  const all = [demo, ...others]
  const dayDiff = (a, b) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000)

  it('keeps every existing payment the same', () => {
    // Recorded from the generator before refunds and disputes were added (18695 payments then; the past-promotion
    // lift adds extra payments in between, so these are looked up by id rather than by position).
    const byId = new Map(demo.transactions.map((t) => [t.id, t]))
    expect(demo.transactions.length).toBeGreaterThan(18695)
    for (const [id, amount, at] of [
      ['0c8883d2-0c1f-49d4-a443-adfe13cadba7', 701, '2026-04-30T23:16:24.000Z'],
      ['c1567f5e-7245-488e-af16-1def3dd0483a', 293, '2026-05-11T08:29:48.000Z'],
      ['2b1cd6b2-f758-4cac-816a-f076e63df349', 687, '2026-11-23T13:03:25.000Z'],
    ]) {
      const t = byId.get(id)
      expect([t.id, t.amount_cents, t.created_at]).toEqual([id, amount, at])
    }
  })

  it('refunds 3 to 5 payments a month, 1 to 14 days later, from the payout of the refund day', () => {
    for (const d of all) {
      const txns = new Map(d.transactions.map((t) => [t.id, t]))
      const setts = new Map(d.settlements.map((s) => [s.id, s]))
      const perMonth = new Map()
      for (const r of d.refunds) {
        const t = txns.get(r.transaction_id)
        expect(t.status).toBe('refunded')
        expect(['nets_qr', 'card', 'nets_click']).toContain(t.channel)
        expect(r.amount_cents).toBe(t.amount_cents)
        const gap = dayDiff(sgtDate(r.refunded_at), sgtDate(t.created_at))
        expect(gap).toBeGreaterThanOrEqual(1)
        expect(gap).toBeLessThanOrEqual(14)
        expect(sgtDate(r.refunded_at) < today).toBe(true)
        const s = setts.get(r.settlement_id)
        expect(s.channel).toBe(t.channel)
        expect(s.business_date).toBe(sgtDate(r.refunded_at))
        // the payment itself stays in its own day's payout
        expect(setts.get(t.settlement_id).business_date).toBe(sgtDate(t.created_at))
        expect(['wrong_order', 'charged_twice', 'sold_out', 'changed_mind', 'other']).toContain(r.reason)
        const m = sgtDate(t.created_at).slice(0, 7)
        perMonth.set(m, (perMonth.get(m) ?? 0) + 1)
      }
      expect(new Set(d.refunds.map((r) => r.transaction_id)).size).toBe(d.refunds.length)
      expect([...perMonth.keys()].sort()).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
      for (const n of perMonth.values()) {
        expect(n).toBeGreaterThanOrEqual(3)
        expect(n).toBeLessThanOrEqual(5)
      }
      for (const s of d.settlements) {
        const sum = d.refunds.filter((r) => r.settlement_id === s.id).reduce((a, r) => a + r.amount_cents, 0)
        expect(s.refund_cents).toBe(sum)
      }
    }
  })

  it('net is gross minus fees minus refunds', () => {
    for (const d of all) {
      for (const s of d.settlements) {
        expect(s.net_cents).toBe(s.gross_cents - s.fee_cents - s.refund_cents)
        expect(s.net_cents).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('keeps refunded payments in their payout gross and in the invoice fees', () => {
    const sums = new Map()
    for (const t of demo.transactions) {
      if (t.settlement_id) sums.set(t.settlement_id, (sums.get(t.settlement_id) ?? 0) + t.amount_cents)
    }
    for (const s of demo.settlements) {
      const off = s.business_date === '2026-10-18' && s.channel === 'card' ? 4210 : 0
      expect(s.gross_cents).toBe(sums.get(s.id) - off)
    }
    const sep = demo.invoices.find((i) => i.period === '2026-09-01')
    for (const c of CHANNELS) {
      const line = demo.invoiceLines.find((l) => l.invoice_id === sep.id && l.channel === c)
      const fees = demo.transactions
        .filter((t) => t.channel === c && t.status !== 'failed' && sgtDate(t.created_at).startsWith('2026-09'))
        .reduce((a, t) => a + t.fee_cents, 0)
      expect(line.amount_cents).toBe(fees)
    }
  })

  it('never puts a refund on the October check-up anomalies', () => {
    for (const d of all) {
      const txns = new Map(d.transactions.map((t) => [t.id, t]))
      const banned = new Set(
        d.settlements
          .filter(
            (s) =>
              (s.business_date === '2026-10-18' && s.channel === 'card') ||
              (s.business_date === '2026-10-29' && s.channel === 'nets_qr') ||
              s.status === 'delayed',
          )
          .map((s) => s.id),
      )
      for (const r of d.refunds) {
        expect(banned.has(r.settlement_id)).toBe(false)
        expect(banned.has(txns.get(r.transaction_id).settlement_id)).toBe(false)
      }
    }
    const a = demo.settlements.find((s) => s.business_date === '2026-10-18' && s.channel === 'card')
    expect(a.refund_cents).toBe(0)
  })

  it('makes one open, one waiting, one won and one accepted dispute on card, NETS Click or eNETS', () => {
    for (const d of all) {
      const txns = new Map(d.transactions.map((t) => [t.id, t]))
      expect(d.disputes.map((x) => x.status)).toEqual(['open', 'declined', 'won', 'accepted'])
      for (const x of d.disputes) {
        const t = txns.get(x.transaction_id)
        expect(['card', 'nets_click', 'enets']).toContain(t.channel)
        expect(t.status).toBe('success')
        expect(x.amount_cents).toBe(t.amount_cents)
        expect(x.respond_by).toBe(addDays(sgtDate(x.opened_at), 10))
      }
      const [open, waiting, won, accepted] = d.disputes
      expect(open).toMatchObject({ reason: 'charged_twice', respond_by: addDays(today, 7), answered_at: null, files: 0 })
      expect(open.opened_at).toBe(sgtToIso(addDays(today, -3), 10, 0))
      const ot = txns.get(open.transaction_id)
      const twins = d.transactions.filter(
        (t) =>
          t.terminal_id === ot.terminal_id && t.channel === ot.channel &&
          sgtDate(t.created_at) === sgtDate(ot.created_at) && t.amount_cents === ot.amount_cents,
      )
      expect(twins).toHaveLength(1)
      expect(Math.abs(dayDiff(sgtDate(ot.created_at), addDays(today, -10)))).toBeLessThanOrEqual(3)
      expect(waiting).toMatchObject({
        reason: 'not_recognised', decline_reason: 'made_payment', evidence: ['receipt', 'printout'],
        decide_by: addDays(addDays(today, -14), 30), decided_at: null, files: 2,
      })
      expect(sgtDate(waiting.answered_at)).toBe(addDays(today, -14))
      expect(won).toMatchObject({ reason: 'not_received', evidence: ['photo'], files: 1 })
      expect(sgtDate(won.decided_at)).toBe(addDays(today, -20))
      expect(accepted).toMatchObject({ reason: 'wrong_amount', files: 0, evidence: null, decline_reason: null })
      expect(sgtDate(accepted.answered_at)).toBe(addDays(today, -72))
    }
  })
})

describe('past promotions in the demo data', () => {
  const today = '2026-11-24'
  const START = '2026-05-01'
  const datasets = DEMOS.map((demo) => ({
    demo,
    d: generateDataset({
      profile: demo.profile, seed: demo.seed, start: START, end: today, today, outlets: demo.outlets,
      recentDelay: demo.recentDelay, anomalies: demo.anomalies, category: demo.category,
    }),
  }))
  const hawker1001 = datasets[0].d
  const weekday = (day) => new Date(`${day}T00:00:00Z`).getUTCDay()
  /** Successful sales of the promotion's payment type, outlets, weekdays (and hours) per day, averaged over [from, to]. */
  const dayAverage = (d, pp, promo, from, to) => {
    const outletIds = new Set(pp.outletIds)
    const days = []
    for (let x = from; x <= to; x = addDays(x, 1)) if (promo.days.includes(weekday(x))) days.push(x)
    const set = new Set(days)
    let total = 0
    for (const t of d.transactions) {
      if (t.status !== 'success' || t.channel !== pp.channel || !outletIds.has(t.outlet_id)) continue
      if (!set.has(sgtDate(t.created_at))) continue
      if (promo.hours && (sgtHour(t.created_at) < promo.hours[0] || sgtHour(t.created_at) >= promo.hours[1])) continue
      total += t.amount_cents
    }
    return total / days.length
  }

  it('keeps every existing payment amount and time the same', () => {
    // Recorded from the generator before the promotion lift was added (hawker, seed 1001, today 2026-11-24: 18774 payments).
    const byId = new Map(hawker1001.transactions.map((t) => [t.id, t]))
    const refs = [
      ['0c8883d2-0c1f-49d4-a443-adfe13cadba7', 701, '2026-04-30T23:16:24.000Z'],
      ['c1567f5e-7245-488e-af16-1def3dd0483a', 293, '2026-05-11T08:29:48.000Z'],
      ['bb6859f2-808b-4f26-97a5-fed87fc8c595', 546, '2026-11-24T12:42:00.000Z'],
    ]
    for (const [id, amount, at] of refs) {
      const t = byId.get(id)
      expect([t.id, t.amount_cents, t.created_at]).toEqual([id, amount, at])
    }
    expect(hawker1001.transactions[0].id).toBe(refs[0][0])
    expect(hawker1001.transactions.at(-1).id).toBe(refs[2][0])
    expect(hawker1001.transactions.length).toBeGreaterThan(18774)
    // Still sorted by time.
    for (let i = 1; i < hawker1001.transactions.length; i++) {
      expect(hawker1001.transactions[i - 1].created_at <= hawker1001.transactions[i].created_at).toBe(true)
    }
  })

  it('adds 2 past promotions per business that fit its category and outlets', () => {
    for (const { demo, d } of datasets) {
      expect(d.pastPromotions).toHaveLength(2)
      const [recent, older] = d.pastPromotions
      expect(recent.channel).not.toBe(older.channel)
      const outlets = new Map(d.outlets.map((o) => [o.id, o]))
      for (const pp of d.pastPromotions) {
        const promo = promotionByKey(pp.key)
        expect(promo.channel).toBe(pp.channel)
        expect(promo.categories).toContain(demo.category)
        expect(pp.outletIds.length).toBeGreaterThan(0)
        // every suitable outlet takes part, and only those
        expect(pp.outletIds).toEqual(d.outlets.filter((o) => outletSuits(pp.channel, o)).map((o) => o.id))
        for (const oid of pp.outletIds) expect(outletSuits(pp.channel, outlets.get(oid))).toBe(true)
        expect(addDays(pp.starts_on, 27)).toBe(pp.ends_on)
        for (const [day, ch] of [['2026-10-18', 'card'], ['2026-10-29', 'nets_qr']]) {
          if (pp.channel === ch) expect(day < pp.starts_on || day > pp.ends_on).toBe(true)
        }
      }
      expect(recent.ends_on >= addDays(today, -56) && recent.ends_on <= addDays(today, -28)).toBe(true)
      expect(older.ends_on >= addDays(today, -91) && older.ends_on <= addDays(today, -63)).toBe(true)
    }
    const tan = datasets.find(({ demo }) => demo.profile === 'retail').d
    expect(tan.outlets.map((o) => o.online)).toEqual([false, false, true])
    expect(hawker1001.outlets.map((o) => o.online)).toEqual([false])
  })

  it('lifts sales on past promotion days by about the catalogue lift', () => {
    for (const { d } of datasets) {
      for (const pp of d.pastPromotions) {
        const promo = promotionByKey(pp.key)
        const during = dayAverage(d, pp, promo, pp.starts_on, pp.ends_on)
        const before = dayAverage(d, pp, promo, addDays(pp.starts_on, -28), addDays(pp.starts_on, -1))
        const lift = (during / before - 1) * 100
        expect(Math.abs(lift - promo.liftPct)).toBeLessThanOrEqual(4)
      }
    }
  })

  it('still injects the 3 October anomalies', () => {
    for (const { demo, d } of datasets) {
      if (demo.anomalies === false) continue
      const sums = new Map()
      for (const t of d.transactions) {
        if (t.settlement_id) sums.set(t.settlement_id, (sums.get(t.settlement_id) ?? 0) + t.amount_cents)
      }
      const a = d.settlements.find((s) => s.business_date === '2026-10-18' && s.channel === 'card')
      expect(a.gross_cents).toBe(sums.get(a.id) - 4210)
      const b = d.settlements.find((s) => s.business_date === '2026-10-29' && s.channel === 'nets_qr')
      expect(b.status).toBe('delayed')
      const oct = d.invoices.find((i) => i.period === '2026-10-01')
      const line = d.invoiceLines.find((l) => l.invoice_id === oct.id && l.channel === 'card')
      const computed = d.transactions
        .filter((t) => t.channel === 'card' && t.status !== 'failed' && sgtDate(t.created_at).startsWith('2026-10'))
        .reduce((x, t) => x + t.fee_cents, 0)
      expect(line.amount_cents).toBe(computed + 360)
    }
  })

  it('gives the extra payments STANs, payouts and fees like any other payment', () => {
    const d = hawker1001
    const seen = new Set()
    for (const t of d.transactions) {
      const key = `${t.terminal_id}|${t.stan}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
      if (t.status !== 'failed') expect(t.settlement_id).toBeTruthy()
    }
    const terminals = new Map(d.terminals.map((t) => [t.id, t]))
    for (const t of d.transactions) expect(terminals.get(t.terminal_id).outlet_id).toBe(t.outlet_id)
  })
})
