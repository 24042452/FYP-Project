/**
 * A fake data layer for assistant unit tests. Not a test file (no .test.js).
 * @param {{empty?: boolean, kb?: boolean}} [opts]
 */
export function makeFakeDeps({ empty = false, kb = true } = {}) {
  return {
    today: () => '2026-11-11',
    getDailySales: async (_m, from) =>
      empty
        ? []
        : [
            { day: from, channel: 'nets_qr', grossCents: 10000, txnCount: 5, failedCount: 1 },
            { day: from, channel: 'card', grossCents: 5000, txnCount: 2, failedCount: 0 },
          ],
    getHeatmap: async () => (empty ? [] : [{ dow: 4, hour: 12, grossCents: 9000 }, { dow: 1, hour: 9, grossCents: 500 }]),
    listTransactions: async (_m, f = {}) => {
      const failed = {
        id: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f', createdAt: '2026-11-11T05:02:00.000Z', amountCents: 850, feeCents: 0,
        channel: 'card', status: 'failed', failureCode: '51',
      }
      return { rows: empty ? [] : [failed], nextCursor: null, f }
    },
    getTransaction: async () => null,
    getSettlementSummary: async () =>
      empty
        ? { pendingCents: 0, nextExpectedDate: null, lateCount: 0, lateCents: 0 }
        : { pendingCents: 59340, nextExpectedDate: '2026-11-13', lateCount: 1, lateCents: 50870 },
    listSettlements: async () => [],
    listInvoices: async () =>
      empty ? [] : [{ id: '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f', period: '2026-10-01', totalCents: 12345, status: 'unpaid', dueDate: '2026-11-14', pdfPath: null }],
    getInvoiceWithLines: async () => ({ lines: [{ description: 'Terminal rental', amountCents: 3000 }] }),
    searchKb: async () =>
      kb ? [{ id: 1, source: 'Settlements', heading: 'When will I get paid?', content: 'About 1 to 2 business days.' }] : [],
  }
}
