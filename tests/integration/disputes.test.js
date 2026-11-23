import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { answerDispute, getDisputeFile, listDisputes } from '../../lib/data/disputes.js'
import { listRefunds } from '../../lib/data/refunds.js'
import { query } from '../../lib/db.js'

const M = randomUUID() // the merchant under test
const OTHER = randomUUID() // another merchant
const USER = randomUUID()
const OUT_1 = randomUUID()
const OUT_2 = randomUUID()
const TERM_1 = randomUUID()
const TERM_2 = randomUUID()
const OTHER_OUT = randomUUID()

const TXN_OLD = randomUUID() // outlet 1, disputed (older)
const TXN_NEW = randomUUID() // outlet 2, disputed (newer)
const TXN_TWIN = randomUUID() // same amount/channel/terminal/day as TXN_OLD (refunded)
const TXN_LATE = randomUUID() // outlet 1, dispute past its answer-by date
const TXN_REF = randomUUID() // outlet 1, refunded
const TXN_OTHER = randomUUID()

const D_OLD = randomUUID()
const D_NEW = randomUUID()
const D_LATE = randomUUID()
const D_OTHER = randomUUID()
const FILE_OLD = randomUUID()
const FILE_OTHER = randomUUID()
const SETTLE = randomUUID()
const REFUND = randomUUID()

const TODAY = '2026-11-20'

const dispute = (id, merchantId, txnId, cents, openedAt, respondBy, status = 'open') =>
  adminExecute(
    `INSERT INTO disputes (dispute_id, merchant_id, transaction_id, amount_cents, reason, opened_at, respond_by, status)
     VALUES (?, ?, ?, ?, 'charged_twice', ?, ?, ?)`,
    [id, merchantId, txnId, cents, openedAt, respondBy, status],
  )

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({
    merchants: [{ id: M }, { id: OTHER }],
    transactions: [
      // 2026-11-10 23:30 SGT = 15:30 UTC (an SGT day boundary that differs from the UTC day)
      { id: TXN_OLD, merchantId: M, channel: 'card', amountCents: 1280, createdAt: '2026-11-10T15:30:00.000Z' },
      { id: TXN_TWIN, merchantId: M, channel: 'card', status: 'refunded', amountCents: 1280, createdAt: '2026-11-10T02:00:00.000Z' },
      // same amount but not counted: other channel, failed, next SGT day, other terminal
      { merchantId: M, channel: 'nets_click', amountCents: 1280, createdAt: '2026-11-10T03:00:00.000Z' },
      { merchantId: M, channel: 'card', status: 'failed', amountCents: 1280, createdAt: '2026-11-10T04:00:00.000Z' },
      { merchantId: M, channel: 'card', amountCents: 1280, createdAt: '2026-11-10T16:30:00.000Z' },
      { id: TXN_NEW, merchantId: M, channel: 'card', amountCents: 5000, createdAt: '2026-11-12T04:00:00.000Z' },
      { id: TXN_LATE, merchantId: M, channel: 'enets', amountCents: 700, createdAt: '2026-11-01T04:00:00.000Z' },
      { id: TXN_REF, merchantId: M, channel: 'nets_qr', status: 'refunded', amountCents: 900, createdAt: '2026-11-05T04:00:00.000Z' },
      { id: TXN_OTHER, merchantId: OTHER, channel: 'card', amountCents: 1280, createdAt: '2026-11-10T15:30:00.000Z' },
    ],
  })
  await adminExecute('INSERT INTO users (user_id, email, password_hash, name) VALUES (?, ?, ?, ?)', [USER, `${USER}@t.test`, 'x', 'T'])
  await adminExecute(`INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, 'One'), (?, ?, 'Two'), (?, ?, 'Else')`, [OUT_1, M, OUT_2, M, OTHER_OUT, OTHER])
  await adminExecute(
    `INSERT INTO terminals (terminal_id, tid, merchant_id, outlet_id, serial_no) VALUES (?, 'T0000001', ?, ?, 'S1'), (?, 'T0000002', ?, ?, 'S2')`,
    [TERM_1, M, OUT_1, TERM_2, M, OUT_2],
  )
  // Everything at outlet 1 / terminal 1 unless moved below.
  await adminExecute(`UPDATE transactions SET outlet_id = ?, terminal_id = ?, stan = '000123' WHERE merchant_id = ?`, [OUT_1, TERM_1, M])
  await adminExecute(`UPDATE transactions SET outlet_id = ? WHERE merchant_id = ?`, [OTHER_OUT, OTHER])
  await adminExecute(`UPDATE transactions SET outlet_id = ?, terminal_id = ? WHERE transaction_id = ?`, [OUT_2, TERM_2, TXN_NEW])
  // Same amount, card, same SGT day, but on terminal 2: not counted.
  await adminExecute(
    `INSERT INTO transactions (transaction_id, merchant_id, outlet_id, terminal_id, channel, status, amount_cents, fee_cents, created_at)
     VALUES (?, ?, ?, ?, 'card', 'success', 1280, 0, '2026-11-10 10:00:00.000')`,
    [randomUUID(), M, OUT_1, TERM_2],
  )

  await dispute(D_OLD, M, TXN_OLD, 1280, '2026-11-15 02:00:00.000', '2026-11-25')
  await dispute(D_NEW, M, TXN_NEW, 5000, '2026-11-17 02:00:00.000', '2026-11-27')
  await dispute(D_LATE, M, TXN_LATE, 700, '2026-11-03 02:00:00.000', '2026-11-13')
  await dispute(D_OTHER, OTHER, TXN_OTHER, 1280, '2026-11-16 02:00:00.000', '2026-11-26')
  await adminExecute(
    `INSERT INTO dispute_files (dispute_file_id, dispute_id, merchant_id, file_name, mime_type, size_bytes, data) VALUES (?, ?, ?, 'slip.png', 'image/png', 4, ?)`,
    [FILE_OLD, D_OLD, M, Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  )
  await adminExecute(
    `INSERT INTO dispute_files (dispute_file_id, dispute_id, merchant_id, file_name, mime_type, size_bytes, data) VALUES (?, ?, ?, 'other.pdf', 'application/pdf', 4, ?)`,
    [FILE_OTHER, D_OTHER, OTHER, Buffer.from('%PDF')],
  )

  await adminExecute(
    `INSERT INTO settlements (settlement_id, merchant_id, business_date, channel, gross_cents, fee_cents, refund_cents, net_cents, status, expected_date, paid_date)
     VALUES (?, ?, '2026-11-08', 'nets_qr', 5000, 0, 900, 4100, 'paid', '2026-11-10', '2026-11-10')`,
    [SETTLE, M],
  )
  await adminExecute(
    `INSERT INTO refunds (refund_id, merchant_id, transaction_id, amount_cents, reason, refunded_at, settlement_id) VALUES (?, ?, ?, 900, 'wrong_order', '2026-11-08 03:00:00.000', ?)`,
    [REFUND, M, TXN_REF, SETTLE],
  )
  // A refund with no payout yet (outlet 2 is not involved; it is the refunded twin at outlet 1).
  await adminExecute(
    `INSERT INTO refunds (refund_id, merchant_id, transaction_id, amount_cents, reason, refunded_at, settlement_id) VALUES (?, ?, ?, 1280, 'charged_twice', '2026-11-12 03:00:00.000', NULL)`,
    [randomUUID(), M, TXN_TWIN],
  )
})

