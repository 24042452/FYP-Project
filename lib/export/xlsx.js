import ExcelJS from 'exceljs'
import { CHANNEL_LABELS } from '../channels.js'
import { explainFailure } from '../failure-codes.js'
import { formatWhen } from '../transactions/format.js'
import { exceptionTitle, invoiceMonthName } from '../recon/view.js'

const CURRENCY = '"$"#,##0.00'
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4DB8' } }

/** @param {number | null | undefined} cents @returns {number | null} dollars for a currency cell */
const dollars = (cents) => (cents == null ? null : cents / 100)

/**
 * Style row 1 as a header and freeze it.
 * @param {import('exceljs').Worksheet} ws
 * @param {{header: string, key: string, width: number, money?: boolean}[]} cols
 */
function setup(ws, cols) {
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.money ? { numFmt: CURRENCY } : {} }))
  const head = ws.getRow(1)
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  head.fill = /** @type {any} */ (HEADER_FILL)
  head.alignment = { vertical: 'middle', wrapText: true }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
}

/** @param {ExcelJS.Workbook} wb @returns {Promise<Buffer>} */
async function toBuffer(wb) {
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/**
 * @typedef {{
 *   merchantName: string, period: string, runAt: string, checked: number, matchedCount: number, exceptionCount: number,
 *   openCount: number, matchRate: number,
 *   exceptions: import('../data/recon.js').StoredException[],
 *   settlements: import('../data/settlements.js').SettlementRow[],
 * }} ReconExport
 */

/**
 * The check-up as an Excel workbook: Summary, Exceptions, Settlements. Money cells hold dollars
 * (from integer cents) with a currency format.
 * @param {ReconExport} run
 * @returns {Promise<Buffer>}
 */
export async function buildReconWorkbook(run) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Merchant Portal prototype'
  const month = run.period.slice(0, 7)

  const sum = wb.addWorksheet('Summary')
  setup(sum, [
    { header: 'Item', key: 'k', width: 34 },
    { header: 'Value', key: 'v', width: 30, money: false },
  ])
  const gross = run.settlements.reduce((s, r) => s + r.grossCents, 0)
  const fees = run.settlements.reduce((s, r) => s + r.feeCents, 0)
  const net = run.settlements.reduce((s, r) => s + r.netCents, 0)
  sum.addRows([
    { k: 'Business', v: run.merchantName },
    { k: 'Month checked', v: `${invoiceMonthName(month)} ${month.slice(0, 4)}` },
    { k: 'Checked at (Singapore time)', v: formatWhen(run.runAt) },
    { k: 'Items checked', v: run.checked },
    { k: 'Matched', v: run.matchedCount },
    { k: 'Need a look', v: run.exceptionCount },
    { k: 'Still open', v: run.openCount },
    { k: 'Match rate', v: run.matchRate },
    { k: 'Sales in settlements', v: dollars(gross) },
    { k: 'NETS fees in settlements', v: dollars(fees) },
    { k: 'Paid or due to your bank', v: dollars(net) },
  ])
  sum.getCell('B9').numFmt = '0.0%'
  for (const r of [10, 11, 12]) {
    sum.getCell(`B${r}`).numFmt = CURRENCY
    sum.getCell(`B${r}`).alignment = { horizontal: 'right' }
  }

  const exc = wb.addWorksheet('Exceptions')
  setup(exc, [
    { header: 'What we found', key: 'title', width: 28 },
    { header: 'Details', key: 'message', width: 70 },
    { header: 'Sales day', key: 'day', width: 12 },
    { header: 'Channel', key: 'channel', width: 16 },
    { header: 'We expected', key: 'expected', width: 14, money: true },
    { header: 'What we found', key: 'actual', width: 14, money: true },
    { header: 'Difference', key: 'diff', width: 14, money: true },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Your note', key: 'note', width: 40 },
  ])
  for (const e of run.exceptions) {
    const hasBoth = e.type !== 'failed_payment' && e.expectedCents != null && e.actualCents != null
    exc.addRow({
      title: exceptionTitle(e.type),
      message: e.message,
      day: e.day ?? '',
      channel: e.channel ? CHANNEL_LABELS[e.channel] : '',
      expected: dollars(e.expectedCents),
      actual: e.type === 'failed_payment' ? null : dollars(e.actualCents),
      diff: hasBoth ? dollars(/** @type {number} */ (e.actualCents) - /** @type {number} */ (e.expectedCents)) : null,
      status: e.status === 'resolved' ? 'Sorted' : 'Needs a look',
      note: e.note ?? '',
    })
  }

  const flagged = new Set(run.exceptions.filter((e) => e.settlementId).map((e) => e.settlementId))
  const st = wb.addWorksheet('Settlements')
  setup(st, [
    { header: 'Sales day', key: 'day', width: 12 },
    { header: 'Channel', key: 'channel', width: 16 },
    { header: 'Sales', key: 'gross', width: 14, money: true },
    { header: 'NETS fees', key: 'fee', width: 14, money: true },
    { header: 'Paid to you', key: 'net', width: 14, money: true },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Due', key: 'due', width: 12 },
    { header: 'Paid on', key: 'paid', width: 12 },
    { header: 'Check-up', key: 'check', width: 14 },
  ])
  for (const s of run.settlements) {
    st.addRow({
      day: s.businessDate,
      channel: CHANNEL_LABELS[s.channel],
      gross: dollars(s.grossCents),
      fee: dollars(s.feeCents),
      net: dollars(s.netCents),
      status: s.status === 'paid' ? 'Paid' : s.status === 'delayed' ? 'Late' : 'On the way',
      due: s.expectedDate ?? '',
      paid: s.paidDate ?? '',
      check: flagged.has(s.id) ? 'Needs a look' : 'Matched',
    })
  }
  return toBuffer(wb)
}

/**
 * Payments as an Excel workbook (one sheet).
 * @param {import('../transactions/format.js').Txn[]} rows
 * @returns {Promise<Buffer>}
 */
export async function buildTransactionsWorkbook(rows) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Merchant Portal prototype'
  const ws = wb.addWorksheet('Payments')
  setup(ws, [
    { header: 'When (Singapore time)', key: 'when', width: 24 },
    { header: 'Payment ID', key: 'id', width: 38 },
    { header: 'Channel', key: 'channel', width: 16 },
    { header: 'Status', key: 'status', width: 14 },
    { header: 'Amount', key: 'amount', width: 14, money: true },
    { header: 'NETS fee', key: 'fee', width: 12, money: true },
    { header: 'Why it failed', key: 'why', width: 50 },
    { header: 'Outlet', key: 'outlet', width: 24 },
    { header: 'Terminal', key: 'terminal', width: 16 },
    { header: 'Paid to your bank on', key: 'settled', width: 20 },
  ])
  for (const t of rows) {
    ws.addRow({
      when: formatWhen(t.createdAt),
      id: t.id,
      channel: CHANNEL_LABELS[t.channel],
      status: t.status === 'success' ? 'Went through' : t.status === 'failed' ? 'Failed' : 'Refunded',
      amount: dollars(t.amountCents),
      fee: dollars(t.feeCents),
      why: t.status === 'failed' ? explainFailure(t.failureCode).plain : '',
      outlet: t.outletName ?? '',
      terminal: t.terminalSerial ?? '',
      settled: t.settlementDate ?? '',
    })
  }
  return toBuffer(wb)
}
