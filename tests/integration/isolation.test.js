import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { getDailySales, getFeeTotals, getHeatmap } from '../../lib/data/sales.js'
import { getRecentSettlements, getSettlementSummary, getSettlementTotals, listSettlements } from '../../lib/data/settlements.js'
import { getTransaction, listTransactions } from '../../lib/data/transactions.js'
import { getInvoiceWithLines, listInvoices } from '../../lib/data/invoices.js'
import { getLatestRunSummary } from '../../lib/data/recon.js'

// Merchant isolation: for every data function, A's call must never return B's rows.
// Each later data task adds one line to CASES: [name, call(merchantId), total(rows)].
// `total` sums the cents in the returned rows so we can tell whose data came back.
const A = randomUUID()
const B = randomUUID()
const A_CENTS = 1111
const B_CENTS = 99999
const TXN_A = randomUUID()
const TXN_B = randomUUID()
const INV_A = randomUUID()
const INV_B = randomUUID()
const DAY = '2026-11-03'
const FROM = '2026-11-01'
const TO = '2026-11-07'

/** @type {[string, (merchantId: string) => Promise<any[]>, (rows: any[]) => number][]} */
const CASES = [
  ['getDailySales', (id) => getDailySales(id, FROM, TO), (rows) => rows.reduce((s, r) => s + r.grossCents, 0)],
  ['getHeatmap', (id) => getHeatmap(id, FROM, TO), (rows) => rows.reduce((s, r) => s + r.grossCents, 0)],
  ['getFeeTotals', async (id) => { const r = await getFeeTotals(id, FROM, TO); return r.grossCents > 0 ? [r] : [] }, (rows) => rows.reduce((s, r) => s + r.grossCents, 0)],
  ['getRecentSettlements', (id) => getRecentSettlements(id, 5), (rows) => rows.reduce((s, r) => s + r.netCents, 0)],
  ['getSettlementSummary', async (id) => { const r = await getSettlementSummary(id, '2026-11-04'); return r.pendingCents > 0 ? [r] : [] }, (rows) => rows.reduce((s, r) => s + r.pendingCents, 0)],
  ['listSettlements', (id) => listSettlements(id, { from: FROM, to: TO, today: '2026-11-04' }), (rows) => rows.reduce((s, r) => s + r.netCents, 0)],
  ['getSettlementTotals', async (id) => { const r = await getSettlementTotals(id, { from: FROM, to: TO, today: '2026-11-04' }); return r.onTheWayCents > 0 ? [r] : [] }, (rows) => rows.reduce((s, r) => s + r.onTheWayCents, 0)],
  ['listTransactions', async (id) => (await listTransactions(id, {})).rows, (rows) => rows.reduce((s, r) => s + r.amountCents, 0)],
  ['getTransaction', async (id) => { const r = await getTransaction(id, id === A ? TXN_A : TXN_B); return r ? [r] : [] }, (rows) => rows.reduce((s, r) => s + r.amountCents, 0)],
  ['getLatestRunSummary', async (id) => { const r = await getLatestRunSummary(id); return r ? [r] : [] }, (rows) => rows.reduce((s, r) => s + r.matchedCount, 0)],
  ['listInvoices', (id) => listInvoices(id), (rows) => rows.reduce((s, r) => s + r.totalCents, 0)],
  ['getInvoiceWithLines', async (id) => { const r = await getInvoiceWithLines(id, id === A ? INV_A : INV_B); return r ? [r] : [] }, (rows) => rows.reduce((s, r) => s + r.lines.reduce((t, l) => t + l.amountCents, 0), 0)],
]

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({
    merchants: [{ id: A }, { id: B }],
    transactions: [
      { id: TXN_A, merchantId: A, amountCents: A_CENTS, createdAt: `${DAY}T04:00:00.000Z` },
      { id: TXN_B, merchantId: B, amountCents: B_CENTS, createdAt: `${DAY}T04:00:00.000Z` },
    ],
  })
  for (const [id, cents] of [[A, A_CENTS], [B, B_CENTS]]) {
    await adminExecute(
      `INSERT INTO settlements (id, merchant_id, business_date, channel, gross_cents, fee_cents, net_cents, status, expected_date)
       VALUES (?, ?, ?, 'nets_qr', ?, 0, ?, 'pending', '2026-11-05')`,
      [randomUUID(), id, DAY, cents, cents],
    )
    const invId = id === A ? INV_A : INV_B
    await adminExecute(
      `INSERT INTO invoices (id, merchant_id, period, total_cents, status, due_date) VALUES (?, ?, '2026-10-01', ?, 'unpaid', '2026-11-15')`,
      [invId, id, cents],
    )
    await adminExecute(
      `INSERT INTO invoice_lines (id, merchant_id, invoice_id, charge_type, description, qty, amount_cents) VALUES (?, ?, ?, 'portal_fee', 'Portal fee', 1, ?)`,
      [randomUUID(), id, invId, cents],
    )
    const runId = randomUUID()
    await adminExecute(
      `INSERT INTO recon_runs (id, merchant_id, period, run_at, matched_count, exception_count) VALUES (?, ?, '2026-10-01', '2026-11-03 04:00:00.000', ?, 1)`,
      [runId, id, cents],
    )
    await adminExecute(
      `INSERT INTO recon_exceptions (id, merchant_id, run_id, type, status) VALUES (?, ?, ?, 'amount_mismatch', 'open')`,
      [randomUUID(), id, runId],
    )
  }
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

describe('merchant isolation: single invoice', () => {
  it('getInvoiceWithLines never returns another merchants invoice', async () => {
    expect(await getInvoiceWithLines(A, INV_B)).toBeNull()
    expect(await getInvoiceWithLines(B, INV_A)).toBeNull()
  })
})

describe('merchant isolation: single payment', () => {
  it('getTransaction never returns another merchants payment', async () => {
    expect(await getTransaction(A, TXN_B)).toBeNull()
    expect(await getTransaction(B, TXN_A)).toBeNull()
  })
})
