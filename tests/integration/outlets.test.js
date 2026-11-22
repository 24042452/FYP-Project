import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { listOutlets } from '../../lib/data/outlets.js'
import { getDailySales, getFeeTotals, getHeatmap } from '../../lib/data/sales.js'
import { getOutletSettlementShares } from '../../lib/data/settlements.js'
import { getLatestRunSummary } from '../../lib/data/recon.js'
import { listTransactions } from '../../lib/data/transactions.js'
import { transactionsResponse } from '../../lib/api/v1.js'
import { validateOutletChoice } from '../../lib/outlets/selection.js'

const A = randomUUID()
const B = randomUUID()
const OUT_TAMPINES = randomUUID()
const OUT_ONLINE = randomUUID()
const OUT_B = randomUUID()
const idOf = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const SETTLE = randomUUID()
const SETTLE_B = randomUUID()
const RUN = randomUUID()
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
  await adminExecute(`INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, 'Tampines Mall')`, [OUT_TAMPINES, A])
  await adminExecute(`INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, 'Online Store')`, [OUT_ONLINE, A])
  await adminExecute(`INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, 'Aardvark Stall')`, [OUT_B, B])
  await adminExecute(`UPDATE transactions SET outlet_id = ? WHERE transaction_id IN (?, ?, ?)`, [OUT_TAMPINES, idOf(1), idOf(2), idOf(4)])
  await adminExecute(`UPDATE transactions SET outlet_id = ? WHERE transaction_id = ?`, [OUT_ONLINE, idOf(3)])
  await adminExecute(`UPDATE transactions SET outlet_id = ? WHERE transaction_id = ?`, [OUT_B, idOf(5)])
  // One settlement of A holds payments 1, 2 and 3 (two outlets); B has its own.
  const ins = `INSERT INTO settlements (settlement_id, merchant_id, business_date, channel, gross_cents, fee_cents, net_cents, status, expected_date) VALUES (?, ?, ?, 'nets_qr', ?, ?, ?, 'pending', '2026-11-05')`
  await adminExecute(ins, [SETTLE, A, DAY, 7000, 70, 6930])
  await adminExecute(ins, [SETTLE_B, B, DAY, 99999, 1, 99998])
  await adminExecute(`UPDATE transactions SET settlement_id = ? WHERE transaction_id IN (?, ?, ?)`, [SETTLE, idOf(1), idOf(2), idOf(3)])
  await adminExecute(`UPDATE transactions SET settlement_id = ? WHERE transaction_id = ?`, [SETTLE_B, idOf(5)])
  await adminExecute(`INSERT INTO recon_runs (recon_run_id, merchant_id, period, run_at, matched_count, exception_count) VALUES (?, ?, '2026-10-01', '2026-11-03 04:00:00.000', 5, 3)`, [RUN, A])
  const exc = `INSERT INTO recon_exceptions (recon_exception_id, merchant_id, recon_run_id, type, settlement_id, status) VALUES (?, ?, ?, ?, ?, ?)`
  await adminExecute(exc, [randomUUID(), A, RUN, 'amount_mismatch', SETTLE, 'open'])
  await adminExecute(exc, [randomUUID(), A, RUN, 'fee_mismatch', null, 'open'])
  await adminExecute(exc, [randomUUID(), A, RUN, 'failed_payment', null, 'open'])
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

