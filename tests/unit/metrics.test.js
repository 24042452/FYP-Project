import { describe, it, expect } from 'vitest'
import { periodRange } from '../../lib/dates.js'
import {
  summarise,
  comparePeriods,
  dailySeries,
  channelMix,
  busiestSlot,
} from '../../lib/metrics/summary.js'
import { buildHeadline } from '../../lib/metrics/headline.js'
import { healthScore } from '../../lib/metrics/health.js'

const row = (day, channel, grossCents, txnCount = 1, failedCount = 0) => ({
  day,
  channel,
  grossCents,
  txnCount,
  failedCount,
})

const noBadValues = (v) => !/NaN|Infinity|undefined/.test(JSON.stringify(v) + String(v))

describe('periodRange', () => {
  it('week is Mon-Sun with the previous Mon-Sun week', () => {
    expect(periodRange('week', '2026-11-11')).toEqual({
      from: '2026-11-09',
      to: '2026-11-15',
      toDate: '2026-11-11',
      prevFrom: '2026-11-02',
      prevTo: '2026-11-08',
      prevToDate: '2026-11-04',
      label: 'this week',
    })
  })
  it('week on a Sunday and a Monday stays in the same Mon-Sun week', () => {
    expect(periodRange('week', '2026-11-15').from).toBe('2026-11-09')
    expect(periodRange('week', '2026-11-15').toDate).toBe('2026-11-15')
    expect(periodRange('week', '2026-11-15').prevToDate).toBe('2026-11-08')
    expect(periodRange('week', '2026-11-09').to).toBe('2026-11-15')
    expect(periodRange('week', '2026-11-09').toDate).toBe('2026-11-09')
    expect(periodRange('week', '2026-11-09').prevToDate).toBe('2026-11-02')
  })
  it('today compares with yesterday', () => {
    expect(periodRange('today', '2026-11-14')).toEqual({
      from: '2026-11-14',
      to: '2026-11-14',
      toDate: '2026-11-14',
      prevFrom: '2026-11-13',
      prevTo: '2026-11-13',
      prevToDate: '2026-11-13',
      label: 'today',
    })
  })
  it('month previous period is the true previous calendar month', () => {
    expect(periodRange('month', '2026-11-14')).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      toDate: '2026-11-14',
      prevFrom: '2026-10-01',
      prevTo: '2026-10-31',
      prevToDate: '2026-10-14',
      label: 'this month',
    })
  })
  it('month prevToDate is capped at the end of a shorter previous month', () => {
    const r = periodRange('month', '2027-03-31')
    expect(r.prevFrom).toBe('2027-02-01')
    expect(r.prevTo).toBe('2027-02-28')
    expect(r.prevToDate).toBe('2027-02-28')
  })
  it('crosses year boundaries', () => {
    const r = periodRange('month', '2027-01-10')
    expect(r.prevFrom).toBe('2026-12-01')
    expect(r.prevTo).toBe('2026-12-31')
    expect(r.prevToDate).toBe('2026-12-10')
  })
})

describe('summarise', () => {
  it('totals rows and computes average ticket', () => {
    const s = summarise([row('2026-11-09', 'card', 1000, 2, 1), row('2026-11-10', 'sgqr', 3000, 4, 0)])
    expect(s).toEqual({ grossCents: 4000, txnCount: 6, failedCount: 1, avgTicketCents: 667 })
  })
  it('handles empty input with zeros', () => {
    expect(summarise([])).toEqual({ grossCents: 0, txnCount: 0, failedCount: 0, avgTicketCents: 0 })
  })
})

describe('comparePeriods', () => {
  it('computes delta and percent', () => {
    expect(comparePeriods(150, 100)).toEqual({ deltaCents: 50, pct: 50 })
    expect(comparePeriods(50, 100)).toEqual({ deltaCents: -50, pct: -50 })
  })
  it('pct is null when prev is 0', () => {
    expect(comparePeriods(100, 0).pct).toBe(null)
    expect(comparePeriods(0, 0)).toEqual({ deltaCents: 0, pct: null })
  })
})

