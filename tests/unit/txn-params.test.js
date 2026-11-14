import { describe, expect, it } from 'vitest'
import { buildHref, decodeCursor, encodeCursor, parseAmountCents, parseTxnParams } from '../../lib/transactions/params.js'

const TODAY = '2026-11-14'

describe('parseTxnParams', () => {
  it('defaults to the last 7 SGT days ending today, 50 rows', () => {
    const p = parseTxnParams({}, TODAY)
    expect(p).toMatchObject({ from: '2026-11-08', to: '2026-11-14', limit: 50 })
    expect(p.channel).toBeUndefined()
    expect(p.status).toBeUndefined()
    expect(p.explicit).toEqual({})
  })

  it('accepts valid filters', () => {
    const p = parseTxnParams(
      { from: '2026-11-01', to: '2026-11-05', channel: 'card', status: 'failed', q: ' 12.50 ', limit: '20' },
      TODAY,
    )
    expect(p).toMatchObject({ from: '2026-11-01', to: '2026-11-05', channel: 'card', status: 'failed', q: '12.50', limit: 20 })
  })

  it('ignores invalid values and falls back to defaults', () => {
    const p = parseTxnParams(
      { from: '2026-13-45', to: 'yesterday', channel: 'bitcoin', status: "failed' OR 1=1", limit: '9999', cursor: '!!!' },
      TODAY,
    )
    expect(p).toMatchObject({ from: '2026-11-08', to: '2026-11-14', limit: 50 })
    expect(p.channel).toBeUndefined()
    expect(p.status).toBeUndefined()
    expect(p.cursor).toBeUndefined()
  })

  it('ignores a reversed range and limit 0', () => {
    const p = parseTxnParams({ from: '2026-11-10', to: '2026-11-01', limit: '0' }, TODAY)
    expect(p).toMatchObject({ from: '2026-11-08', to: '2026-11-14', limit: 50 })
  })

  it('takes the first value of a repeated param', () => {
    expect(parseTxnParams({ status: ['refunded', 'failed'] }, TODAY).status).toBe('refunded')
  })

  it('keeps the raw id (the data layer decides if it exists)', () => {
    expect(parseTxnParams({ id: 'abc' }, TODAY).id).toBe('abc')
  })
})

describe('cursor', () => {
  it('round-trips', () => {
    const c = encodeCursor('2026-11-14T04:41:00.123Z', '11111111-1111-1111-1111-111111111111')
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeCursor(c)).toEqual({ createdAt: '2026-11-14 04:41:00.123', id: '11111111-1111-1111-1111-111111111111' })
  })

  it('rejects malformed cursors', () => {
    expect(decodeCursor('not base64 !!')).toBeNull()
    expect(decodeCursor(Buffer.from('{"createdAt":"x","id":"y"}').toString('base64url'))).toBeNull()
    expect(decodeCursor(undefined)).toBeNull()
  })
})

describe('parseAmountCents', () => {
  it('reads dollar amounts', () => {
    expect(parseAmountCents('12.50')).toBe(1250)
    expect(parseAmountCents('$12.50')).toBe(1250)
    expect(parseAmountCents('12')).toBe(1200)
    expect(parseAmountCents('$1,234.5')).toBe(123450)
  })
  it('returns null for text', () => {
    expect(parseAmountCents('abc')).toBeNull()
    expect(parseAmountCents('')).toBeNull()
    expect(parseAmountCents('12.345')).toBeNull()
  })
})

describe('buildHref', () => {
  it('keeps explicit filters and applies overrides', () => {
    const p = parseTxnParams({ status: 'failed', q: 'a b' }, TODAY)
    expect(buildHref(p, {})).toBe('/transactions?status=failed&q=a+b')
    expect(buildHref(p, { status: null, id: 'x' })).toBe('/transactions?q=a+b&id=x')
    expect(buildHref(parseTxnParams({}, TODAY), {})).toBe('/transactions')
  })
})
