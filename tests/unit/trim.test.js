import { describe, it, expect } from 'vitest'
import { trimFuture } from '../../lib/synthetic/trim.js'

const mk = () => ({
  outlets: [],
  terminals: [],
  invoices: [],
  invoiceLines: [],
  transactions: [
    { id: 't1', amount_cents: 1000, fee_cents: 10, status: 'success', created_at: '2026-11-13T01:00:00.000Z', settlement_id: 's1' },
    { id: 't2', amount_cents: 2000, fee_cents: 20, status: 'success', created_at: '2026-11-13T05:00:00.000Z', settlement_id: 's1' },
    { id: 't3', amount_cents: 500, fee_cents: 0, status: 'failed', created_at: '2026-11-13T06:00:00.000Z', settlement_id: null },
    { id: 't4', amount_cents: 700, fee_cents: 7, status: 'success', created_at: '2026-11-13T07:00:00.000Z', settlement_id: 's2' },
    { id: 't0', amount_cents: 900, fee_cents: 9, status: 'success', created_at: '2026-11-12T07:00:00.000Z', settlement_id: 's0' },
  ],
  settlements: [
    { id: 's0', gross_cents: 900, fee_cents: 9, net_cents: 891, status: 'paid' },
    { id: 's1', gross_cents: 3000, fee_cents: 30, net_cents: 2970, status: 'pending' },
    { id: 's2', gross_cents: 700, fee_cents: 7, net_cents: 693, status: 'pending' },
  ],
})

describe('trimFuture', () => {
  it('drops transactions after now and recomputes affected settlements', () => {
    const out = trimFuture(mk(), '2026-11-13T03:00:00.000Z')
    expect(out.transactions.map((t) => t.id)).toEqual(['t1', 't0'])
    const s1 = out.settlements.find((s) => s.id === 's1')
    expect(s1).toMatchObject({ gross_cents: 1000, fee_cents: 10, net_cents: 990 })
  })

  it('removes settlements left with no transactions and leaves others untouched', () => {
    const out = trimFuture(mk(), '2026-11-13T03:00:00.000Z')
    expect(out.settlements.map((s) => s.id)).toEqual(['s0', 's1'])
    expect(out.settlements[0]).toMatchObject({ gross_cents: 900, net_cents: 891 })
  })

  it('does not mutate the input', () => {
    const d = mk()
    trimFuture(d, '2026-11-13T03:00:00.000Z')
    expect(d.transactions).toHaveLength(5)
    expect(d.settlements[1].gross_cents).toBe(3000)
  })
})
