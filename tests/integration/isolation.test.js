import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { getDailySales, getFeeTotals, getHeatmap, getOutletSales } from '../../lib/data/sales.js'
import { getOutletSettlementShares, getRecentSettlements, getSettlementSummary, getSettlementTotals, listSettlements } from '../../lib/data/settlements.js'
import { getTransaction, listTransactions, listTransactionsForExport } from '../../lib/data/transactions.js'
import { getInvoiceLinesForMonth, getInvoiceWithLines, listInvoices } from '../../lib/data/invoices.js'
import { countUnread, insertNotifications, listNotifications, markAllRead, markRead } from '../../lib/data/notifications.js'
import { listOutlets } from '../../lib/data/outlets.js'
import { getLatestRunForMonth, getLatestRunSummary, getReconRun, getReconTransactions, listLatestRunIds } from '../../lib/data/recon.js'

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
const RUN_A = randomUUID()
const RUN_B = randomUUID()
const OUT_A = randomUUID()
const OUT_B = randomUUID()
const NOTE_A = randomUUID()
const NOTE_B = randomUUID()
const DAY = '2026-11-03'
const FROM = '2026-11-01'
const TO = '2026-11-07'

/** @type {[string, (merchantId: string) => Promise<any[]>, (rows: any[]) => number][]} */
const CASES = [
  ['getDailySales', (id) => getDailySales(id, FROM, TO), (rows) => rows.reduce((s, r) => s + r.grossCents, 0)],
  ['getHeatmap', (id) => getHeatmap(id, FROM, TO), (rows) => rows.reduce((s, r) => s + r.grossCents, 0)],
  ['getOutletSales', async (id) => (await getOutletSales(id, FROM, TO)).filter((r) => r.grossCents > 0), (rows) => rows.reduce((s, r) => s + r.grossCents, 0)],
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
  ['getReconTransactions', (id) => getReconTransactions(id, '2026-11'), (rows) => rows.reduce((s, r) => s + r.grossCents, 0)],
  ['getInvoiceLinesForMonth', (id) => getInvoiceLinesForMonth(id, '2026-10'), (rows) => rows.reduce((s, r) => s + r.amountCents, 0)],
  ['listTransactionsForExport', (id) => listTransactionsForExport(id, FROM, TO), (rows) => rows.reduce((s, r) => s + r.amountCents, 0)],
  ['getLatestRunForMonth', async (id) => { const r = await getLatestRunForMonth(id, '2026-10'); return r ? [r] : [] }, (rows) => rows.reduce((s, r) => s + r.matchedCount, 0)],
  ['getReconRun', async (id) => { const r = await getReconRun(id, id === A ? RUN_A : RUN_B); return r ? [r] : [] }, (rows) => rows.reduce((s, r) => s + r.matchedCount, 0)],
  ['listNotifications', (id) => listNotifications(id), (rows) => (rows.length === 0 ? 0 : rows[0].id === NOTE_A ? A_CENTS : B_CENTS)],
  ['countUnread', async (id) => { const n = await countUnread(id); return n > 0 ? [{ n }] : [] }, (rows) => (rows.length === 0 ? 0 : rows[0].n === 1 ? A_CENTS : B_CENTS)],
  ['listOutlets', (id) => listOutlets(id), (rows) => (rows.length === 0 ? 0 : rows[0].id === OUT_A ? A_CENTS : B_CENTS)],
  ['getOutletSettlementShares', (id) => getOutletSettlementShares(id, id === A ? OUT_A : OUT_B, { since: '2000-01-01' }), (rows) => rows.reduce((s, r) => s + r.netCents, 0)],
  ['getLatestRunSummary (outlet)', async (id) => { const r = await getLatestRunSummary(id, id === A ? OUT_A : OUT_B); return r ? [r] : [] }, (rows) => rows.reduce((s, r) => s + r.matchedCount, 0)],
  ['listLatestRunIds', (id) => listLatestRunIds(id), (rows) => (rows.length === 0 ? 0 : rows[0].id === RUN_A ? A_CENTS : B_CENTS)],
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
    const settleId = randomUUID()
    await adminExecute(`INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, 'Outlet')`, [id === A ? OUT_A : OUT_B, id])
    await adminExecute(
      `INSERT INTO settlements (settlement_id, merchant_id, business_date, channel, gross_cents, fee_cents, net_cents, status, expected_date)
       VALUES (?, ?, ?, 'nets_qr', ?, 0, ?, 'pending', '2026-11-05')`,
      [settleId, id, DAY, cents, cents],
    )
    await adminExecute(`UPDATE transactions SET outlet_id = ?, settlement_id = ? WHERE transaction_id = ?`, [id === A ? OUT_A : OUT_B, settleId, id === A ? TXN_A : TXN_B])
    const invId = id === A ? INV_A : INV_B
    await adminExecute(
      `INSERT INTO invoices (invoice_id, merchant_id, period, total_cents, status, due_date) VALUES (?, ?, '2026-10-01', ?, 'unpaid', '2026-11-15')`,
      [invId, id, cents],
    )
    await adminExecute(
      `INSERT INTO invoice_lines (invoice_line_id, merchant_id, invoice_id, charge_type, description, qty, amount_cents) VALUES (?, ?, ?, 'portal_fee', 'Portal fee', 1, ?)`,
      [randomUUID(), id, invId, cents],
    )
    for (const noteId of id === A ? [NOTE_A] : [NOTE_B, randomUUID()]) {
      await adminExecute(`INSERT INTO notifications (notification_id, merchant_id, kind, title) VALUES (?, ?, 'sales_up', 'Test')`, [noteId, id])
    }
    const runId = id === A ? RUN_A : RUN_B
    await adminExecute(
      `INSERT INTO recon_runs (recon_run_id, merchant_id, period, run_at, matched_count, exception_count) VALUES (?, ?, '2026-10-01', '2026-11-03 04:00:00.000', ?, 1)`,
      [runId, id, cents],
    )
    await adminExecute(
      `INSERT INTO recon_exceptions (recon_exception_id, merchant_id, recon_run_id, type, status) VALUES (?, ?, ?, 'amount_mismatch', 'open')`,
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

describe('merchant isolation: single check-up', () => {
  it('getReconRun never returns another merchants check-up', async () => {
    expect(await getReconRun(A, RUN_B)).toBeNull()
    expect(await getReconRun(B, RUN_A)).toBeNull()
  })
})

describe('merchant isolation: notifications', () => {
  it('markRead never touches another merchants notification', async () => {
    expect(await markRead(A, NOTE_B)).toBe(false)
    expect(await countUnread(B)).toBe(2)
  })
  it('markAllRead only marks the callers own, and markRead marks once', async () => {
    expect(await markAllRead(randomUUID())).toBe(0)
    expect(await countUnread(A)).toBe(1)
    expect(await markRead(A, NOTE_A)).toBe(true)
    expect(await markRead(A, NOTE_A)).toBe(false)
    expect(await countUnread(A)).toBe(0)
    expect(await countUnread(B)).toBe(2)
    expect(await markAllRead(B)).toBe(2)
    expect(await countUnread(B)).toBe(0)
  })
  it('insertNotifications adds to the callers merchant only', async () => {
    await insertNotifications(A, [{ kind: 'settlement_delay', title: 'Late' }])
    expect(await countUnread(A)).toBe(1)
    expect(await countUnread(B)).toBe(0)
  })
})