describe('listDisputes', () => {
  it("lists only this merchant's disputes, newest first, with files", async () => {
    const rows = await listDisputes(M)
    expect(rows.map((r) => r.id)).toEqual([D_NEW, D_OLD, D_LATE])
    const old = rows[1]
    expect(old).toMatchObject({
      id: D_OLD,
      transactionId: TXN_OLD,
      amountCents: 1280,
      reason: 'charged_twice',
      status: 'open',
      openedAt: '2026-11-15',
      respondBy: '2026-11-25',
      answeredAt: null,
      declineReason: null,
      evidence: [],
      note: null,
      decideBy: null,
      decidedAt: null,
      channel: 'card',
      paidAt: '2026-11-10T15:30:00.000Z',
      tid: 'T0000001',
      stan: '000123',
      outletId: OUT_1,
      fileCount: 1,
      files: [{ id: FILE_OLD, name: 'slip.png', sizeBytes: 4 }],
    })
    expect(rows[0].files).toEqual([])
    expect(await listDisputes(randomUUID())).toEqual([])
  })

  it('counts same-amount payments for the hint', async () => {
    const rows = await listDisputes(M)
    // TXN_OLD itself + the refunded twin: same amount, card, terminal 1 and SGT day (10 Nov). The 16:30 UTC
    // payment shares the UTC day but is 11 Nov in Singapore, so it is not counted.
    expect(rows.find((r) => r.id === D_OLD).sameAmountCount).toBe(2)
    expect(rows.find((r) => r.id === D_NEW).sameAmountCount).toBe(1)
  })
})

describe('outlet managers', () => {
  it("an outlet manager sees only their outlet's disputes and refunds", async () => {
    expect((await listDisputes(M, { outletId: OUT_2 })).map((r) => r.id)).toEqual([D_NEW])
    expect((await listDisputes(M, { outletId: OUT_1 })).map((r) => r.id)).toEqual([D_OLD, D_LATE])
    expect(await listRefunds(M, { from: '2026-11-01', to: '2026-11-30', outletId: OUT_2 })).toEqual([])
    expect((await listRefunds(M, { from: '2026-11-01', to: '2026-11-30', outletId: OUT_1 })).length).toBe(2)
    expect(await getDisputeFile(M, FILE_OLD, { outletId: OUT_2 })).toBeNull()
    expect(await getDisputeFile(M, FILE_OLD, { outletId: OUT_1 })).toMatchObject({ name: 'slip.png', mime: 'image/png' })
    expect(await answerDispute(M, D_OLD, { action: 'accept', userId: USER, outletId: OUT_2, today: TODAY })).toEqual({ ok: false, reason: 'not_found' })
  })
})

