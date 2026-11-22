import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { getRecentSettlements, getSettlementSummary, getSettlementTotals, listSettlements } from '../../lib/data/settlements.js'

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
      { businessDate: '2026-11-10', netCents: 1500, status: 'pending', expectedDate: '2026-11-13' },
      { businessDate: '2026-11-09', netCents: 700, status: 'delayed', expectedDate: '2026-11-11' },
      { businessDate: '2026-11-08', netCents: 300, status: 'paid', expectedDate: '2026-11-10' },
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
