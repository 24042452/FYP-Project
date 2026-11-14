import { formatSGD } from '../money.js'
import { formatDayLabel } from '../dashboard/home-model.js'

const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * @param {string} period YYYY-MM-DD (first of the month)
 * @returns {string} e.g. "October 2026"
 */
export function invoiceMonthLabel(period) {
  return `${MONTH_LONG[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`
}

/**
 * @param {string} period YYYY-MM-DD
 * @returns {string} e.g. "invoice-2026-10.pdf"
 */
export function invoiceFilename(period) {
  return `invoice-${period.slice(0, 7)}.pdf`
}

/**
 * Plain-English status for an invoice.
 * @param {'unpaid' | 'paid' | 'overdue'} status
 * @param {string} dueDate YYYY-MM-DD
 * @returns {{label: string, tone: 'ok' | 'bad' | 'info', dueNote: string, canPay: boolean}}
 */
export function invoiceStatusView(status, dueDate) {
  if (status === 'paid') return { label: 'Paid', tone: 'ok', dueNote: '', canPay: false }
  const dueNote = dueDate ? `Due ${formatDayLabel(dueDate)}` : ''
  if (status === 'overdue') return { label: 'Overdue', tone: 'bad', dueNote, canPay: true }
  return { label: 'To pay', tone: 'info', dueNote, canPay: true }
}

/**
 * Everything the Bills & charges page shows, as plain data. Pure.
 * @param {{
 *   invoices: import('../data/invoices.js').Invoice[],
 *   linesById: Record<string, import('../data/invoices.js').InvoiceLine[]>,
 *   openId?: string,
 * }} input
 */
export function buildInvoicesModel({ invoices, linesById, openId }) {
  const rows = invoices.map((i) => {
    const st = invoiceStatusView(i.status, i.dueDate)
    const lines = (linesById[i.id] ?? []).map((l) => ({
      key: l.id,
      description: l.description,
      detail: l.qty > 1 && l.unitPriceCents != null ? `${l.qty} × ${formatSGD(l.unitPriceCents)}` : '',
      amount: formatSGD(l.amountCents),
      isMdr: l.chargeType === 'mdr',
    }))
    return {
      key: i.id,
      monthLabel: invoiceMonthLabel(i.period),
      total: formatSGD(i.totalCents),
      statusLabel: st.label,
      tone: st.tone,
      dueNote: st.dueNote,
      canPay: st.canPay,
      open: i.id === openId,
      lines,
      hasMdr: lines.some((l) => l.isMdr),
      filename: invoiceFilename(i.period),
      pdfHref: `/invoices/${i.id}/pdf`,
      href: `/invoices?open=${i.id}`,
    }
  })
  return { rows, isEmpty: rows.length === 0, emptyText: 'No bills yet' }
}
