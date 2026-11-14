import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { listOutlets } from '../../lib/data/outlets.js'
import { getDailySales, getFeeTotals, getHeatmap } from '../../lib/data/sales.js'
import { listTransactions } from '../../lib/data/transactions.js'
import { transactionsResponse } from '../../lib/api/v1.js'
import { validateOutletChoice } from '../../lib/outlets/selection.js'

const A = randomUUID()
const B = randomUUID()
const OUT_TAMPINES = randomUUID()
const OUT_ONLINE = randomUUID()
const OUT_B = randomUUID()
const idOf = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const DAY = '2026-11-03'
const FROM = '2026-11-01'
const TO = '2026-11-07'

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({
    merchants: [{ id: A }, { id: B }],
    transactions: [
      { id: idOf(1), merchantId: A, amountCents: 1000, feeCents: 10, createdAt: `${DAY}T04:00:00.000Z` },
      { id: idOf(2), merchantId: A, amountCents: 2000, feeCents: 20, createdAt: `${DAY}T05:00:00.000Z` },
      { id: idOf(3), merchantId: A, amountCents: 4000, feeCents: 40, createdAt: `${DAY}T06:00:00.000Z` },
      { id: idOf(4), merchantId: A, amountCents: 8000, feeCents: 80, status: 'failed', createdAt: `${DAY}T07:00:00.000Z` },
      { id: idOf(5), merchantId: B, amountCents: 99999, feeCents: 1, createdAt: `${DAY}T04:00:00.000Z` },
    ],
  })
  await adminExecute(`INSERT INTO outlets (id, merchant_id, name) VALUES (?, ?, 'Tampines Mall')`, [OUT_TAMPINES, A])
  await adminExecute(`INSERT INTO outlets (id, merchant_id, name) VALUES (?, ?, 'Online Store')`, [OUT_ONLINE, A])
  await adminExecute(`INSERT INTO outlets (id, merchant_id, name) VALUES (?, ?, 'Aardvark Stall')`, [OUT_B, B])
  await adminExecute(`UPDATE transactions SET outlet_id = ? WHERE id IN (?, ?, ?)`, [OUT_TAMPINES, idOf(1), idOf(2), idOf(4)])
  await adminExecute(`UPDATE transactions SET outlet_id = ? WHERE id = ?`, [OUT_ONLINE, idOf(3)])
  await adminExecute(`UPDATE transactions SET outlet_id = ? WHERE id = ?`, [OUT_B, idOf(5)])
})

const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0)

describe('listOutlets', () => {
  it('lists this merchants outlets by name, and nobody elses', async () => {
    expect(await listOutlets(A)).toEqual([
      { id: OUT_ONLINE, name: 'Online Store' },
      { id: OUT_TAMPINES, name: 'Tampines Mall' },
    ])
    expect(await listOutlets(B)).toEqual([{ id: OUT_B, name: 'Aardvark Stall' }])
    expect(await listOutlets(randomUUID())).toEqual([])
  })
})

describe('validateOutletChoice against real outlets', () => {
  it('rejects another merchants outlet id', async () => {
    const mine = await listOutlets(A)
    expect(validateOutletChoice(mine, OUT_B)).toEqual({ ok: false })
    expect(validateOutletChoice(mine, OUT_TAMPINES)).toEqual({ ok: true, outletId: OUT_TAMPINES })
  })
})

describe('outletId filters', () => {
  it('getDailySales', async () => {
    expect(sum(await getDailySales(A, FROM, TO), 'grossCents')).toBe(7000)
    expect(sum(await getDailySales(A, FROM, TO, OUT_TAMPINES), 'grossCents')).toBe(3000)
    expect(sum(await getDailySales(A, FROM, TO, OUT_ONLINE), 'grossCents')).toBe(4000)
    // failed payments of that outlet still count as attempts
    expect(sum(await getDailySales(A, FROM, TO, OUT_TAMPINES), 'failedCount')).toBe(1)
    expect(sum(await getDailySales(A, FROM, TO, OUT_ONLINE), 'failedCount')).toBe(0)
  })
  it('getHeatmap', async () => {
    expect(sum(await getHeatmap(A, FROM, TO, OUT_TAMPINES), 'grossCents')).toBe(3000)
    expect(sum(await getHeatmap(A, FROM, TO, OUT_ONLINE), 'grossCents')).toBe(4000)
  })
  it('getFeeTotals', async () => {
    expect(await getFeeTotals(A, FROM, TO, OUT_TAMPINES)).toEqual({ grossCents: 3000, feeCents: 30 })
    expect(await getFeeTotals(A, FROM, TO, OUT_ONLINE)).toEqual({ grossCents: 4000, feeCents: 40 })
    expect(await getFeeTotals(A, FROM, TO)).toEqual({ grossCents: 7000, feeCents: 70 })
  })
  it('listTransactions', async () => {
    const ids = async (f) => (await listTransactions(A, f)).rows.map((r) => r.id)
    expect(await ids({ outletId: OUT_TAMPINES })).toEqual([idOf(4), idOf(2), idOf(1)])
    expect(await ids({ outletId: OUT_ONLINE })).toEqual([idOf(3)])
    expect(await ids({})).toHaveLength(4)
  })
  it("another merchants outlet id returns nothing, never their rows", async () => {
    expect(await getDailySales(A, FROM, TO, OUT_B)).toEqual([])
    expect(await getHeatmap(A, FROM, TO, OUT_B)).toEqual([])
    expect(await getFeeTotals(A, FROM, TO, OUT_B)).toEqual({ grossCents: 0, feeCents: 0 })
    expect((await listTransactions(A, { outletId: OUT_B })).rows).toEqual([])
    expect((await listTransactions(B, { outletId: OUT_TAMPINES })).rows).toEqual([])
  })
})

describe('GET /api/v1/transactions?outlet=', () => {
  const call = async (merchantId, sp) => {
    const res = await transactionsResponse(merchantId, sp, '2026-11-12')
    return { status: res.status, body: await res.json() }
  }
  const range = { from: FROM, to: TO }
  it('filters to one outlet', async () => {
    const { status, body } = await call(A, { ...range, outlet: OUT_ONLINE })
    expect(status).toBe(200)
    expect(body.data.map((r) => r.id)).toEqual([idOf(3)])
  })
  it('answers 400 JSON for an outlet that is not the callers', async () => {
    for (const outlet of [OUT_B, 'nope', randomUUID()]) {
      const { status, body } = await call(A, { ...range, outlet })
      expect(status).toBe(400)
      expect(body.error.code).toBe('invalid_params')
      expect(body.error.message).toMatch(/outlet/)
    }
  })
})
