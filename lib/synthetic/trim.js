/**
 * Drop transactions created after `nowIso` and recompute the affected settlements' totals from the
 * remaining paid-out transactions (successful and refunded: a refunded payment was still paid out on its own day).
 * Settlements left with no transactions are removed; the others keep their `refund_cents`
 * (net = gross − fee − refunds). Refunds and disputes of dropped payments are dropped too.
 * Pure: does not mutate the input.
 * @template {{ transactions: any[], settlements: any[], refunds?: any[], disputes?: any[] }} D
 * @param {D} dataset
 * @param {string} nowIso
 * @returns {D}
 */
export function trimFuture(dataset, nowIso) {
  const cutoff = new Date(nowIso).getTime()
  const transactions = dataset.transactions.filter((t) => new Date(t.created_at).getTime() <= cutoff)
  if (transactions.length === dataset.transactions.length) return { ...dataset, transactions }

  const droppedTxns = dataset.transactions.filter((t) => new Date(t.created_at).getTime() > cutoff)
  const droppedIds = new Set(droppedTxns.map((t) => t.id))
  const dropped = new Set(droppedTxns.map((t) => t.settlement_id))
  /** @type {Map<string, { gross: number, fee: number, n: number }>} */
  const totals = new Map()
  for (const t of transactions) {
    if ((t.status !== 'success' && t.status !== 'refunded') || !dropped.has(t.settlement_id)) continue
    const x = totals.get(t.settlement_id) ?? { gross: 0, fee: 0, n: 0 }
    x.gross += t.amount_cents
    x.fee += t.fee_cents
    x.n += 1
    totals.set(t.settlement_id, x)
  }
  const settlements = dataset.settlements
    .filter((s) => !dropped.has(s.id) || totals.has(s.id))
    .map((s) => {
      const x = totals.get(s.id)
      const refund = s.refund_cents ?? 0
      return x ? { ...s, gross_cents: x.gross, fee_cents: x.fee, net_cents: x.gross - x.fee - refund } : s
    })
  /** @type {D} */
  const out = { ...dataset, transactions, settlements }
  if (dataset.refunds) out.refunds = dataset.refunds.filter((r) => !droppedIds.has(r.transaction_id))
  if (dataset.disputes) out.disputes = dataset.disputes.filter((d) => !droppedIds.has(d.transaction_id))
  return out
}
