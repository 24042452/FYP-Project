import { getReconRun, getReconTransactions, saveReconRun } from '../data/recon.js'
import { buildRunView } from './view.js'
import { listSettlements } from '../data/settlements.js'
import { getInvoiceLinesForMonth } from '../data/invoices.js'
import { monthBounds } from '../settlements/model.js'
import { reconcile } from './reconcile.js'

/**
 * Load a month's payments, settlements and invoice lines, and compare them. No writes.
 * @param {string} merchantId
 * @param {string} month YYYY-MM
 * @param {string} today YYYY-MM-DD (Singapore)
 */
export async function computeReconciliation(merchantId, month, today) {
  const { from, to } = monthBounds(month)
  const [txnAgg, settlementRows, invoiceLines] = await Promise.all([
    getReconTransactions(merchantId, month),
    listSettlements(merchantId, { from, to, today }),
    getInvoiceLinesForMonth(merchantId, month),
  ])
  const settlements = settlementRows.map((s) => ({
    id: s.id, day: s.businessDate, channel: s.channel, grossCents: s.grossCents, status: s.status, expectedDate: s.expectedDate,
  }))
  return reconcile({ month, today, txnAgg, settlements, invoiceLines })
}

/**
 * Run a check-up for a month and store it.
 * @param {string} merchantId
 * @param {string} month YYYY-MM
 * @param {string} today YYYY-MM-DD (Singapore)
 * @returns {Promise<string>} the run id
 */
export async function runAndSaveReconciliation(merchantId, month, today) {
  const result = await computeReconciliation(merchantId, month, today)
  return saveReconRun(merchantId, month, result)
}

/**
 * Everything the Excel/PDF check-up needs, or null if the run is not this merchant's.
 * @param {string} merchantId
 * @param {string} merchantName
 * @param {string} runId
 * @param {string} today YYYY-MM-DD (Singapore)
 * @returns {Promise<import('../export/xlsx.js').ReconExport | null>}
 */
export async function loadReconExport(merchantId, merchantName, runId, today) {
  const run = await getReconRun(merchantId, runId)
  if (!run) return null
  const { from, to } = monthBounds(run.period.slice(0, 7))
  const settlements = await listSettlements(merchantId, { from, to, today })
  const view = buildRunView(run)
  return {
    merchantName, period: run.period, runAt: run.runAt, checked: view.checked, matchedCount: run.matchedCount,
    exceptionCount: run.exceptionCount, openCount: view.openCount, matchRate: view.matchRate,
    exceptions: run.exceptions, settlements,
  }
}