describe('dailySeries', () => {
  it('fills missing days with 0, merges channels, labels weekdays', () => {
    const s = dailySeries(
      [row('2026-11-09', 'card', 100), row('2026-11-09', 'sgqr', 200), row('2026-11-11', 'card', 50)],
      '2026-11-09',
      '2026-11-11',
    )
    expect(s).toEqual([
      { day: '2026-11-09', label: 'Mon', grossCents: 300 },
      { day: '2026-11-10', label: 'Tue', grossCents: 0 },
      { day: '2026-11-11', label: 'Wed', grossCents: 50 },
    ])
  })
  it('empty rows give zero-filled days', () => {
    const s = dailySeries([], '2026-11-09', '2026-11-10')
    expect(s.map((d) => d.grossCents)).toEqual([0, 0])
  })
})

describe('channelMix', () => {
  it('returns [] for no sales', () => {
    expect(channelMix([])).toEqual([])
    expect(channelMix([row('2026-11-09', 'card', 0)])).toEqual([])
  })
  it('shares sum to 1, sorted descending, with labels', () => {
    const mix = channelMix([
      row('2026-11-09', 'card', 100),
      row('2026-11-09', 'nets_qr', 300),
      row('2026-11-10', 'card', 100),
    ])
    expect(mix.map((m) => m.channel)).toEqual(['nets_qr', 'card'])
    expect(mix[0].label).toBe('NETS QR')
    expect(mix[0].share).toBeCloseTo(0.6, 9)
    expect(mix.reduce((a, m) => a + m.share, 0)).toBeCloseTo(1, 9)
  })
  it('breaks ties by CHANNELS order', () => {
    const mix = channelMix([row('d', 'sgqr', 100), row('d', 'nets_click', 100)])
    expect(mix.map((m) => m.channel)).toEqual(['nets_click', 'sgqr'])
  })
})

describe('busiestSlot', () => {
  it('formats the busiest slot', () => {
    expect(
      busiestSlot([
        { dow: 4, hour: 12, grossCents: 900 },
        { dow: 1, hour: 9, grossCents: 100 },
      ]),
    ).toEqual({ label: 'Friday 12pm–1pm' })
  })
  it('handles midnight and 11pm edges', () => {
    expect(busiestSlot([{ dow: 0, hour: 0, grossCents: 5 }])).toEqual({ label: 'Monday 12am–1am' })
    expect(busiestSlot([{ dow: 6, hour: 23, grossCents: 5 }])).toEqual({ label: 'Sunday 11pm–12am' })
    expect(busiestSlot([{ dow: 2, hour: 11, grossCents: 5 }])).toEqual({ label: 'Wednesday 11am–12pm' })
  })
  it('returns null for empty or all-zero', () => {
    expect(busiestSlot([])).toBe(null)
    expect(busiestSlot([{ dow: 1, hour: 1, grossCents: 0 }])).toBe(null)
  })
})

