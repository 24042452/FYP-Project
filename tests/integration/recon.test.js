import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { getLatestRunForMonth, getReconRun, getReconTransactions, markExceptionSorted, saveReconRun } from '../../lib/data/recon.js'
import { getInvoiceLinesForMonth } from '../../lib/data/invoices.js'
import { computeReconciliation, runAndSaveReconciliation } from '../../lib/recon/run.js'
import { query } from '../../lib/db.js'

const A = randomUUID()
const B = randomUUID()
const TODAY = '2026-11-12'

const txn = (merchantId, day, hour, o = {}) => ({ merchantId, channel: 'card', createdAt: `${day}T${hour}:00:00.000Z`, amountCents: 1000, feeCents: 25, ...o })

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({
    merchants: [{ id: A }, { id: B }],
    transactions: [
      // 17 Oct SGT; 20:00Z on the 17th is 04:00 on the 18th in Singapore, so it lands on 18 Oct.
      txn(A, '2026-10-17', '04', { amountCents: 5000, feeCents: 100 }),
      txn(A, '2026-10-17', '20', { amountCents: 3000, feeCents: 60 }),
      txn(A, '2026-10-17', '05', { status: 'failed', amountCents: 700, feeCents: 0, failureCode: '51' }),
      txn(B, '2026-10-17', '04', { amountCents: 99999, feeCents: 5 }),
    ],
  })
  const settle = (m, day, gross) =>
    adminExecute(
      `INSERT INTO settlements (id, merchant_id, business_date, channel, gross_cents, fee_cents, net_cents, status, expected_date)
       VALUES (?, ?, ?, 'card', ?, 0, ?, 'paid', '2026-10-20')`,
      [randomUUID(), m, day, gross, gross],
    )
  await settle(A, '2026-10-17', 5000)
  await settle(A, '2026-10-18', 3000 - 500)
  const inv = randomUUID()
  await adminExecute(`INSERT INTO invoices (id, merchant_id, period, total_cents, status, due_date) VALUES (?, ?, '2026-10-01', 200, 'unpaid', '2026-11-15')`, [inv, A])
  await adminExecute(
    `INSERT INTO invoice_lines (id, merchant_id, invoice_id, charge_type, channel, description, qty, amount_cents) VALUES (?, ?, ?, 'mdr', 'card', 'MDR fees – Cards', 1, 200)`,
    [randomUUID(), A, inv],
  )
})

describe('check-up inputs', () => {
  it('buckets payments by Singapore day and splits out failures', async () => {
    const rows = await getReconTransactions(A, '2026-10')
    expect(rows).toEqual([
      { day: '2026-10-17', channel: 'card', grossCents: 5000, feeCents: 100, failed: [{ id: expect.any(String), code: '51', amountCents: 700 }] },
      { day: '2026-10-18', channel: 'card', grossCents: 3000, feeCents: 60, failed: [] },
    ])
  })

  it('reads the invoice lines for the month only', async () => {
    expect(await getInvoiceLinesForMonth(A, '2026-10')).toEqual([{ chargeType: 'mdr', channel: 'card', amountCents: 200 }])
    expect(await getInvoiceLinesForMonth(A, '2026-09')).toEqual([])
  })

  it('computes the three problems and the failed payment', async () => {
    const r = await computeReconciliation(A, '2026-10', TODAY)
    expect(r.exceptions.map((e) => e.type)).toEqual(['amount_mismatch', 'fee_mismatch', 'failed_payment'])
    expect(r.exceptions[0]).toMatchObject({ expectedCents: 3000, actualCents: 2500 })
    expect(r.exceptions[1]).toMatchObject({ expectedCents: 160, actualCents: 200 })
    expect(r.checked).toBe(3)
    expect(r.matched).toBe(1)
  })

  it('an empty month for the merchant is clean', async () => {
    expect(await computeReconciliation(A, '2026-09', TODAY)).toEqual({ checked: 0, matched: 0, matchRate: 1, exceptions: [] })
  })
})

describe('storing a check-up', () => {
  it('writes the run and its exceptions together', async () => {
    const runId = await runAndSaveReconciliation(A, '2026-10', TODAY)
    const run = await getReconRun(A, runId)
    expect(run).toMatchObject({ period: '2026-10-01', matchedCount: 1, exceptionCount: 3 })
    expect(run.exceptions).toHaveLength(3)
    expect(run.exceptions.every((e) => e.status === 'open' && e.message.length > 0)).toBe(true)
    expect((await getLatestRunForMonth(A, '2026-10')).id).toBe(runId)
    expect(await getReconRun(B, runId)).toBeNull()
  })

  it('a failure part-way leaves no run row', async () => {
    const before = (await query('SELECT COUNT(*) AS n FROM recon_runs WHERE merchant_id = ?', [A]))[0].n
    const bad = { matched: 0, exceptions: [{ type: 'not_a_real_type', ref: 'x', message: 'x' }] }
    await expect(saveReconRun(A, '2026-08', bad)).rejects.toThrow()
    const after = (await query('SELECT COUNT(*) AS n FROM recon_runs WHERE merchant_id = ?', [A]))[0].n
    expect(after).toBe(before)
    expect(await getLatestRunForMonth(A, '2026-08')).toBeNull()
  })
})

describe('mark as sorted', () => {
  it('resolves one problem with a note, for the owner only', async () => {
    const run = await getLatestRunForMonth(A, '2026-10')
    const id = run.exceptions[0].id
    expect(await markExceptionSorted(B, id, 'hijack')).toBe(false)
    expect((await getReconRun(A, run.id)).exceptions.find((e) => e.id === id)).toMatchObject({ status: 'open', note: null })
    expect(await markExceptionSorted(A, id, 'Asked NETS')).toBe(true)
    expect((await getReconRun(A, run.id)).exceptions.find((e) => e.id === id)).toMatchObject({ status: 'resolved', note: 'Asked NETS' })
    expect(await markExceptionSorted(A, 'not-a-uuid', null)).toBe(false)
  })
})
