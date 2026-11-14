import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { getRecentSettlements, getSettlementSummary } from '../../lib/data/settlements.js'

const M = randomUUID()

const insert = (businessDate, channel, net, status, expected) =>
  adminExecute(
    `INSERT INTO settlements (id, merchant_id, business_date, channel, gross_cents, fee_cents, net_cents, status, expected_date)
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
