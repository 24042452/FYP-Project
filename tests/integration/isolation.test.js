import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { insertFixture, resetTestDb } from './helpers.js'
import { getDailySales, getHeatmap } from '../../lib/data/sales.js'

// Merchant isolation: for every data function, A's call must never return B's rows.
// Each later data task adds one line to CASES: [name, call(merchantId), total(rows)].
// `total` sums the cents in the returned rows so we can tell whose data came back.
const A = randomUUID()
const B = randomUUID()
const A_CENTS = 1111
const B_CENTS = 99999
const DAY = '2026-11-03'
const FROM = '2026-11-01'
const TO = '2026-11-07'

/** @type {[string, (merchantId: string) => Promise<any[]>, (rows: any[]) => number][]} */
const CASES = [
  ['getDailySales', (id) => getDailySales(id, FROM, TO), (rows) => rows.reduce((s, r) => s + r.grossCents, 0)],
  ['getHeatmap', (id) => getHeatmap(id, FROM, TO), (rows) => rows.reduce((s, r) => s + r.grossCents, 0)],
]

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({
    merchants: [{ id: A }, { id: B }],
    transactions: [
      { merchantId: A, amountCents: A_CENTS, createdAt: `${DAY}T04:00:00.000Z` },
      { merchantId: B, amountCents: B_CENTS, createdAt: `${DAY}T04:00:00.000Z` },
    ],
  })
})

describe('merchant isolation', () => {
  for (const [name, call, total] of CASES) {
    it(`${name} returns only the callers own rows`, async () => {
      expect(total(await call(A))).toBe(A_CENTS)
      expect(total(await call(B))).toBe(B_CENTS)
      expect(await call(randomUUID())).toEqual([])
    })
  }
})
