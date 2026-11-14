/**
 * Drop transactions created after `nowIso` and recompute the affected settlements' totals from the
 * remaining successful transactions. Settlements left with no transactions are removed.
 * Pure: does not mutate the input.
 * @template {{ transactions: any[], settlements: any[] }} D
 * @param {D} dataset
 * @param {string} nowIso
 * @returns {D}
 */
export function trimFuture(dataset, nowIso) {
  const cutoff = new Date(nowIso).getTime()
  const transactions = dataset.transactions.filter((t) => new Date(t.created_at).getTime() <= cutoff)
  if (transactions.length === dataset.transactions.length) return { ...dataset, transactions }

  const dropped = new Set(
    dataset.transactions.filter((t) => new Date(t.created_at).getTime() > cutoff).map((t) => t.settlement_id),
  )
  /** @type {Map<string, { gross: number, fee: number, n: number }>} */
  const totals = new Map()
  for (const t of transactions) {
    if (t.status !== 'success' || !dropped.has(t.settlement_id)) continue
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
      return x ? { ...s, gross_cents: x.gross, fee_cents: x.fee, net_cents: x.gross - x.fee } : s
    })
  return { ...dataset, transactions, settlements }
}
