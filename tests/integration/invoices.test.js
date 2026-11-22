import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { getInvoiceWithLines, listInvoiceLines, listInvoices } from '../../lib/data/invoices.js'

const A = randomUUID()
const B = randomUUID()
const OCT = randomUUID()
const SEP = randomUUID()
const OTHER = randomUUID()

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({ merchants: [{ id: A, tradingName: 'Alpha Stall' }, { id: B }] })
  const ins = (id, m, period, total, status) =>
    adminExecute(`INSERT INTO invoices (invoice_id, merchant_id, period, total_cents, status, due_date) VALUES (?, ?, ?, ?, ?, '2026-11-15')`, [id, m, period, total, status])
  await ins(OCT, A, '2026-10-01', 5000, 'unpaid')
  await ins(SEP, A, '2026-09-01', 3000, 'paid')
  await ins(OTHER, B, '2026-10-01', 999, 'unpaid')
  const line = (inv, m, type, ch, desc, amt) =>
    adminExecute(
      `INSERT INTO invoice_lines (invoice_line_id, merchant_id, invoice_id, charge_type, channel, description, qty, amount_cents) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [randomUUID(), m, inv, type, ch, desc, amt],
    )
  await line(OCT, A, 'mdr', 'card', 'MDR fees – Cards', 4000)
  await line(OCT, A, 'portal_fee', null, 'Portal fee', 1000)
  await line(OTHER, B, 'portal_fee', null, 'Portal fee', 999)
})

describe('invoices data', () => {
  it('listInvoices returns newest month first, only this merchant', async () => {
    const rows = await listInvoices(A)
    expect(rows.map((r) => r.id)).toEqual([OCT, SEP])
    expect(rows[0]).toMatchObject({ period: '2026-10-01', totalCents: 5000, status: 'unpaid', dueDate: '2026-11-15' })
  })

  it('getInvoiceWithLines includes lines and merchant details', async () => {
    const inv = await getInvoiceWithLines(A, OCT)
    expect(inv.lines).toHaveLength(2)
    expect(inv.lines.find((l) => l.chargeType === 'mdr')).toMatchObject({ channel: 'card', amountCents: 4000 })
    expect(inv.merchant.tradingName).toBe('Alpha Stall')
  })

  it('returns null for another merchants or a malformed id', async () => {
    expect(await getInvoiceWithLines(A, OTHER)).toBeNull()
    expect(await getInvoiceWithLines(A, 'not-a-uuid')).toBeNull()
    expect(await getInvoiceWithLines(A, randomUUID())).toBeNull()
  })

  it('listInvoiceLines never returns another merchants lines', async () => {
    const out = await listInvoiceLines(A, [OCT, OTHER, 'bad'])
    expect(Object.keys(out)).toEqual([OCT])
    expect(out[OCT]).toHaveLength(2)
  })
})
