import { describe, expect, it } from 'vitest'
import { makeTools, callTool } from '../../lib/assistant/tools.js'

const M = '11111111-1111-4111-8111-111111111111'
const TXN = '0f0f0f0f-0f0f-4f0f-8f0f-0f0f0f0f0f0f'

/** A fake data layer that records the merchant id it is called with. */
function fakeDeps() {
  const calls = []
  const note = (name, a) => calls.push({ name, merchantId: a[0], args: a.slice(1) })
  return {
    calls,
    today: () => '2026-11-11',
    getDailySales: async (...a) => {
      note('getDailySales', a)
      const from = a[1]
      return from === '2026-11-02' || from === '2026-11-09'
        ? [
            { day: from, channel: 'nets_qr', grossCents: 10000, txnCount: 5, failedCount: 1 },
            { day: from, channel: 'card', grossCents: 5000, txnCount: 2, failedCount: 0 },
          ]
        : [{ day: from, channel: 'nets_qr', grossCents: 2000, txnCount: 1, failedCount: 0 }]
    },
    getHeatmap: async (...a) => {
      note('getHeatmap', a)
      return [{ dow: 4, hour: 12, grossCents: 9000 }, { dow: 4, hour: 18, grossCents: 1000 }, { dow: 1, hour: 9, grossCents: 500 }]
    },
    listTransactions: async (...a) => {
      note('listTransactions', a)
      const rows = Array.from({ length: 50 }, (_, i) => ({
        id: `0000000${i % 10}-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`,
        createdAt: '2026-11-11T05:02:00.000Z', amountCents: 850, feeCents: 0, channel: 'card', status: 'failed',
        failureCode: '51', customerRef: null, outletName: null, terminalSerial: null, settlementDate: null,
      }))
      return { rows, nextCursor: null }
    },
    getTransaction: async (...a) => {
      note('getTransaction', a)
      return { id: TXN, createdAt: '2026-11-11T05:02:00.000Z', amountCents: 850, feeCents: 0, channel: 'card', status: 'failed', failureCode: '51' }
    },
    getSettlementSummary: async (...a) => {
      note('getSettlementSummary', a)
      return { pendingCents: 59340, nextExpectedDate: '2026-11-13', lateCount: 1, lateCents: 50870 }
    },
    listSettlements: async (...a) => {
      note('listSettlements', a)
      return [{ id: 's1', businessDate: '2026-11-08', channel: 'card', grossCents: 100, feeCents: 1, netCents: 99, status: 'delayed', expectedDate: '2026-11-10', paidDate: null }]
    },
    listInvoices: async (...a) => {
      note('listInvoices', a)
      return [{ id: TXN, period: '2026-10-01', totalCents: 12345, status: 'unpaid', dueDate: '2026-11-14', pdfPath: null }]
    },
    getInvoiceWithLines: async (...a) => {
      note('getInvoiceWithLines', a)
      return { id: TXN, period: '2026-10-01', totalCents: 12345, status: 'unpaid', dueDate: '2026-11-14', lines: [{ description: 'Terminal rental', amountCents: 3000 }] }
    },
    searchKb: async () => [{ id: 1, source: 'Settlements', heading: 'When will I get paid?', content: 'About 1 to 2 business days.' }],
  }
}

const byName = (tools, n) => tools.find((t) => t.name === n)

