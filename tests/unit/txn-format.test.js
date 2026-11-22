import { describe, expect, it } from 'vitest'
import { formatWhen, shortId, toDetailView, toRowView } from '../../lib/transactions/format.js'

const base = {
  id: 'abcdef12-0000-0000-0000-000000000000',
  createdAt: '2026-11-14T04:41:00.000Z',
  amountCents: 12850,
  feeCents: 150,
  channel: 'card',
  status: 'success',
  failureCode: null,
  stan: '000123',
  outletName: 'Tampines Mall',
  terminalSerial: 'TM-01',
  tid: '11000001',
  settlementDate: '2026-11-14',
}

describe('formatWhen', () => {
  it('shows Singapore time', () => {
    expect(formatWhen('2026-11-14T04:41:00.000Z')).toBe('Sat 14 Nov, 12:41 pm')
    expect(formatWhen('2026-11-14T16:05:00.000Z')).toBe('Sun 15 Nov, 12:05 am')
  })
})

describe('toRowView', () => {
  it('formats a row', () => {
    expect(toRowView(base)).toEqual({
      id: base.id,
      when: 'Sat 14 Nov, 12:41 pm',
      amount: '$128.50',
      how: 'Cards',
      outlet: 'Tampines Mall',
      pill: { tone: 'ok', label: 'Went through' },
    })
  })
  it('handles missing outlet and failed / refunded pills', () => {
    expect(toRowView({ ...base, outletName: null, status: 'failed' })).toMatchObject({ outlet: 'Not recorded', pill: { tone: 'bad', label: 'Failed' } })
    expect(toRowView({ ...base, status: 'refunded' }).pill).toEqual({ tone: 'mute', label: 'Refunded' })
  })
})

describe('toDetailView', () => {
  it('explains a failure and links to the assistant', () => {
    const d = toDetailView({ ...base, status: 'failed', failureCode: '51' })
    expect(d.plain).toContain('not enough funds')
    expect(d.action).toContain('pay another way')
    expect(d.assistantHref).toBe(`/assistant?q=${encodeURIComponent(`Why did payment ${shortId(base.id)} fail?`)}`)
    expect(d.kv.find(([k]) => k === 'Bank response code')[1]).toBe('51')
    expect(d.kv.find(([k]) => k === 'Money to your bank')[1]).toBe('None')
  })
  it('falls back for an unknown failure code', () => {
    const d = toDetailView({ ...base, status: 'failed', failureCode: 'ZZ' })
    expect(d.plain).toContain('The payment did not go through.')
  })
  it('has no assistant link or action for a normal payment', () => {
    const d = toDetailView(base)
    expect(d.assistantHref).toBeNull()
    expect(d.action).toBeNull()
    expect(d.kv.find(([k]) => k === 'NETS fee')[1]).toBe('$1.50')
    expect(d.kv.find(([k]) => k === 'Terminal')[1]).toBe('TM-01')
    expect(d.kv.find(([k]) => k === 'Terminal ID (TID)')[1]).toBe('11000001')
    expect(d.kv.find(([k]) => k === 'Trace number (STAN)')[1]).toBe('000123')
  })
  it('explains a refund', () => {
    expect(toDetailView({ ...base, status: 'refunded' }).plain).toContain('refunded')
  })
})
