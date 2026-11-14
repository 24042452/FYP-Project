import { describe, it, expect } from 'vitest'
import { shareDays, shareSummary } from '../../lib/settlements/outlet-share.js'

const row = (businessDate, status, netCents, expectedDate = null, channel = 'nets_qr') => ({
  id: `${businessDate}-${channel}`, businessDate, channel, status, expectedDate, paidDate: null, grossCents: netCents, feeCents: 0, netCents,
})
const TODAY = '2026-11-12'

describe('shareSummary', () => {
  it('splits what is on the way from what is late, with the shared late rule', () => {
    const rows = [
      row('2026-11-11', 'pending', 500, '2026-11-13'),
      row('2026-11-11', 'pending', 200, '2026-11-12', 'card'), // due today: not late
      row('2026-11-09', 'pending', 300, '2026-11-10'), // past due: late
      row('2026-11-08', 'delayed', 700, '2026-11-14'), // delayed: late
      row('2026-11-08', 'delayed', 100, null, 'card'), // same day: counted once in lateCount
      row('2026-11-05', 'paid', 900),
    ]
    expect(shareSummary(rows, TODAY)).toEqual({ pendingCents: 700, nextExpectedDate: '2026-11-12', lateCount: 2, lateCents: 1100 })
  })
  it('is all zero for nothing', () => {
    expect(shareSummary([], TODAY)).toEqual({ pendingCents: 0, nextExpectedDate: null, lateCount: 0, lateCents: 0 })
  })
})

describe('shareDays', () => {
  it('groups by day like the whole-business list: delayed beats pending beats paid', () => {
    const rows = [
      row('2026-11-11', 'paid', 100),
      row('2026-11-11', 'pending', 50, '2026-11-13', 'card'),
      row('2026-11-10', 'paid', 400),
      row('2026-11-09', 'delayed', 10, '2026-11-11'),
      row('2026-11-09', 'paid', 20, null, 'card'),
    ]
    expect(shareDays(rows, 2)).toEqual([
      { businessDate: '2026-11-11', netCents: 150, status: 'pending', expectedDate: '2026-11-13' },
      { businessDate: '2026-11-10', netCents: 400, status: 'paid', expectedDate: null },
    ])
    expect(shareDays(rows, 5)[2]).toEqual({ businessDate: '2026-11-09', netCents: 30, status: 'delayed', expectedDate: '2026-11-11' })
  })
  it('handles nothing', () => {
    expect(shareDays([], 5)).toEqual([])
  })
})