describe('getOutletSettlementShares', () => {
  const opts = { since: '2000-01-01' }
  it('gives each outlet its own share, and the shares add up to the settlement', async () => {
    const t = await getOutletSettlementShares(A, OUT_TAMPINES, opts)
    const o = await getOutletSettlementShares(A, OUT_ONLINE, opts)
    expect(t).toHaveLength(1)
    expect(t[0]).toMatchObject({ id: SETTLE, status: 'pending', expectedDate: '2026-11-05', channel: 'nets_qr', grossCents: 3000, feeCents: 30, netCents: 2970 })
    expect(o[0]).toMatchObject({ grossCents: 4000, feeCents: 40, netCents: 3960 })
    expect(t[0].grossCents + o[0].grossCents).toBe(7000)
    expect(t[0].netCents + o[0].netCents).toBe(6930)
  })
  it('only counts successful payments (the failed one adds nothing)', async () => {
    expect((await getOutletSettlementShares(A, OUT_TAMPINES, opts))[0].grossCents).toBe(3000)
  })
  it('another merchants outlet, or another merchant, gets nothing', async () => {
    expect(await getOutletSettlementShares(A, OUT_B, opts)).toEqual([])
    expect(await getOutletSettlementShares(B, OUT_TAMPINES, opts)).toEqual([])
    expect(await getOutletSettlementShares(randomUUID(), OUT_TAMPINES, opts)).toEqual([])
  })
  it('old paid settlements fall outside since, unpaid ones never do', async () => {
    expect(await getOutletSettlementShares(A, OUT_TAMPINES, { since: '2026-12-01' })).toHaveLength(1) // still pending
  })
})

describe('getLatestRunSummary with an outlet', () => {
  it('counts only problems tied to the outlet, and reports the whole-business ones', async () => {
    const all = await getLatestRunSummary(A)
    expect(all.openCount).toBe(2)
    expect(all.wholeBusinessCount).toBe(0)
    for (const o of [OUT_TAMPINES, OUT_ONLINE]) {
      const r = await getLatestRunSummary(A, o)
      expect(r.openCount).toBe(1)
      expect(r.wholeBusinessCount).toBe(1)
    }
  })
  it('an outlet of another merchant has no tied problems', async () => {
    expect((await getLatestRunSummary(A, OUT_B)).openCount).toBe(0)
  })
})

describe('check-up problems are tied by successful payments only', () => {
  it('an outlet whose only payment in a settlement failed is not tied to its problem', async () => {
    const M = randomUUID()
    const O_OK = randomUUID()
    const O_FAIL = randomUUID()
    const S = randomUUID()
    const R = randomUUID()
    await insertFixture({
      merchants: [{ id: M }],
      transactions: [
        { id: idOf(701), merchantId: M, amountCents: 1000, createdAt: `${DAY}T04:00:00.000Z` },
        { id: idOf(702), merchantId: M, amountCents: 500, status: 'failed', createdAt: `${DAY}T05:00:00.000Z` },
      ],
    })
    await adminExecute(`INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, 'Pays')`, [O_OK, M])
    await adminExecute(`INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, 'Only failed')`, [O_FAIL, M])
    await adminExecute(
      `INSERT INTO settlements (settlement_id, merchant_id, business_date, channel, gross_cents, fee_cents, net_cents, status, expected_date) VALUES (?, ?, ?, 'nets_qr', 1000, 0, 1000, 'pending', '2026-11-05')`,
      [S, M, DAY],
    )
    await adminExecute(`UPDATE transactions SET outlet_id = ?, settlement_id = ? WHERE transaction_id = ?`, [O_OK, S, idOf(701)])
    await adminExecute(`UPDATE transactions SET outlet_id = ?, settlement_id = ? WHERE transaction_id = ?`, [O_FAIL, S, idOf(702)])
    await adminExecute(`INSERT INTO recon_runs (recon_run_id, merchant_id, period, run_at, matched_count, exception_count) VALUES (?, ?, '2026-10-01', '2026-11-03 04:00:00.000', 0, 1)`, [R, M])
    await adminExecute(`INSERT INTO recon_exceptions (recon_exception_id, merchant_id, recon_run_id, type, settlement_id, status) VALUES (?, ?, ?, 'amount_mismatch', ?, 'open')`, [randomUUID(), M, R, S])

    expect((await getLatestRunSummary(M, O_OK)).openCount).toBe(1)
    const failedOnly = await getLatestRunSummary(M, O_FAIL)
    expect(failedOnly.openCount).toBe(0)
    // and its bank share agrees: it has none in that settlement
    expect(await getOutletSettlementShares(M, O_FAIL, { since: '2000-01-01' })).toEqual([])
  })
})
