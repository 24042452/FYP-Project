import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { getTransaction, listTransactions } from '../../lib/data/transactions.js'

const A = randomUUID()
const B = randomUUID()
const idOf = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const B_TXN = idOf(900)

beforeAll(async () => {
  await resetTestDb()
  /** 7 payments for A. 5 and 6 share a timestamp (tie broken by id). */
  await insertFixture({
    merchants: [{ id: A }, { id: B }],
    transactions: [
      { id: idOf(1), merchantId: A, amountCents: 1250, status: 'success', channel: 'nets_qr', createdAt: '2026-11-10T01:00:00.000Z' },
      { id: idOf(2), merchantId: A, amountCents: 2000, status: 'failed', channel: 'card', failureCode: '51', createdAt: '2026-11-10T02:00:00.000Z' },
      // 2026-11-10 15:59:59 UTC = 23:59:59 SGT on the 10th; 16:00:00 UTC = 00:00 SGT on the 11th
      { id: idOf(3), merchantId: A, amountCents: 3000, status: 'success', channel: 'card', createdAt: '2026-11-10T15:59:59.000Z' },
      { id: idOf(4), merchantId: A, amountCents: 4000, status: 'refunded', channel: 'sgqr', createdAt: '2026-11-10T16:00:00.000Z' },
      { id: idOf(5), merchantId: A, amountCents: 5000, status: 'success', channel: 'nets_qr', createdAt: '2026-11-12T03:00:00.000Z' },
      { id: idOf(6), merchantId: A, amountCents: 6000, status: 'failed', channel: 'enets', failureCode: 'TO', createdAt: '2026-11-12T03:00:00.000Z' },
      { id: idOf(7), merchantId: A, amountCents: 7000, status: 'success', channel: 'nets_click', createdAt: '2026-11-13T03:00:00.000Z' },
      { id: B_TXN, merchantId: B, amountCents: 1250, status: 'failed', channel: 'card', createdAt: '2026-11-12T03:00:00.000Z' },
    ],
  })
  const outlet = randomUUID()
  await adminExecute(`INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, 'Tampines Mall')`, [outlet, A])
  await adminExecute(`UPDATE transactions SET outlet_id = ?, stan = '048213' WHERE transaction_id = ?`, [outlet, idOf(2)])
  await adminExecute(`UPDATE transactions SET stan = '50%_00' WHERE transaction_id = ?`, [idOf(7)])
})

const ids = (rows) => rows.map((r) => r.id)

describe('listTransactions', () => {
  it('lists newest first, only this merchant', async () => {
    const { rows, nextCursor } = await listTransactions(A, {})
    expect(ids(rows)).toEqual([7, 6, 5, 4, 3, 2, 1].map(idOf))
    expect(nextCursor).toBeNull()
  })

  it('filters by status and channel', async () => {
    expect(ids((await listTransactions(A, { status: 'failed' })).rows)).toEqual([idOf(6), idOf(2)])
    expect(ids((await listTransactions(A, { channel: 'card' })).rows)).toEqual([idOf(3), idOf(2)])
    expect(ids((await listTransactions(A, { channel: 'card', status: 'failed' })).rows)).toEqual([idOf(2)])
  })

  it('bounds dates in Singapore time, to inclusive', async () => {
    // SGT 10 Nov = 09 Nov 16:00 UTC .. 10 Nov 15:59:59.999 UTC -> txns 1, 2, 3 (not 4)
    expect(ids((await listTransactions(A, { from: '2026-11-10', to: '2026-11-10' })).rows)).toEqual([idOf(3), idOf(2), idOf(1)])
    expect(ids((await listTransactions(A, { from: '2026-11-11', to: '2026-11-11' })).rows)).toEqual([idOf(4)])
  })

  it('searches by amount, id prefix and STAN prefix', async () => {
    expect(ids((await listTransactions(A, { q: '12.50' })).rows)).toEqual([idOf(1)])
    expect(ids((await listTransactions(A, { q: '$30' })).rows)).toEqual([idOf(3)])
    expect(ids((await listTransactions(A, { q: '0482' })).rows)).toEqual([idOf(2)])
    expect(ids((await listTransactions(A, { q: idOf(5) })).rows)).toEqual([idOf(5)])
  })

  it('treats % and _ in search as plain text', async () => {
    expect(ids((await listTransactions(A, { q: '%' })).rows)).toEqual([])
    expect(ids((await listTransactions(A, { q: '50%' })).rows)).toEqual([idOf(7)])
    expect(ids((await listTransactions(A, { q: '_' })).rows)).toEqual([])
  })

  it('pages with a keyset cursor: no duplicates or gaps, ties broken by id', async () => {
    const p1 = await listTransactions(A, { limit: 3 })
    expect(ids(p1.rows)).toEqual([idOf(7), idOf(6), idOf(5)])
    expect(p1.nextCursor).toBeTruthy()
    const p2 = await listTransactions(A, { limit: 3, cursor: p1.nextCursor })
    expect(ids(p2.rows)).toEqual([idOf(4), idOf(3), idOf(2)])
    const p3 = await listTransactions(A, { limit: 3, cursor: p2.nextCursor })
    expect(ids(p3.rows)).toEqual([idOf(1)])
    expect(p3.nextCursor).toBeNull()
  })

  it('splits a page between two payments with the same timestamp', async () => {
    const p1 = await listTransactions(A, { limit: 2 })
    expect(ids(p1.rows)).toEqual([idOf(7), idOf(6)])
    const p2 = await listTransactions(A, { limit: 2, cursor: p1.nextCursor })
    expect(ids(p2.rows)).toEqual([idOf(5), idOf(4)])
  })

  it('ignores a malformed cursor', async () => {
    const { rows } = await listTransactions(A, { limit: 2, cursor: 'garbage!!' })
    expect(ids(rows)).toEqual([idOf(7), idOf(6)])
  })

  it('includes the outlet name', async () => {
    const { rows } = await listTransactions(A, { status: 'failed', channel: 'card' })
    expect(rows[0]).toMatchObject({ outletName: 'Tampines Mall', failureCode: '51', amountCents: 2000 })
  })
})

describe('getTransaction', () => {
  it('returns the merchant own payment', async () => {
    expect(await getTransaction(A, idOf(2))).toMatchObject({ id: idOf(2), outletName: 'Tampines Mall', status: 'failed' })
  })
  it('returns null for another merchant, unknown or malformed ids', async () => {
    expect(await getTransaction(A, B_TXN)).toBeNull()
    expect(await getTransaction(A, randomUUID())).toBeNull()
    expect(await getTransaction(A, "x' OR '1'='1")).toBeNull()
    expect((await getTransaction(B, B_TXN))?.id).toBe(B_TXN)
  })
})
