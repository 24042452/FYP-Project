import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { getRecentSettlements, getSettlementSummary, getSettlementTotals, getOutletSettlementShares, listSettlements } from '../../lib/data/settlements.js'

const M = randomUUID()

const insert = (businessDate, channel, net, status, expected) =>
  adminExecute(
    `INSERT INTO settlements (settlement_id, merchant_id, business_date, channel, gross_cents, fee_cents, net_cents, status, expected_date)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [randomUUID(), M, businessDate, channel, net, net, status, expected],
  )

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({ merchants: [{ id: M }] })
  await insert('2026-11-10', 'nets_qr', 1000, 'paid', '2026-11-12')
  await insert('2026-11-10', 'card', 500, 'pending', '2026-11-13') // a day with mixed channels
  await insert('2026-11-09', 'nets_qr', 700, 'delayed', '2026-11-11')
  await insert('2026-11-08', 'nets_qr', 300, 'paid', '2026-11-10')
  await insert('2026-11-07', 'nets_qr', 200, 'pending', '2026-11-09') // pending past its date = late
})

describe('getRecentSettlements', () => {
  it('merges channels into one row per day, newest first, and honours the limit', async () => {
    const rows = await getRecentSettlements(M, 3)
    expect(rows).toEqual([
      { businessDate: '2026-11-10', netCents: 1500, refundCents: 0, status: 'pending', expectedDate: '2026-11-13' },
      { businessDate: '2026-11-09', netCents: 700, refundCents: 0, status: 'delayed', expectedDate: '2026-11-11' },
      { businessDate: '2026-11-08', netCents: 300, refundCents: 0, status: 'paid', expectedDate: '2026-11-10' },
    ])
  })
})

describe('refunds in payouts', () => {
  it('returns refundCents and net = gross − fee − refunds', async () => {
    const id = randomUUID()
    await adminExecute(
      `INSERT INTO settlements (settlement_id, merchant_id, business_date, channel, gross_cents, fee_cents, refund_cents, net_cents, status, expected_date)
       VALUES (?, ?, '2026-10-20', 'card', 10000, 220, 1280, 8500, 'paid', '2026-10-23')`,
      [id, M],
    )
    const rows = await listSettlements(M, { from: '2026-10-20', to: '2026-10-20', today: '2026-11-11' })
    expect(rows).toHaveLength(1)
    expect(rows[0].refundCents).toBe(1280)
    expect(rows[0].netCents).toBe(rows[0].grossCents - rows[0].feeCents - rows[0].refundCents)
    const recent = await getRecentSettlements(M, 50)
    expect(recent.find((d) => d.businessDate === '2026-10-20').refundCents).toBe(1280)
    await adminExecute(`DELETE FROM settlements WHERE settlement_id = ?`, [id])
  })
})

describe('outlet shares with refunds', () => {
  it('keeps a later-refunded payment in its own day and takes only this outlet refund on the refund day', async () => {
    const O1 = randomUUID(), O2 = randomUUID(), S1 = randomUUID(), S2 = randomUUID()
    const T1 = randomUUID(), T2 = randomUUID(), T3 = randomUUID()
    for (const o of [O1, O2]) await adminExecute(`INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, 'O')`, [o, M])
    await insertFixture({
      transactions: [
        { id: T1, merchantId: M, channel: 'card', status: 'refunded', amountCents: 2000, feeCents: 50, createdAt: '2026-10-01T04:00:00.000Z' },
        { id: T2, merchantId: M, channel: 'card', amountCents: 3000, feeCents: 75, createdAt: '2026-10-05T04:00:00.000Z' },
        { id: T3, merchantId: M, channel: 'card', status: 'refunded', amountCents: 900, feeCents: 20, createdAt: '2026-10-02T04:00:00.000Z' },
      ],
    })
    const ins = (id, day, gross, fee, refund) => adminExecute(
      `INSERT INTO settlements (settlement_id, merchant_id, business_date, channel, gross_cents, fee_cents, refund_cents, net_cents, status, expected_date)
       VALUES (?, ?, ?, 'card', ?, ?, ?, ?, 'paid', '2026-10-09')`, [id, M, day, gross, fee, refund, gross - fee - refund])
    await ins(S1, '2026-10-01', 2000, 50, 0)
    await ins(S2, '2026-10-05', 3000, 75, 2900) // T1 (O1) and T3 (O2) refunded here
    await adminExecute(`UPDATE transactions SET outlet_id = ?, settlement_id = ? WHERE transaction_id = ?`, [O1, S1, T1])
    await adminExecute(`UPDATE transactions SET outlet_id = ?, settlement_id = ? WHERE transaction_id = ?`, [O1, S2, T2])
    await adminExecute(`UPDATE transactions SET outlet_id = ?, settlement_id = ? WHERE transaction_id = ?`, [O2, S1, T3])
    await adminExecute(`INSERT INTO refunds (refund_id, merchant_id, transaction_id, amount_cents, reason, refunded_at, settlement_id) VALUES (?, ?, ?, 2000, 'other', '2026-10-05 05:00:00', ?)`, [randomUUID(), M, T1, S2])
    await adminExecute(`INSERT INTO refunds (refund_id, merchant_id, transaction_id, amount_cents, reason, refunded_at, settlement_id) VALUES (?, ?, ?, 900, 'other', '2026-10-05 05:00:00', ?)`, [randomUUID(), M, T3, S2])
    const o1 = await getOutletSettlementShares(M, O1, { since: '2000-01-01' })
    expect(o1.map((r) => [r.businessDate, r.grossCents, r.feeCents, r.refundCents, r.netCents])).toEqual([
      ['2026-10-05', 3000, 75, 2000, 925],
      ['2026-10-01', 2000, 50, 0, 1950],
    ])
    const o2 = await getOutletSettlementShares(M, O2, { since: '2000-01-01' })
    expect(o2.map((r) => [r.businessDate, r.grossCents, r.refundCents, r.netCents])).toEqual([
      ['2026-10-05', 0, 900, -900], // refund-only payout row
      ['2026-10-01', 900, 0, 880],
    ])
  })
})

describe('getSettlementSummary', () => {
  it('sums money truly on the way, finds the next date and counts late days', async () => {
    expect(await getSettlementSummary(M, '2026-11-11')).toEqual({
      pendingCents: 500, // only the not-yet-due one; the 200 is overdue
      nextExpectedDate: '2026-11-13',
      lateCount: 2, // delayed 9 Nov, and pending 7 Nov past 9 Nov
      lateCents: 900,
    })
  })
})

describe('listSettlements', () => {
  it('lists one row per settlement in the date range, newest first, with all fields', async () => {
    const rows = await listSettlements(M, { from: '2026-11-08', to: '2026-11-10', today: '2026-11-11' })
    expect(rows.map((r) => [r.businessDate, r.channel, r.netCents, r.status])).toEqual([
      ['2026-11-10', 'nets_qr', 1000, 'paid'], // same day: channels in the usual order
      ['2026-11-10', 'card', 500, 'pending'],
      ['2026-11-09', 'nets_qr', 700, 'delayed'],
      ['2026-11-08', 'nets_qr', 300, 'paid'],
    ])
    expect(rows[3]).toMatchObject({ grossCents: 300, feeCents: 0, expectedDate: '2026-11-10', paidDate: null })
  })

  it('month bounds are inclusive on both ends', async () => {
    const rows = await listSettlements(M, { from: '2026-11-09', to: '2026-11-09', today: '2026-11-11' })
    expect(rows.map((r) => r.businessDate)).toEqual(['2026-11-09'])
  })

  it('maps the status filters; pending past its date counts as late', async () => {
    const f = (status) => listSettlements(M, { from: '2026-11-01', to: '2026-11-30', status, today: '2026-11-11' })
    expect((await f('paid')).map((r) => r.netCents)).toEqual([1000, 300])
    expect((await f('on_the_way')).map((r) => r.netCents)).toEqual([500])
    expect((await f('late')).map((r) => r.netCents)).toEqual([700, 200])
  })

  it('never returns another merchants rows', async () => {
    expect(await listSettlements(randomUUID(), { from: '2026-01-01', to: '2026-12-31' })).toEqual([])
  })
})

describe('getSettlementTotals', () => {
  it('sums paid-in-month, on the way (all time) and late (all time)', async () => {
    await adminExecute(`UPDATE settlements SET paid_date = '2026-11-12' WHERE merchant_id = ? AND business_date = '2026-11-10' AND status = 'paid'`, [M])
    await adminExecute(`UPDATE settlements SET paid_date = '2026-10-31' WHERE merchant_id = ? AND business_date = '2026-11-08'`, [M])
    expect(await getSettlementTotals(M, { from: '2026-11-01', to: '2026-11-30', today: '2026-11-11' })).toEqual({
      paidCents: 1000,
      onTheWayCents: 500,
      lateCents: 900,
      lateCount: 2,
    })
  })
})
