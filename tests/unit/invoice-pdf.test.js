import { describe, expect, it } from 'vitest'
import { renderInvoicePdf } from '../../lib/export/pdf.jsx'

describe('renderInvoicePdf', () => {
  it('returns a PDF buffer', async () => {
    const buf = await renderInvoicePdf({
      id: 'a', period: '2026-10-01', totalCents: 4000, status: 'unpaid', dueDate: '2026-11-15',
      merchant: { legalName: 'Ah Hock Pte Ltd', tradingName: 'Ah Hock Chicken Rice', uen: '201912345A', gstRegistered: true },
      lines: [{ id: 'l', chargeType: 'mdr', channel: 'card', description: 'MDR fees – Cards', qty: 1, unitPriceCents: null, amountCents: 4000 }],
    }, '2026-11-14')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
  }, 30000)
})
