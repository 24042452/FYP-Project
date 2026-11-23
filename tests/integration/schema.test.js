import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { query } from '../../lib/db.js'

const A = randomUUID()
const B = randomUUID()
const SETTLEMENT = randomUUID()
const INVOICE_A = randomUUID()

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({ merchants: [{ id: A }, { id: B }] })
  await adminExecute(
    `INSERT INTO settlements (settlement_id, merchant_id, business_date, channel, gross_cents, fee_cents, net_cents, expected_date)
     VALUES (?, ?, '2026-11-01', 'nets_qr', 1000, 20, 980, '2026-11-03')`,
    [SETTLEMENT, A],
  )
  await adminExecute(
    `INSERT INTO invoices (invoice_id, merchant_id, period, total_cents, due_date) VALUES (?, ?, '2026-10-01', 500, '2026-11-15')`,
    [INVOICE_A, A],
  )
})

describe('app pool', () => {
  it('returns DATE columns as YYYY-MM-DD strings', async () => {
    const [row] = await query(
      'SELECT business_date, expected_date, paid_date FROM settlements WHERE merchant_id = ? AND settlement_id = ?',
      [A, SETTLEMENT],
    )
    expect(row.business_date).toBe('2026-11-01')
    expect(row.expected_date).toBe('2026-11-03')
    expect(row.paid_date).toBeNull()
  })
})

describe('composite merchant foreign keys', () => {
  it('rejects an invoice line whose merchant differs from its invoice', async () => {
    await expect(
      adminExecute(
        `INSERT INTO invoice_lines (invoice_line_id, merchant_id, invoice_id, charge_type, description, amount_cents)
         VALUES (?, ?, ?, 'mdr', 'MDR fee', 500)`,
        [randomUUID(), B, INVOICE_A],
      ),
    ).rejects.toThrow(/foreign key/i)
  })

  it('accepts an invoice line for the invoice owner', async () => {
    await adminExecute(
      `INSERT INTO invoice_lines (invoice_line_id, merchant_id, invoice_id, charge_type, description, amount_cents)
       VALUES (?, ?, ?, 'mdr', 'MDR fee', 500)`,
      [randomUUID(), A, INVOICE_A],
    )
  })

  it('stores a channel (or NULL) on invoice lines', async () => {
    const withChannel = randomUUID()
    const without = randomUUID()
    await adminExecute(
      `INSERT INTO invoice_lines (invoice_line_id, merchant_id, invoice_id, charge_type, channel, description, amount_cents)
       VALUES (?, ?, ?, 'mdr', 'card', 'MDR fees', 100), (?, ?, ?, 'portal_fee', NULL, 'Portal fee', 0)`,
      [withChannel, A, INVOICE_A, without, A, INVOICE_A],
    )
    const rows = await query('SELECT invoice_line_id AS id, channel FROM invoice_lines WHERE merchant_id = ? AND invoice_line_id IN (?, ?)', [A, withChannel, without])
    expect(rows.find((r) => r.id === withChannel).channel).toBe('card')
    expect(rows.find((r) => r.id === without).channel).toBeNull()
  })

  it('rejects a transaction pointing at another merchant\'s settlement', async () => {
    await expect(
      adminExecute(
        `INSERT INTO transactions (transaction_id, merchant_id, channel, status, amount_cents, settlement_id, created_at)
         VALUES (?, ?, 'nets_qr', 'success', 100, ?, '2026-11-01 01:00:00.000')`,
        [randomUUID(), B, SETTLEMENT],
      ),
    ).rejects.toThrow(/foreign key/i)
  })

  it('deleting a merchant cascades through linked transactions and every child table', async () => {
    const C = randomUUID() // fresh merchants so earlier tests do not interfere
    const D = randomUUID()
    await insertFixture({ merchants: [{ id: C }, { id: D }] })
    const tables = [
      'outlets', 'terminals', 'settlements', 'transactions', 'invoices',
      'invoice_lines', 'recon_runs', 'recon_exceptions',
    ]
    for (const m of [C, D]) {
      const [outlet, terminal, settlement, invoice, run] = [1, 2, 3, 4, 5].map(() => randomUUID())
      await adminExecute('INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, ?)', [outlet, m, 'Outlet'])
      await adminExecute(
        'INSERT INTO terminals (terminal_id, merchant_id, outlet_id, serial_no) VALUES (?, ?, ?, ?)',
        [terminal, m, outlet, 'SN-' + terminal.slice(0, 8)],
      )
      await adminExecute(
        `INSERT INTO settlements (settlement_id, merchant_id, business_date, channel, gross_cents, fee_cents, net_cents)
         VALUES (?, ?, '2026-11-01', 'nets_qr', 1000, 20, 980)`,
        [settlement, m],
      )
      await adminExecute(
        `INSERT INTO transactions (transaction_id, merchant_id, outlet_id, terminal_id, settlement_id, channel, status, amount_cents, created_at)
         VALUES (?, ?, ?, ?, ?, 'nets_qr', 'success', 1000, '2026-11-01 01:00:00.000')`,
        [randomUUID(), m, outlet, terminal, settlement],
      )
      await adminExecute(
        "INSERT INTO invoices (invoice_id, merchant_id, period, total_cents, due_date) VALUES (?, ?, '2026-10-01', 500, '2026-11-15')",
        [invoice, m],
      )
      await adminExecute(
        "INSERT INTO invoice_lines (invoice_line_id, merchant_id, invoice_id, charge_type, description, amount_cents) VALUES (?, ?, ?, 'mdr', 'MDR', 500)",
        [randomUUID(), m, invoice],
      )
      await adminExecute(
        "INSERT INTO recon_runs (recon_run_id, merchant_id, period, run_at) VALUES (?, ?, '2026-10-01', '2026-11-02 00:00:00.000')",
        [run, m],
      )
      await adminExecute(
        "INSERT INTO recon_exceptions (recon_exception_id, merchant_id, recon_run_id, type) VALUES (?, ?, ?, 'failed_payment')",
        [randomUUID(), m, run],
      )
    }

    await adminExecute('DELETE FROM merchants WHERE merchant_id = ?', [C])

    for (const t of tables) {
      const [a] = await query(`SELECT COUNT(*) AS n FROM \`${t}\` WHERE merchant_id = ?`, [C])
      const [b] = await query(`SELECT COUNT(*) AS n FROM \`${t}\` WHERE merchant_id = ?`, [D])
      expect([t, a.n]).toEqual([t, 0])
      expect([t, b.n]).toEqual([t, 1])
    }
  })
})

describe('refunds and disputes tables', () => {
  it('has refunds, disputes and dispute_files with merchant-scoped foreign keys', async () => {
    const cols = await query(
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLUMN_DEFAULT AS d, COLUMN_TYPE AS ty
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('settlements','refunds','disputes','dispute_files')`,
    )
    const col = (t, c) => cols.find((r) => r.t === t && r.c === c)
    expect(String(col('settlements', 'refund_cents').d)).toBe('0')
    for (const t of ['refunds', 'disputes', 'dispute_files']) {
      expect(cols.some((r) => r.t === t)).toBe(true)
    }
    expect(col('disputes', 'status').ty).toBe("enum('open','accepted','declined','won','lost')")
    const fks = await query(
      `SELECT CONSTRAINT_NAME AS n FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND CONSTRAINT_TYPE = 'FOREIGN KEY'
         AND CONSTRAINT_NAME IN ('fk_refunds_txn','fk_disputes_txn','fk_dfiles_dispute')`,
    )
    expect(fks).toHaveLength(3)
  })
})