describe('getDisputeFile', () => {
  it('returns the stored bytes to their own merchant only', async () => {
    const f = await getDisputeFile(M, FILE_OLD)
    expect(f.name).toBe('slip.png')
    expect(Buffer.isBuffer(f.data)).toBe(true)
    expect([...f.data]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect(await getDisputeFile(M, FILE_OTHER)).toBeNull()
    expect(await getDisputeFile(M, 'not-a-uuid')).toBeNull()
  })
})

describe('answerDispute', () => {
  it('declines an open dispute once; a second answer returns already_answered', async () => {
    const files = [{ name: 'receipt.pdf', mime: 'application/pdf', bytes: Buffer.from('%PDF-1.4 test') }]
    const res = await answerDispute(M, D_NEW, {
      action: 'decline', userId: USER, today: TODAY, declineReason: 'paid_once', evidence: ['receipt', 'printout'], note: 'One payment only.', files,
    })
    expect(res).toEqual({ ok: true })
    const row = (await listDisputes(M)).find((r) => r.id === D_NEW)
    expect(row).toMatchObject({
      status: 'declined', declineReason: 'paid_once', evidence: ['receipt', 'printout'], note: 'One payment only.', decideBy: '2026-12-20',
    })
    expect(row.answeredAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(row.files).toEqual([{ id: expect.any(String), name: 'receipt.pdf', sizeBytes: 13 }])
    const stored = await getDisputeFile(M, row.files[0].id)
    expect(stored.mime).toBe('application/pdf')
    expect(stored.data.toString()).toBe('%PDF-1.4 test')
    const [{ answeredBy }] = await query('SELECT answered_by AS answeredBy FROM disputes WHERE dispute_id = ?', [D_NEW])
    expect(answeredBy).toBe(USER)

    const again = await answerDispute(M, D_NEW, { action: 'accept', userId: USER, today: TODAY, files })
    expect(again).toEqual({ ok: false, reason: 'already_answered' })
    expect((await listDisputes(M)).find((r) => r.id === D_NEW).files).toHaveLength(1)
  })

  it('accepts an open dispute and clears the decline fields', async () => {
    expect(await answerDispute(M, D_OLD, { action: 'accept', userId: USER, today: TODAY, declineReason: 'x', note: 'n' })).toEqual({ ok: true })
    const row = (await listDisputes(M)).find((r) => r.id === D_OLD)
    expect(row).toMatchObject({ status: 'accepted', declineReason: null, note: null, decideBy: null, evidence: [] })
  })

  it('refuses an answer after respond_by with too_late', async () => {
    expect(await answerDispute(M, D_LATE, { action: 'decline', userId: USER, today: TODAY, declineReason: 'paid_once' })).toEqual({ ok: false, reason: 'too_late' })
    expect((await listDisputes(M)).find((r) => r.id === D_LATE).status).toBe('open')
    // respond_by itself is still in time
    expect(await answerDispute(M, D_LATE, { action: 'accept', userId: USER, today: '2026-11-13' })).toEqual({ ok: true })
  })

  it("cannot answer another merchant's dispute (not_found) and writes no files", async () => {
    const files = [{ name: 'x.png', mime: 'image/png', bytes: Buffer.from([1, 2, 3]) }]
    expect(await answerDispute(M, D_OTHER, { action: 'decline', userId: USER, today: TODAY, declineReason: 'paid_once', files })).toEqual({ ok: false, reason: 'not_found' })
    expect(await answerDispute(M, 'not-a-uuid', { action: 'accept', userId: USER, today: TODAY })).toEqual({ ok: false, reason: 'not_found' })
    const [{ n }] = await query('SELECT COUNT(*) AS n FROM dispute_files WHERE dispute_id = ?', [D_OTHER])
    expect(Number(n)).toBe(1)
    const [{ status }] = await query('SELECT status FROM disputes WHERE dispute_id = ?', [D_OTHER])
    expect(status).toBe('open')
  })
})

describe('listRefunds', () => {
  it('lists refunds with the payout they were taken from', async () => {
    const rows = await listRefunds(M, { from: '2026-11-01', to: '2026-11-30' })
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ transactionId: TXN_TWIN, amountCents: 1280, reason: 'charged_twice', channel: 'card', payout: null })
    expect(rows[1]).toEqual({
      id: REFUND,
      transactionId: TXN_REF,
      amountCents: 900,
      reason: 'wrong_order',
      refundedAt: '2026-11-08T03:00:00.000Z',
      paidAt: '2026-11-05T04:00:00.000Z',
      channel: 'nets_qr',
      payout: { id: SETTLE, businessDate: '2026-11-08', status: 'paid', expectedDate: '2026-11-10', paidDate: '2026-11-10' },
    })
    expect(await listRefunds(M, { from: '2026-11-09', to: '2026-11-30' })).toHaveLength(1)
    expect(await listRefunds(OTHER, { from: '2026-11-01', to: '2026-11-30' })).toEqual([])
  })
})
