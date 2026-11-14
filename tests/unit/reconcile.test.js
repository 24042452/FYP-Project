import { describe, expect, it } from 'vitest'
import { reconcile } from '../../lib/recon/reconcile.js'

const TODAY = '2026-11-12'

/** October fixture: the three seeded anomalies plus 2 failed payments. */
function octoberFixture() {
  return {
    month: '2026-10',
    today: TODAY,
    txnAgg: [
      { day: '2026-10-17', channel: 'card', grossCents: 10000, feeCents: 250, failed: [] },
      { day: '2026-10-18', channel: 'card', grossCents: 50000, feeCents: 1250, failed: [{ id: 't-fail-1', code: '51', amountCents: 1200 }] },
      { day: '2026-10-29', channel: 'nets_qr', grossCents: 20000, feeCents: 100, failed: [{ id: 't-fail-2', code: 'TO', amountCents: 800 }] },
      { day: '2026-10-30', channel: 'nets_qr', grossCents: 30000, feeCents: 150, failed: [] },
    ],
    settlements: [
      { id: 's1', day: '2026-10-17', channel: 'card', grossCents: 10000, status: 'paid', expectedDate: '2026-10-19' },
      { id: 's2', day: '2026-10-18', channel: 'card', grossCents: 50000 - 4210, status: 'paid', expectedDate: '2026-10-20' },
      { id: 's3', day: '2026-10-29', channel: 'nets_qr', grossCents: 20000, status: 'delayed', expectedDate: '2026-10-30' },
      { id: 's4', day: '2026-10-30', channel: 'nets_qr', grossCents: 30000, status: 'paid', expectedDate: '2026-10-31' },
    ],
    invoiceLines: [
      { chargeType: 'mdr', channel: 'card', amountCents: 1500 + 360 },
      { chargeType: 'mdr', channel: 'nets_qr', amountCents: 250 },
      { chargeType: 'portal_fee', channel: null, amountCents: 1000 },
    ],
  }
}

describe('reconcile', () => {
  it('finds exactly the three anomalies and the failed payments', () => {
    const r = reconcile(octoberFixture())
    const by = (t) => r.exceptions.filter((e) => e.type === t)
    expect(by('amount_mismatch')).toHaveLength(1)
    expect(by('amount_mismatch')[0]).toMatchObject({ ref: 's2', expectedCents: 50000, actualCents: 50000 - 4210 })
    expect(by('amount_mismatch')[0].message).toBe('Short by $42.10 · Cards sales on 18 Oct')
    expect(by('settlement_delay')).toHaveLength(1)
    expect(by('settlement_delay')[0].message).toBe('NETS QR money for 29 Oct is late (was due 30 Oct)')
    expect(by('fee_mismatch')).toHaveLength(1)
    expect(by('fee_mismatch')[0]).toMatchObject({ channel: 'card', expectedCents: 1500, actualCents: 1860 })
    expect(by('fee_mismatch')[0].message).toBe('Cards fees on your October bill are $3.60 more than your payments add up to')
    expect(by('failed_payment')).toHaveLength(2)
    expect(by('failed_payment')[0].message).toBe("$8.00 payment didn't go through · The payment timed out before the customer confirmed.")
    expect(by('missing_settlement')).toHaveLength(0)
    expect(r.exceptions).toHaveLength(5)
  })

  it('sorts mismatch, missing, delay, fee, then failed (newest first)', () => {
    const r = reconcile(octoberFixture())
    expect(r.exceptions.map((e) => e.type)).toEqual([
      'amount_mismatch', 'settlement_delay', 'fee_mismatch', 'failed_payment', 'failed_payment',
    ])
    expect(r.exceptions.filter((e) => e.type === 'failed_payment').map((e) => e.ref)).toEqual(['t-fail-2', 't-fail-1'])
  })

  it('counts checked (settlements + MDR lines) and matched', () => {
    const r = reconcile(octoberFixture())
    expect(r.checked).toBe(6)
    expect(r.matched).toBe(3) // s1, s4 and the NETS QR fee line
    expect(r.matchRate).toBeCloseTo(0.5)
  })

  it('tolerates a 1 cent difference but not 2 cents', () => {
    const f = octoberFixture()
    f.settlements[0].grossCents = 10000 - 1
    f.invoiceLines[1].amountCents = 250 + 1
    expect(reconcile(f).exceptions.some((e) => e.ref === 's1' || (e.type === 'fee_mismatch' && e.channel === 'nets_qr'))).toBe(false)
    f.settlements[0].grossCents = 10000 - 2
    f.invoiceLines[1].amountCents = 250 + 2
    const r = reconcile(f)
    expect(r.exceptions.some((e) => e.type === 'amount_mismatch' && e.ref === 's1')).toBe(true)
    expect(r.exceptions.some((e) => e.type === 'fee_mismatch' && e.channel === 'nets_qr')).toBe(true)
  })

  it('flags successful payments with no settlement, but not days with only failures or days not yet due', () => {
    const r = reconcile({
      month: '2026-11', today: '2026-11-12',
      txnAgg: [
        { day: '2026-11-03', channel: 'card', grossCents: 5000, feeCents: 0, failed: [] },
        { day: '2026-11-04', channel: 'card', grossCents: 0, feeCents: 0, failed: [{ id: 'x', code: '05' }] },
        { day: '2026-11-12', channel: 'card', grossCents: 7000, feeCents: 0, failed: [] },
      ],
      settlements: [], invoiceLines: [],
    })
    expect(r.exceptions.filter((e) => e.type === 'missing_settlement').map((e) => e.ref)).toEqual(['2026-11-03|card'])
    expect(r.exceptions.find((e) => e.type === 'failed_payment').message).toBe("A payment didn't go through · The customer's bank declined it.")
    expect(r.checked).toBe(1)
    expect(r.matched).toBe(0)
    expect(r.matchRate).toBe(0)
  })

  it('a pending settlement is late only when its expected date has passed', () => {
    const mk = (expectedDate) => ({
      month: '2026-11', today: '2026-11-12', txnAgg: [{ day: '2026-11-10', channel: 'card', grossCents: 100, feeCents: 0, failed: [] }],
      settlements: [{ id: 's', day: '2026-11-10', channel: 'card', grossCents: 100, status: 'pending', expectedDate }], invoiceLines: [],
    })
    expect(reconcile(mk('2026-11-11')).exceptions.map((e) => e.type)).toEqual(['settlement_delay'])
    expect(reconcile(mk('2026-11-12')).exceptions).toEqual([])
    expect(reconcile(mk(null)).exceptions).toEqual([])
  })

  it('an empty month is clean', () => {
    expect(reconcile({ month: '2026-09', today: TODAY, txnAgg: [], settlements: [], invoiceLines: [] })).toEqual({
      checked: 0, matched: 0, matchRate: 1, exceptions: [],
    })
  })
})