describe('buildHeadline', () => {
  it('good', () => {
    expect(buildHeadline({ currCents: 421000, prevCents: 375000, periodLabel: 'this week' })).toBe(
      'Business is good this week. You made $4,210.00, which is $460.00 more than last week.',
    )
  })
  it('slower', () => {
    expect(buildHeadline({ currCents: 300000, prevCents: 400000, periodLabel: 'this month' })).toBe(
      'Business is slower this month. You made $3,000.00, which is $1,000.00 less than last month.',
    )
  })
  it('steady', () => {
    expect(buildHeadline({ currCents: 100500, prevCents: 100000, periodLabel: 'this week' })).toBe(
      'Business is steady this week. You made $1,005.00, about the same as last week.',
    )
  })
  it('exactly +2% counts as good, exactly -2% as slower; 1.99% is steady', () => {
    expect(buildHeadline({ currCents: 10200, prevCents: 10000, periodLabel: 'this week' })).toMatch(/good/)
    expect(buildHeadline({ currCents: 9800, prevCents: 10000, periodLabel: 'this week' })).toMatch(/slower/)
    expect(buildHeadline({ currCents: 10199, prevCents: 10000, periodLabel: 'this week' })).toMatch(/steady/)
  })
  it('today compares with yesterday', () => {
    expect(buildHeadline({ currCents: 20000, prevCents: 10000, periodLabel: 'today' })).toBe(
      'Business is good today. You made $200.00, which is $100.00 more than yesterday.',
    )
    expect(buildHeadline({ currCents: 5000, prevCents: 10000, periodLabel: 'today' })).toBe(
      'Business is slower today. You made $50.00, which is $50.00 less than yesterday.',
    )
    expect(buildHeadline({ currCents: 10000, prevCents: 10000, periodLabel: 'today' })).toBe(
      'Business is steady today. You made $100.00, about the same as yesterday.',
    )
  })
  it('no sales yet', () => {
    expect(buildHeadline({ currCents: 0, prevCents: 5000, periodLabel: 'this week' })).toBe(
      'No sales yet this week. Your figures will appear here as payments come in.',
    )
    expect(buildHeadline({ currCents: 0, prevCents: 0, periodLabel: 'today' })).toBe(
      'No sales yet today. Your figures will appear here as payments come in.',
    )
  })
  it('no previous sales', () => {
    expect(buildHeadline({ currCents: 12345, prevCents: 0, periodLabel: 'this month' })).toBe(
      'You made $123.45 this month.',
    )
  })
  it('never outputs NaN/Infinity/undefined', () => {
    for (const label of ['today', 'this week', 'this month']) {
      for (const [c, p] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
        expect(noBadValues(buildHeadline({ currCents: c, prevCents: p, periodLabel: label }))).toBe(true)
      }
    }
  })
})

describe('healthScore', () => {
  const hs = (growthPct, failedRate = 0, delayedSettlements = 0, prevWord) =>
    healthScore({ growthPct, failedRate, delayedSettlements }, prevWord)

  it('starts at 75 with nothing to report', () => {
    expect(hs(0)).toMatchObject({ score: 75, label: 'Healthy', tone: 'ok' })
  })
  it('combines the three factors', () => {
    // +6 (12 %), -6 (1.2 %), -6 (2 late) = 69
    expect(hs(12, 0.012, 2)).toMatchObject({ score: 69, label: 'Okay', tone: 'warn' })
  })
  it('label boundaries: 70 Healthy, 69 Okay, 50 Okay, 49 Needs a look', () => {
    expect(hs(-10)).toMatchObject({ score: 70, label: 'Healthy', tone: 'ok' })
    expect(hs(-12)).toMatchObject({ score: 69, label: 'Okay', tone: 'warn' })
    expect(hs(-30, 0.01, 0)).toMatchObject({ score: 55, label: 'Okay' }) // 75-15-5
    expect(hs(-30, 0.02, 0)).toMatchObject({ score: 50, label: 'Okay', tone: 'warn' })
    expect(hs(-30, 0.022, 0)).toMatchObject({ score: 49, label: 'Needs a look', tone: 'bad' })
  })
  it('growth is capped at plus or minus 30 (15 points)', () => {
    expect(hs(30).score).toBe(90)
    expect(hs(500).score).toBe(90)
    expect(hs(-30).score).toBe(60)
    expect(hs(-500).score).toBe(60)
  })
  it('failed payments: 1 % is -5, capped at -15 from 3 %', () => {
    expect(hs(0, 0.01).score).toBe(70)
    expect(hs(0, 0.03).score).toBe(60)
    expect(hs(0, 0.5).score).toBe(60)
  })
  it('late payouts: -3 each, capped at -12 from 4', () => {
    expect(hs(0, 0, 1).score).toBe(72)
    expect(hs(0, 0, 3).score).toBe(66)
    expect(hs(0, 0, 4).score).toBe(63)
    expect(hs(0, 0, 40).score).toBe(63)
  })
  it('the worst case is gentle, not zero', () => {
    expect(hs(-30, 0.5, 40)).toMatchObject({ score: 33, label: 'Needs a look', tone: 'bad' })
  })
  it('null growth counts as no change', () => {
    expect(hs(null).score).toBe(75)
    expect(hs(null).factors[0].detail).toBe('No sales to compare yet')
    expect(hs(null).factors[0].points).toBe(0)
  })
  it('NaN and Infinity count as zero', () => {
    expect(hs(NaN, NaN, NaN).score).toBe(75)
    expect(hs(Infinity, Infinity, Infinity).score).toBe(75)
    expect(hs(-Infinity, 0, 0).score).toBe(75)
  })
  it('a negative late count counts as none', () => {
    expect(hs(0, 0, -5).score).toBe(75)
    expect(hs(0, 0, -5).factors[2]).toEqual({ label: 'Late money to your bank', detail: 'None', points: 0 })
  })
  it('explains each factor in plain words', () => {
    const r = hs(-23, 0.015, 2)
    expect(r.factors).toEqual([
      { label: 'Sales compared with last week', detail: 'Down 23 %', points: -12 },
      { label: 'Payments that didn’t go through', detail: '1.5 % of payments', points: -8 },
      { label: 'Late money to your bank', detail: '2 late payouts', points: -6 },
    ])
    expect(r.score).toBe(50) // 75 - 11.5 - 7.5 - 6
  })
  it('wording: up, same, none, singular, prevWord', () => {
    expect(hs(3).factors[0]).toEqual({ label: 'Sales compared with last week', detail: 'Up 3 %', points: 2 })
    expect(hs(1).factors[0].detail).toBe('About the same')
    expect(hs(-1.4).factors[0].detail).toBe('About the same')
    expect(hs(10, 0, 0, 'yesterday').factors[0].label).toBe('Sales compared with yesterday')
    expect(hs(10, 0, 0, 'last month').factors[0].label).toBe('Sales compared with last month')
    expect(hs(0, 0).factors[1].detail).toBe('None')
    expect(hs(0, 0, 1).factors[2].detail).toBe('1 late payout')
  })
  it('points are whole numbers and never -0', () => {
    for (const f of hs(0.4, 0.0005, 0).factors) {
      expect(Number.isInteger(f.points)).toBe(true)
      expect(Object.is(f.points, -0)).toBe(false)
    }
  })
})

