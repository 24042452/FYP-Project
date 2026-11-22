// The JSON shape of a payment in /api/v1 (snake_case, amounts in cents, ISO dates), and back again
// for the browser, which turns it into a table row with toRowView. Pure: safe in server and client code.

/**
 * @param {import('./format.js').Txn} t
 */
export function toApiTransaction(t) {
  return {
    id: t.id,
    created_at: t.createdAt,
    amount_cents: t.amountCents,
    fee_cents: t.feeCents,
    channel: t.channel,
    status: t.status,
    failure_code: t.failureCode,
    stan: t.stan,
    outlet: t.outletName,
    terminal_serial: t.terminalSerial,
    tid: t.tid,
    settlement_date: t.settlementDate,
  }
}

/**
 * @param {ReturnType<typeof toApiTransaction>} r
 * @returns {import('./format.js').Txn}
 */
export function fromApiTransaction(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    amountCents: r.amount_cents,
    feeCents: r.fee_cents,
    channel: r.channel,
    status: r.status,
    failureCode: r.failure_code,
    stan: r.stan,
    outletName: r.outlet,
    terminalSerial: r.terminal_serial,
    tid: r.tid,
    settlementDate: r.settlement_date,
  }
}
