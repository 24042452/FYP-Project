import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/api/auth.js', () => ({ getCurrentMerchantForApi: async () => null }))

const { withMerchant, transactionsResponse } = await import('../../lib/api/v1.js')
const { fromApiTransaction, toApiTransaction } = await import('../../lib/transactions/api.js')
const { validateTxnQuery } = await import('../../lib/transactions/params.js')

describe('api auth', () => {
  it('answers 401 JSON (not a redirect) without a session', async () => {
    let called = false
    const res = await withMerchant(new Request('http://x/api/v1/summary'), async () => {
      called = true
      return Response.json({})
    })
    expect(called).toBe(false)
    expect(res.status).toBe(401)
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect((await res.json()).error.code).toBe('signed_out')
  })
})

describe('validateTxnQuery', () => {
  it('accepts valid and empty queries', () => {
    expect(validateTxnQuery({})).toBeNull()
    expect(validateTxnQuery({ from: '2026-11-01', to: '2026-11-02', channel: 'card', status: 'failed', limit: '100' })).toBeNull()
  })
  it('rejects bad values', () => {
    expect(validateTxnQuery({ from: '2026-11-01' })).toMatch(/both/)
    expect(validateTxnQuery({ from: '2026-02-30', to: '2026-03-01' })).toMatch(/real dates/)
    expect(validateTxnQuery({ channel: 'x' })).toMatch(/channel/)
    expect(validateTxnQuery({ limit: 'abc' })).toMatch(/limit/)
    expect(validateTxnQuery({ cursor: 'abc' })).toMatch(/cursor/)
  })
  it('the handler returns 400 before touching the database', async () => {
    const res = await transactionsResponse('m', { status: 'nope' }, '2026-11-12')
    expect(res.status).toBe(400)
  })
})

describe('transaction JSON shape', () => {
  it('round-trips', () => {
    const t = {
      id: 'a', createdAt: '2026-11-12T04:00:00.000Z', amountCents: 5, feeCents: 1, channel: 'card', status: 'success',
      failureCode: null, customerRef: null, outletName: 'X', terminalSerial: null, settlementDate: '2026-11-13',
    }
    expect(fromApiTransaction(toApiTransaction(t))).toEqual(t)
    expect(toApiTransaction(t).amount_cents).toBe(5)
  })
})
