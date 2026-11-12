import { describe, expect, it } from 'vitest'
import { generateDataset } from '@/lib/synthetic/generate'
import { sgtDate } from '@/lib/dates'
import { CHANNELS } from '@/lib/channels'
import { feeFor } from '@/lib/fees'

const opts = { start: '2026-05-01', end: '2026-11-11', today: '2026-11-11', seed: 42 } as const
const hawker = generateDataset({ ...opts, profile: 'hawker' })
const retail = generateDataset({ ...opts, profile: 'retail' })

describe('sgtDate', () => {
  it('buckets a UTC timestamp into the Singapore calendar day', () => {
    expect(sgtDate('2026-10-31T16:30:00Z')).toBe('2026-11-01')
    expect(sgtDate('2026-10-31T15:59:59Z')).toBe('2026-10-31')
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
      expect(t.fee_cents).toBe(t.status === 'success' ? feeFor(t.channel, t.amount_cents) : 0)
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
      const s = byId.get(t.settlement_id!)!
      expect(s.business_date).toBe(sgtDate(t.created_at))
      expect(s.channel).toBe(t.channel)
    }
  })

  it('keeps settlement gross equal to its transactions except the injected mismatch', () => {
    const sums = new Map<string, number>()
    for (const t of hawker.transactions) {
      if (t.settlement_id) sums.set(t.settlement_id, (sums.get(t.settlement_id) ?? 0) + t.amount_cents)
    }
    for (const s of hawker.settlements) {
      const expected = sums.get(s.id)!
      if (s.business_date === '2026-10-18' && s.channel === 'card') {
        expect(s.gross_cents).toBe(expected - 4210)
      } else {
        expect(s.gross_cents).toBe(expected)
      }
      expect(s.net_cents).toBe(s.gross_cents - s.fee_cents)
    }
  })

  it('injects a delayed NETS QR settlement on 29 Oct 2026', () => {
    const s = hawker.settlements.find((s) => s.business_date === '2026-10-29' && s.channel === 'nets_qr')!
    expect(s.status).toBe('delayed')
    expect(s.paid_date).toBeNull()
  })

  it('injects a $3.60 overcharge on the October cards MDR invoice line', () => {
    const oct = hawker.invoices.find((i) => i.period === '2026-10-01')!
    const line = hawker.invoiceLines.find((l) => l.invoice_id === oct.id && l.channel === 'card')!
    const computed = hawker.transactions
      .filter((t) => t.channel === 'card' && t.status === 'success' && sgtDate(t.created_at).startsWith('2026-10'))
      .reduce((a, t) => a + t.fee_cents, 0)
    expect(line.amount_cents).toBe(computed + 360)
    const lines = hawker.invoiceLines.filter((l) => l.invoice_id === oct.id)
    expect(oct.total_cents).toBe(lines.reduce((a, l) => a + l.amount_cents, 0))
  })

  it('bills only full months, with October unpaid and earlier months paid', () => {
    expect(hawker.invoices.map((i) => i.period)).toEqual([
      '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01',
    ])
    expect(hawker.invoices.find((i) => i.period === '2026-10-01')!.status).toBe('unpaid')
    expect(hawker.invoices.find((i) => i.period === '2026-09-01')!.status).toBe('paid')
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

  it('has repeat customers', () => {
    const counts = new Map<string, number>()
    for (const t of hawker.transactions) counts.set(t.customer_ref, (counts.get(t.customer_ref) ?? 0) + 1)
    const repeatTxns = hawker.transactions.filter((t) => counts.get(t.customer_ref)! > 1).length
    expect(repeatTxns / hawker.transactions.length).toBeGreaterThan(0.15)
  })
})
