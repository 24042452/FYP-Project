import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildReconWorkbook, buildRefundsWorkbook, buildTransactionsWorkbook } from '../../lib/export/xlsx.js'
import { buildRunView } from '../../lib/recon/view.js'

const exceptions = [
  { id: 'e1', type: 'amount_mismatch', settlementId: 's2', transactionId: null, day: '2026-10-18', channel: 'card', expectedCents: 50000, actualCents: 45790, status: 'open', note: null, message: 'Short by $42.10 · Cards sales on 18 Oct' },
  { id: 'e2', type: 'fee_mismatch', settlementId: null, transactionId: null, day: null, channel: 'card', expectedCents: 1500, actualCents: 1860, status: 'resolved', note: 'Asked NETS', message: 'Cards fees on your October bill are $3.60 more than your payments add up to' },
  { id: 'e3', type: 'failed_payment', settlementId: null, transactionId: 't1', day: '2026-10-20', channel: 'card', expectedCents: 800, actualCents: null, status: 'open', note: null, message: "$8.00 payment didn't go through" },
]
const settlements = [
  { id: 's1', businessDate: '2026-10-17', channel: 'card', grossCents: 10000, feeCents: 250, refundCents: 0, netCents: 9750, status: 'paid', expectedDate: '2026-10-19', paidDate: '2026-10-19' },
  { id: 's2', businessDate: '2026-10-18', channel: 'card', grossCents: 45790, feeCents: 1145, refundCents: 500, netCents: 44145, status: 'paid', expectedDate: '2026-10-20', paidDate: '2026-10-20' },
]

describe('check-up view', () => {
  it('groups open problems and keeps resolved ones apart', () => {
    const v = buildRunView({ id: 'r', period: '2026-10-01', runAt: '2026-11-01T00:00:00.000Z', checkedCount: 6, matchedCount: 4, exceptionCount: 3, exceptions })
    expect(v.headline).toBe('We checked 6 items. 2 need a look.')
    expect(v.failed.text).toBe("1 payment didn't go through this month ($8.00)")
    expect(v.failed.href).toBe('/transactions?status=failed&from=2026-10-01&to=2026-10-31')
    expect(v.groups.map((g) => g.type)).toEqual(['amount_mismatch'])
    expect(v.resolved).toHaveLength(1)
    expect(v.openCount).toBe(1)
    expect(Number.isFinite(v.matchRate)).toBe(true)
  })
  it('an empty month has no NaN', () => {
    const v = buildRunView({ id: 'r', period: '2026-09-01', runAt: '2026-11-01T00:00:00.000Z', checkedCount: 0, matchedCount: 0, exceptionCount: 0, exceptions: [] })
    expect(v).toMatchObject({ checked: 0, matchRate: 1, isEmpty: true })
  })
})

describe('Excel exports', () => {
  it('the check-up workbook has 3 sheets, a frozen header and currency cells that add up', async () => {
    const buf = await buildReconWorkbook({
      merchantName: 'Ah Hock', period: '2026-10-01', runAt: '2026-11-01T00:00:00.000Z', checked: 6, matchedCount: 4,
      exceptionCount: 2, openCount: 1, matchRate: 4 / 6, exceptions, settlements,
    })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Summary', 'Exceptions', 'Settlements'])
    const st = wb.getWorksheet('Settlements')
    expect(st.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(st.getCell('C2').numFmt).toBe('"$"#,##0.00')
    expect(st.getCell('C3').value).toBe(457.9)
    const gross = (st.getCell('C2').value + st.getCell('C3').value) * 100
    expect(Math.round(gross)).toBe(55790)
    const sm = wb.getWorksheet('Summary')
    expect(sm.getCell('B10').value).toBe(557.9)
    expect(sm.getCell('A12').value).toBe('Refunds taken from payouts')
    expect(sm.getCell('B12').value).toBe(5)
    expect(Math.round((sm.getCell('B10').value - sm.getCell('B11').value - sm.getCell('B12').value) * 100)).toBe(Math.round(sm.getCell('B13').value * 100))
    expect(st.getCell('E1').value).toBe('Refunds')
    expect(st.getCell('E3').value).toBe(5)
    expect(wb.getWorksheet('Exceptions').getCell('G2').value).toBe(-42.1)
  })
  it('the payments workbook formats amounts in dollars', async () => {
    const buf = await buildTransactionsWorkbook([
      { id: 'a', createdAt: '2026-10-01T04:00:00.000Z', amountCents: 1250, feeCents: 31, channel: 'card', status: 'failed', failureCode: '51', stan: null, outletName: 'Stall', terminalSerial: 'T1', tid: null, settlementDate: null },
    ])
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet('Payments')
    expect(ws.getCell('E2').value).toBe(12.5)
    expect(ws.getCell('E2').numFmt).toBe('"$"#,##0.00')
    expect(ws.getCell('G2').value).toMatch(/declined/)
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
  })

  it('the refunds workbook has the six columns and amounts that add up to the rows', async () => {
    const rows = [
      { id: 'r1', transactionId: 't1', amountCents: 900, reason: 'wrong_order', refundedAt: '2026-11-08T03:00:00.000Z', paidAt: '2026-11-05T04:00:00.000Z', channel: 'nets_qr', payout: { id: 's', businessDate: '2026-11-08', status: 'paid', expectedDate: '2026-11-10', paidDate: '2026-11-10' } },
      { id: 'r2', transactionId: 't2', amountCents: 1280, reason: 'charged_twice', refundedAt: '2026-11-12T03:00:00.000Z', paidAt: '2026-11-10T02:00:00.000Z', channel: 'card', payout: null },
    ]
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await buildRefundsWorkbook(rows))
    const ws = wb.getWorksheet('Refunds')
    expect(ws.getRow(1).values.slice(1)).toEqual(['Refunded on', 'Bought on', 'Paid with', 'Reason', 'Amount', 'Payout'])
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
    expect(ws.getCell('E2').numFmt).toBe('"$"#,##0.00')
    expect(Math.round((ws.getCell('E2').value + ws.getCell('E3').value) * 100)).toBe(rows.reduce((s, r) => s + r.amountCents, 0))
    expect(ws.getCell('C2').value).toBe('NETS QR')
    expect(ws.getCell('D3').value).toBe('Charged twice')
    expect(ws.getCell('F2').value).toBe('Tue 10 Nov payout')
    expect(ws.getCell('F3').value).toBe('Next payout')
    expect(ws.rowCount).toBe(3)
  })
})
