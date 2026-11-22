import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { settlementsResponse, summaryResponse, transactionsResponse } from '../../lib/api/v1.js'

const A = randomUUID()
const B = randomUUID()
const TODAY = '2026-11-12' // a Thursday: this week = Mon 9 Nov .. Sun 15 Nov
const idOf = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const B_TXN = idOf(900)

const txn = (n, merchantId, amountCents, createdAt, extra = {}) => ({
  id: idOf(n), merchantId, amountCents, createdAt, feeCents: Math.round(amountCents / 100), ...extra,
})

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({
    merchants: [{ id: A }, { id: B }],
    transactions: [
      txn(1, A, 10000, '2026-11-09T04:00:00.000Z'),
      txn(2, A, 20000, '2026-11-10T04:00:00.000Z'),
      txn(3, A, 3000, '2026-11-11T04:00:00.000Z', { status: 'failed', failureCode: '51' }),
      txn(4, A, 40000, '2026-11-12T04:00:00.000Z'),
      // last week, same stretch (Mon 2 .. Thu 5)
      txn(5, A, 50000, '2026-11-03T04:00:00.000Z'),
      txn(6, A, 50000, '2026-11-05T04:00:00.000Z'),
      // Fri 6 last week: must NOT count (like for like stops at Thu 5)
      txn(7, A, 99900, '2026-11-06T04:00:00.000Z'),
      // months ago: only a search (365-day default) reaches it
      txn(8, A, 31415, '2026-06-01T04:00:00.000Z'),
      { id: B_TXN, merchantId: B, amountCents: 77777, createdAt: '2026-11-12T04:00:00.000Z' },
    ],
  })
  const rows = [
    [A, '2026-11-10', 'nets_qr', 1000, 'paid', '2026-11-12'],
    [A, '2026-11-09', 'card', 700, 'delayed', '2026-11-11'],
    [B, '2026-11-10', 'nets_qr', 55555, 'paid', '2026-11-12'],
  ]
  for (const [m, d, ch, net, st, exp] of rows) {
    await adminExecute(
      `INSERT INTO settlements (settlement_id, merchant_id, business_date, channel, gross_cents, fee_cents, net_cents, status, expected_date)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
      [randomUUID(), m, d, ch, net, net, st, exp],
    )
  }
})

const body = async (res) => res.json()
const NOV = { from: '2026-11-01', to: '2026-11-30' }

describe('GET /api/v1/transactions', () => {
  it('returns this merchant only, newest first, in cents and ISO dates', async () => {
    const res = await transactionsResponse(A, NOV, TODAY)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    const { data, next_cursor } = await body(res)
    expect(next_cursor).toBeNull()
    expect(data.map((r) => r.id)).toEqual([4, 3, 2, 1, 7, 6, 5].map(idOf))
    expect(data[0]).toMatchObject({ amount_cents: 40000, created_at: '2026-11-12T04:00:00.000Z', channel: 'nets_qr', status: 'success' })
    expect(data.some((r) => r.id === B_TXN)).toBe(false)
  })

  it('merchant B never sees merchant A rows (and A never sees B)', async () => {
    const b = await body(await transactionsResponse(B, NOV, TODAY))
    expect(b.data.map((r) => r.id)).toEqual([B_TXN])
    const a = await body(await transactionsResponse(A, { ...NOV, q: B_TXN }, TODAY))
    expect(a.data).toEqual([])
  })

  it('without q the default is 7 days; with q and no dates it looks back 365 days', async () => {
    const plain = await body(await transactionsResponse(A, {}, TODAY))
    expect(plain.data.map((r) => r.id)).not.toContain(idOf(8))
    const found = await body(await transactionsResponse(A, { q: '314.15', limit: '5' }, TODAY))
    expect(found.data.map((r) => r.id)).toEqual([idOf(8)])
    const byRef = await body(await transactionsResponse(A, { q: idOf(8) }, TODAY))
    expect(byRef.data.map((r) => r.id)).toEqual([idOf(8)])
  })

  it('explicit dates win over the search default', async () => {
    const r = await body(await transactionsResponse(A, { q: '314.15', from: '2026-11-01', to: '2026-11-30' }, TODAY))
    expect(r.data).toEqual([])
  })

  it('a search by amount or by another merchant reference finds nothing of theirs', async () => {
    const amount = await body(await transactionsResponse(A, { q: '777.77' }, TODAY))
    expect(amount.data).toEqual([])
    const ref = await body(await transactionsResponse(A, { q: B_TXN }, TODAY))
    expect(ref.data).toEqual([])
  })

  it('pages with next_cursor', async () => {
    const q = { ...NOV, limit: '3' }
    const p1 = await body(await transactionsResponse(A, q, TODAY))
    expect(p1.data).toHaveLength(3)
    expect(p1.next_cursor).toBeTruthy()
    const p2 = await body(await transactionsResponse(A, { ...q, cursor: p1.next_cursor }, TODAY))
    const p3 = await body(await transactionsResponse(A, { ...q, cursor: p2.next_cursor }, TODAY))
    const all = [...p1.data, ...p2.data, ...p3.data].map((r) => r.id)
    expect(new Set(all).size).toBe(7)
    expect(p3.next_cursor).toBeNull()
  })

  it('filters by status', async () => {
    const r = await body(await transactionsResponse(A, { ...NOV, status: 'failed' }, TODAY))
    expect(r.data.map((x) => x.id)).toEqual([idOf(3)])
    expect(r.data[0].failure_code).toBe('51')
  })

  it('answers 400 JSON for bad params', async () => {
    const bad = [
      { from: '2026-11-01' }, { from: 'nope', to: 'x' }, { from: '2026-11-09', to: '2026-11-01' },
      { channel: 'cash' }, { status: 'weird' }, { limit: '0' }, { limit: '101' }, { cursor: 'garbage!!' },
    ]
    for (const q of bad) {
      const res = await transactionsResponse(A, q, TODAY)
      expect(res.status, JSON.stringify(q)).toBe(400)
      const b = await body(res)
      expect(b.error.code).toBe('invalid_params')
      expect(typeof b.error.message).toBe('string')
    }
  })
})

describe('GET /api/v1/settlements', () => {
  it('lists this merchant only, with a plain status', async () => {
    const a = await body(await settlementsResponse(A, { month: '2026-11' }, TODAY))
    expect(a.month).toBe('2026-11')
    expect(a.data.map((r) => [r.business_date, r.net_cents, r.status])).toEqual([
      ['2026-11-10', 1000, 'paid'],
      ['2026-11-09', 700, 'late'],
    ])
    const b = await body(await settlementsResponse(B, { month: '2026-11' }, TODAY))
    expect(b.data.map((r) => r.net_cents)).toEqual([55555])
  })

  it('filters by status and rejects bad params', async () => {
    const late = await body(await settlementsResponse(A, { month: '2026-11', status: 'late' }, TODAY))
    expect(late.data.map((r) => r.net_cents)).toEqual([700])
    expect((await settlementsResponse(A, { month: '2026-13' }, TODAY)).status).toBe(400)
    expect((await settlementsResponse(A, { status: 'x' }, TODAY)).status).toBe(400)
  })
})

describe('GET /api/v1/summary', () => {
  it('week: gross, counts, fees and a like-for-like change', async () => {
    const res = await summaryResponse(A, { period: 'week' }, TODAY)
    expect(res.status).toBe(200)
    const s = await body(res)
    // Mon 9 .. Thu 12: 10000 + 20000 + 40000 successful (the failed 3000 is not in gross)
    expect(s).toMatchObject({ period: 'week', from: '2026-11-09', to: '2026-11-12', gross_cents: 70000, txn_count: 3, failed_count: 1 })
    expect(s.fee_cents).toBe(700)
    // previous Mon 2 .. Thu 5: 100000, so -30%
    expect(s.compared_with).toEqual({ from: '2026-11-02', to: '2026-11-05' })
    expect(s.change_pct).toBe(-30)
  })

  it('never includes another merchant', async () => {
    const s = await body(await summaryResponse(B, { period: 'today' }, TODAY))
    expect(s.gross_cents).toBe(77777)
    expect(s.change_pct).toBeNull()
  })

  it('400 for a bad period', async () => {
    expect((await summaryResponse(A, { period: 'year' }, TODAY)).status).toBe(400)
  })
})
