import { query } from '../db.js'
import { isUuid } from '../transactions/params.js'

/**
 * @typedef {{id: string, period: string, totalCents: number, status: 'unpaid' | 'paid' | 'overdue', dueDate: string, pdfPath: string | null}} Invoice
 * @typedef {{id: string, chargeType: string, channel: string | null, description: string, qty: number, unitPriceCents: number | null, amountCents: number}} InvoiceLine
 */

/** @param {any} r @returns {Invoice} */
const toInvoice = (r) => ({
  id: String(r.id),
  period: String(r.period),
  totalCents: Number(r.totalCents),
  status: r.status,
  dueDate: String(r.dueDate),
  pdfPath: r.pdfPath ?? null,
})

/**
 * All of the merchant's invoices, newest month first.
 * @param {string} merchantId
 * @returns {Promise<Invoice[]>}
 */
export async function listInvoices(merchantId) {
  const rows = await query(
    `SELECT id, period, total_cents AS totalCents, status, due_date AS dueDate, pdf_path AS pdfPath
       FROM invoices
      WHERE merchant_id = ?
      ORDER BY period DESC, id ASC`,
    [merchantId],
  )
  return rows.map(toInvoice)
}

/**
 * One invoice with its lines and the merchant's billing details; null if it is not this merchant's (or the id is malformed).
 * @param {string} merchantId
 * @param {string} id
 * @returns {Promise<(Invoice & {
 *   lines: InvoiceLine[],
 *   merchant: {legalName: string, tradingName: string, uen: string, gstRegistered: boolean},
 * }) | null>}
 */
export async function getInvoiceWithLines(merchantId, id) {
  if (typeof id !== 'string' || !isUuid(id)) return null
  const rows = await query(
    `SELECT i.id, i.period, i.total_cents AS totalCents, i.status, i.due_date AS dueDate, i.pdf_path AS pdfPath,
            m.legal_name AS legalName, m.trading_name AS tradingName, m.uen, m.gst_registered AS gstRegistered
       FROM invoices i JOIN merchants m ON m.id = i.merchant_id
      WHERE i.merchant_id = ? AND i.id = ?
      LIMIT 1`,
    [merchantId, id],
  )
  const r = rows[0]
  if (!r) return null
  const lines = await query(
    `SELECT id, charge_type AS chargeType, channel, description, qty, unit_price_cents AS unitPriceCents, amount_cents AS amountCents
       FROM invoice_lines
      WHERE merchant_id = ? AND invoice_id = ?
      ORDER BY charge_type ASC, channel ASC, id ASC`,
    [merchantId, id],
  )
  return {
    ...toInvoice(r),
    merchant: { legalName: r.legalName, tradingName: r.tradingName, uen: r.uen, gstRegistered: Boolean(r.gstRegistered) },
    lines: lines.map((l) => ({
      id: String(l.id),
      chargeType: l.chargeType,
      channel: l.channel ?? null,
      description: l.description,
      qty: Number(l.qty),
      unitPriceCents: l.unitPriceCents == null ? null : Number(l.unitPriceCents),
      amountCents: Number(l.amountCents),
    })),
  }
}

/**
 * Lines for several invoices at once (for the expandable list). Scoped by merchant.
 * @param {string} merchantId
 * @param {string[]} invoiceIds
 * @returns {Promise<Record<string, InvoiceLine[]>>}
 */
export async function listInvoiceLines(merchantId, invoiceIds) {
  const ids = invoiceIds.filter((x) => typeof x === 'string' && isUuid(x))
  if (ids.length === 0) return {}
  const rows = await query(
    `SELECT invoice_id AS invoiceId, id, charge_type AS chargeType, channel, description, qty,
            unit_price_cents AS unitPriceCents, amount_cents AS amountCents
       FROM invoice_lines
      WHERE merchant_id = ? AND invoice_id IN (${ids.map(() => '?').join(',')})
      ORDER BY charge_type ASC, channel ASC, id ASC`,
    [merchantId, ...ids],
  )
  /** @type {Record<string, InvoiceLine[]>} */
  const out = {}
  for (const l of rows) {
    ;(out[String(l.invoiceId)] ??= []).push({
      id: String(l.id),
      chargeType: l.chargeType,
      channel: l.channel ?? null,
      description: l.description,
      qty: Number(l.qty),
      unitPriceCents: l.unitPriceCents == null ? null : Number(l.unitPriceCents),
      amountCents: Number(l.amountCents),
    })
  }
  return out
}
