import { getCurrentMerchant } from '@/lib/data/merchant'
import { listTransactionsForExport } from '@/lib/data/transactions'
import { loadReconExport } from '@/lib/recon/run'
import { buildReconWorkbook, buildTransactionsWorkbook } from '@/lib/export/xlsx'
import { renderReconPdf } from '@/lib/export/pdf'
import { addDays, sgtDate } from '@/lib/dates'
import { isValidDate } from '@/lib/transactions/params'

export const runtime = 'nodejs'

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_DAYS = 93

const noStore = { 'Cache-Control': 'private, no-store' }
const fail = (/** @type {number} */ status, /** @type {string} */ text) => new Response(text, { status, headers: noStore })

function file(/** @type {Buffer} */ body, /** @type {string} */ type, /** @type {string} */ name) {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${name}"`, ...noStore },
  })
}

/**
 * Excel and PDF downloads. The merchant comes only from the session; ids in the address are looked up
 * for that merchant, so another merchant's check-up is simply "not found".
 */
export async function GET(request, { params }) {
  const merchant = await getCurrentMerchant()
  const { kind } = await params
  const sp = new URL(request.url).searchParams
  const format = sp.get('format') ?? 'xlsx'
  const today = sgtDate(new Date().toISOString())

  if (kind === 'recon') {
    if (format !== 'xlsx' && format !== 'pdf') return fail(400, 'Unknown format')
    const run = await loadReconExport(merchant.id, merchant.tradingName, sp.get('run') ?? '', today)
    if (!run) return fail(404, 'Not found')
    const name = `check-up-${run.period.slice(0, 7)}`
    if (format === 'pdf') return file(await renderReconPdf(run), 'application/pdf', `${name}.pdf`)
    return file(await buildReconWorkbook(run), XLSX, `${name}.xlsx`)
  }

  if (kind === 'transactions') {
    if (format !== 'xlsx') return fail(400, 'Unknown format')
    const from = sp.get('from')
    const to = sp.get('to')
    if (!isValidDate(from) || !isValidDate(to) || from > to) return fail(400, 'Please give a valid from and to date.')
    if (to > addDays(from, MAX_DAYS - 1)) return fail(400, `Please pick at most ${MAX_DAYS} days.`)
    const rows = await listTransactionsForExport(merchant.id, from, to)
    return file(await buildTransactionsWorkbook(rows), XLSX, `payments-${from}-to-${to}.xlsx`)
  }

  return fail(404, 'Not found')
}
