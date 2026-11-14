import { describe, expect, it } from 'vitest'
import { buildInvoicesModel, invoiceFilename, invoiceMonthLabel, invoiceStatusView } from '../../lib/invoices/model.js'

const inv = (over = {}) => ({
  id: 'a', period: '2026-10-01', totalCents: 12345, status: 'unpaid', dueDate: '2026-11-15', pdfPath: null, ...over,
})

describe('invoice view model', () => {
  it('names the month and the file', () => {
    expect(invoiceMonthLabel('2026-10-01')).toBe('October 2026')
    expect(invoiceFilename('2026-10-01')).toBe('invoice-2026-10.pdf')
  })

  it('maps statuses to plain words', () => {
    expect(invoiceStatusView('paid', '2026-06-15')).toEqual({ label: 'Paid', tone: 'ok', dueNote: '', canPay: false })
    const u = invoiceStatusView('unpaid', '2026-11-15')
    expect(u).toMatchObject({ label: 'To pay', tone: 'info', canPay: true })
    expect(u.dueNote).toBe('Due Sun 15 Nov')
    expect(invoiceStatusView('overdue', '2026-11-15')).toMatchObject({ label: 'Overdue', tone: 'bad', canPay: true })
  })

  it('builds rows, opening the one asked for', () => {
    const lines = [
      { id: 'l1', chargeType: 'mdr', channel: 'card', description: 'MDR fees – Cards', qty: 1, unitPriceCents: null, amountCents: 1000 },
      { id: 'l2', chargeType: 'terminal_rental', channel: null, description: 'Terminal rental', qty: 2, unitPriceCents: 1500, amountCents: 3000 },
    ]
    const m = buildInvoicesModel({ invoices: [inv(), inv({ id: 'b', period: '2026-09-01', status: 'paid' })], linesById: { a: lines }, openId: 'a' })
    expect(m.isEmpty).toBe(false)
    expect(m.rows[0]).toMatchObject({ monthLabel: 'October 2026', total: '$123.45', open: true, filename: 'invoice-2026-10.pdf', pdfHref: '/invoices/a/pdf' })
    expect(m.rows[1].open).toBe(false)
    expect(m.rows[0].lines.map((l) => l.amount)).toEqual(['$10.00', '$30.00'])
    expect(m.rows[0].lines[1].detail).toBe('2 × $15.00')
    expect(m.rows[0].hasMdr).toBe(true)
    expect(JSON.stringify(m)).not.toMatch(/NaN|undefined/)
  })

  it('handles no invoices', () => {
    expect(buildInvoicesModel({ invoices: [], linesById: {}, openId: undefined }).isEmpty).toBe(true)
  })
})
