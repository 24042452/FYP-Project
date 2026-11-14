import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { insertFixture, resetTestDb } from './helpers.js'
import { getDailySales, getHeatmap } from '../../lib/data/sales.js'

const M = randomUUID()

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({
    merchants: [{ id: M }],
    transactions: [
      // 2026-10-31 16:30 UTC = Sunday 1 Nov 2026, 00:30 Singapore time
      { merchantId: M, amountCents: 1250, createdAt: '2026-10-31T16:30:00.000Z' },
      { merchantId: M, amountCents: 800, status: 'failed', failureCode: 'insufficient_funds', createdAt: '2026-10-31T16:45:00.000Z' },
      // 2026-11-01 16:00 UTC = 2 Nov 00:00 SGT: just outside a 1 Nov to 1 Nov range
      { merchantId: M, amountCents: 5000, createdAt: '2026-11-01T16:00:00.000Z' },
      // 2026-10-31 15:59:59.999 UTC = 31 Oct 23:59 SGT: just before the range
      { merchantId: M, amountCents: 7000, createdAt: '2026-10-31T15:59:59.999Z' },
    ],
  })
})

describe('getDailySales (Singapore time)', () => {
  it('groups a 00:30 SGT sale under the Singapore day and counts failures separately', async () => {
    const rows = await getDailySales(M, '2026-11-01', '2026-11-01')
    expect(rows).toEqual([
      { day: '2026-11-01', channel: 'nets_qr', grossCents: 1250, txnCount: 2, failedCount: 1 },
    ])
  })

  it('treats `to` as inclusive of the whole Singapore day', async () => {
    const rows = await getDailySales(M, '2026-10-31', '2026-11-02')
    expect(rows.map((r) => [r.day, r.grossCents])).toEqual([
      ['2026-10-31', 7000],
      ['2026-11-01', 1250],
      ['2026-11-02', 5000],
    ])
  })
})

describe('getHeatmap', () => {
  it('puts 00:30 SGT on Sunday 1 Nov at dow 6, hour 0 and ignores failed payments', async () => {
    const rows = await getHeatmap(M, '2026-11-01', '2026-11-01')
    expect(rows).toEqual([{ dow: 6, hour: 0, grossCents: 1250 }])
  })
})