describe('buildHeadline with an outlet', () => {
  const subject = 'Tampines Mall'
  it('doing well', () => {
    expect(buildHeadline({ currCents: 421000, prevCents: 375000, periodLabel: 'this week', subject })).toBe(
      'Tampines Mall is doing well this week. It made $4,210.00, which is $460.00 more than last week.',
    )
  })
  it('slower', () => {
    expect(buildHeadline({ currCents: 300000, prevCents: 400000, periodLabel: 'this month', subject })).toBe(
      'Tampines Mall is slower this month. It made $3,000.00, which is $1,000.00 less than last month.',
    )
  })
  it('steady, and today compares with yesterday', () => {
    expect(buildHeadline({ currCents: 100500, prevCents: 100000, periodLabel: 'this week', subject })).toBe(
      'Tampines Mall is steady this week. It made $1,005.00, about the same as last week.',
    )
    expect(buildHeadline({ currCents: 20000, prevCents: 10000, periodLabel: 'today', subject })).toBe(
      'Tampines Mall is doing well today. It made $200.00, which is $100.00 more than yesterday.',
    )
  })
  it('no sales yet', () => {
    expect(buildHeadline({ currCents: 0, prevCents: 5000, periodLabel: 'this week', subject })).toBe(
      'No sales yet at Tampines Mall this week. Your figures will appear here as payments come in.',
    )
  })
  it('no previous sales', () => {
    expect(buildHeadline({ currCents: 12345, prevCents: 0, periodLabel: 'this month', subject })).toBe(
      'Tampines Mall made $123.45 this month.',
    )
  })
  it('a blank subject means no outlet', () => {
    expect(buildHeadline({ currCents: 12345, prevCents: 0, periodLabel: 'this month', subject: '  ' })).toBe('You made $123.45 this month.')
  })
})