describe('assistant tools', () => {
  const tools = makeTools(M, fakeDeps())

  it('exposes the nine read-only tools', () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      'compare_periods', 'explain_failed_payment', 'find_transactions', 'get_busiest_times', 'get_channel_mix',
      'get_invoice', 'get_sales_summary', 'get_settlement_status', 'search_help_centre',
    ])
  })

  const goodInput = {
    get_sales_summary: { from: '2026-11-02', to: '2026-11-08' },
    compare_periods: { period: 'week' },
    get_busiest_times: { from: '2026-11-02', to: '2026-11-08' },
    get_channel_mix: { from: '2026-11-02', to: '2026-11-08' },
    find_transactions: { date: '2026-11-11' },
    explain_failed_payment: { transaction_id: TXN },
    get_settlement_status: {},
    get_invoice: { month: '2026-10' },
    search_help_centre: { query: 'MDR' },
  }

  for (const t of tools) {
    it(`${t.name}: schema accepts good input and rejects unknown keys incl. merchantId`, () => {
      expect(t.inputSchema.safeParse(goodInput[t.name]).success).toBe(true)
      expect(t.inputSchema.safeParse({ ...goodInput[t.name], merchantId: 'x' }).success).toBe(false)
      expect(t.inputSchema.safeParse({ ...goodInput[t.name], merchant_id: 'x' }).success).toBe(false)
      expect(t.inputSchema.safeParse({ ...goodInput[t.name], other: 1 }).success).toBe(false)
    })
    it(`${t.name}: has no merchant field in its schema`, () => {
      expect(JSON.stringify(Object.keys(t.inputSchema.shape))).not.toMatch(/merchant/i)
    })
  }

  it('get_sales_summary returns the range, gross and payment count', async () => {
    const out = await byName(tools, 'get_sales_summary').handler({ from: '2026-11-02', to: '2026-11-08' })
    expect(out).toMatchObject({ from: '2026-11-02', to: '2026-11-08', grossCents: 15000, txnCount: 6, failedCount: 1 })
  })

  it('get_sales_summary can filter by channel', async () => {
    const out = await byName(tools, 'get_sales_summary').handler({ from: '2026-11-02', to: '2026-11-08', channel: 'card' })
    expect(out.grossCents).toBe(5000)
  })

  it('rejects a from date after the to date', () => {
    expect(byName(tools, 'get_sales_summary').inputSchema.safeParse({ from: '2026-11-09', to: '2026-11-02' }).success).toBe(false)
  })

  it('every handler uses the merchant id the tools were built with', async () => {
    const deps = fakeDeps()
    const t = makeTools(M, deps)
    for (const tool of t) await tool.handler(goodInput[tool.name])
    for (const call of deps.calls) expect(call.merchantId).toBe(M)
    expect(deps.calls.length).toBeGreaterThan(5)
  })

  it('find_transactions caps at 20 rows', async () => {
    const out = await byName(tools, 'find_transactions').handler({ date: '2026-11-11' })
    expect(out.transactions).toHaveLength(20)
    expect(out.count).toBe(20)
  })

  it('compare_periods uses like-for-like bounds (Ruling H)', async () => {
    const deps = fakeDeps()
    const t = makeTools(M, deps)
    // 2026-11-11 is a Wednesday: this week so far is Mon 9 to Wed 11, compared with Mon 2 to Wed 4.
    const out = await byName(t, 'compare_periods').handler({ period: 'week' })
    const ranges = deps.calls.filter((c) => c.name === 'getDailySales').map((c) => c.args)
    expect(ranges).toContainEqual(['2026-11-09', '2026-11-11'])
    expect(ranges).toContainEqual(['2026-11-02', '2026-11-04'])
    expect(out.current.to).toBe('2026-11-11')
    expect(out.previous.to).toBe('2026-11-04')
  })

  it('explain_failed_payment explains the bank code in plain words', async () => {
    const out = await byName(tools, 'explain_failed_payment').handler({ transaction_id: TXN })
    expect(out.found).toBe(true)
    expect(out.reason).toMatch(/not enough funds/)
  })

  it('explain_failed_payment says not found for an unknown id', async () => {
    const deps = fakeDeps()
    deps.getTransaction = async () => null
    const out = await byName(makeTools(M, deps), 'explain_failed_payment').handler({ transaction_id: TXN })
    expect(out.found).toBe(false)
  })

  it('get_busiest_times names the busiest slot and day', async () => {
    const out = await byName(tools, 'get_busiest_times').handler({ from: '2026-11-02', to: '2026-11-08' })
    expect(out.busiestSlot).toBe('Friday 12pm–1pm')
    expect(out.busiestDay).toBe('Friday')
  })

  it('callTool validates input before running', async () => {
    await expect(callTool(tools, 'get_sales_summary', { from: 'nope', to: 'x' })).rejects.toThrow()
    await expect(callTool(tools, 'drop_table', {})).rejects.toThrow(/Unknown tool/)
  })
})
