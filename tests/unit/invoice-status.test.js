import { describe, expect, it } from 'vitest'
import { effectiveInvoiceStatus } from '../../lib/invoices/status.js'
import { buildInvoicesModel } from '../../lib/invoices/model.js'

describe('effectiveInvoiceStatus', () => {
  it('due today is not overdue', () => {
    expect(effectiveInvoiceStatus('unpaid', '2026-11-14', '2026-11-14')).toBe('unpaid')
  })
  it('due yesterday is overdue', () => {
    expect(effectiveInvoiceStatus('unpaid', '2026-11-13', '2026-11-14')).toBe('overdue')
  })
  it('paid stays paid even when past due', () => {
    expect(effectiveInvoiceStatus('paid', '2026-01-01', '2026-11-14')).toBe('paid')
  })
  it('the Bills page shows Overdue for a past-due unpaid bill', () => {
    const inv = { id: 'a', period: '2026-09-01', totalCents: 100, status: 'unpaid', dueDate: '2026-10-15', pdfPath: null }
    const m = buildInvoicesModel({ invoices: [inv], linesById: {}, today: '2026-11-14' })
    expect(m.rows[0].statusLabel).toBe('Overdue')
  })
})
