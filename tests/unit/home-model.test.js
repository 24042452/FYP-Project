import { describe, it, expect } from 'vitest'
import { buildHomeModel, parsePeriod, greetingFor, formatDayLabel } from '../../lib/dashboard/home-model.js'

const row = (day, channel, grossCents, txnCount = 1, failedCount = 0) => ({ day, channel, grossCents, txnCount, failedCount })
const noBad = (v) => !/NaN|Infinity|undefined|null/.test(JSON.stringify(v))

const EMPTY_INPUT = {
  today: '2026-11-11',
  kind: 'week',
  firstName: 'Ah',
  hour: 9,
  currRows: [],
  prevRows: [],
  todayRows: [],
  heat: [],
  fees: { grossCents: 0, feeCents: 0 },
  settlements: [],
  settlementSummary: { pendingCents: 0, nextExpectedDate: null, lateCount: 0, lateCents: 0 },
  recon: null,
}

describe('parsePeriod', () => {
  it('accepts the three periods and falls back to week', () => {
    expect(parsePeriod('today')).toBe('today')
    expect(parsePeriod('month')).toBe('month')
    expect(parsePeriod('week')).toBe('week')
    expect(parsePeriod('year')).toBe('week')
    expect(parsePeriod(undefined)).toBe('week')
    expect(parsePeriod(['month', 'today'])).toBe('week')
  })
})

describe('small helpers', () => {
  it('formats day labels like the mockup', () => {
    expect(formatDayLabel('2026-11-16')).toBe('Mon 16 Nov')
    expect(formatDayLabel('2026-11-05')).toBe('Thu 5 Nov')
  })
  it('greets by Singapore hour', () => {
    expect(greetingFor(9, 'Ah Hock Lim')).toBe('Good morning, Ah')
    expect(greetingFor(14, 'Mei')).toBe('Good afternoon, Mei')
    expect(greetingFor(20, '')).toBe('Good evening')
  })
})

describe('buildHomeModel: nothing at all', () => {
  const m = buildHomeModel(EMPTY_INPUT)

  it('has no NaN, Infinity or undefined anywhere', () => {
    expect(noBad(m)).toBe(true)
  })
  it('uses the empty headline and empty states', () => {
    expect(m.headline).toBe('No sales yet this week. Your figures will appear here as payments come in.')
    expect(m.chart.hasData).toBe(false)
    expect(m.flow.hasData).toBe(false)
    expect(m.mix).toEqual([])
    expect(m.settlements).toEqual([])
    expect(m.checkup.hasRun).toBe(false)
    expect(m.attention.count).toBe(0)
    expect(m.attention.items).toEqual([])
  })
  it('has no change or busiest tag, but still a health score', () => {
    const labels = m.tags.map((t) => t.label)
    expect(labels.some((l) => /vs last/.test(l))).toBe(false)
    expect(labels.some((l) => /Busiest/.test(l))).toBe(false)
    expect(labels.some((l) => /Health/.test(l))).toBe(true)
  })
  it('still draws the full week on the chart with zero bars', () => {
    expect(m.chart.series).toHaveLength(7)
    expect(m.chart.series.every((s) => s.grossCents === 0)).toBe(true)
  })
  it('tiles read sensibly', () => {
    expect(m.tiles.map((t) => t.label)).toEqual(['Money in today', 'Coming to your bank', 'Needs your attention'])
    expect(m.tiles[0].value).toBe('$0.00')
    expect(m.tiles[1].value).toBe('$0.00')
    expect(m.tiles[2].value).toBe('Nothing')
    expect(m.tiles[2].tone).toBe('default')
  })
})

describe('buildHomeModel: week in progress (Wed 11 Nov)', () => {
  const input = {
    ...EMPTY_INPUT,
    currRows: [
      row('2026-11-09', 'nets_qr', 50000, 10, 1),
      row('2026-11-10', 'card', 30000, 6, 0),
      row('2026-11-11', 'nets_qr', 20000, 4, 1),
    ],
    // like-for-like: previous Mon-Wed only
    prevRows: [row('2026-11-02', 'nets_qr', 40000, 8), row('2026-11-03', 'nets_qr', 40000, 8), row('2026-11-04', 'nets_qr', 20000, 4)],
    todayRows: [row('2026-11-11', 'nets_qr', 20000, 4, 1)],
    heat: [{ dow: 4, hour: 12, grossCents: 9000 }, { dow: 1, hour: 8, grossCents: 100 }],
    fees: { grossCents: 100000, feeCents: 800 },
  }
  const m = buildHomeModel(input)

  it('headline compares Mon-Wed with Mon-Wed', () => {
    // 1000.00 vs 1000.00 => steady, not "slower" against a full previous week
    expect(m.headline).toContain('Business is steady this week')
    expect(m.headline).toContain('$1,000.00')
  })
  it('shows a change tag of 0% and the busiest slot', () => {
    const labels = m.tags.map((t) => t.label)
    expect(labels).toContain('About the same as last week')
    expect(labels).toContain('Busiest time (last 4 weeks): Friday 12pm–1pm')
  })
  it('chart covers the full Mon-Sun week with future days flagged', () => {
    expect(m.chart.series.map((s) => s.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(m.chart.series.map((s) => s.isFuture)).toEqual([false, false, false, true, true, true, true])
    expect(m.chart.bestIndex).toBe(0)
    expect(m.chart.ariaLabel).toBe('Daily sales, highest on Monday at $500.00')
  })
  it('money flow uses fee totals', () => {
    expect(m.flow.hasData).toBe(true)
    expect(m.flow.grossCents).toBe(100000)
    expect(m.flow.feeCents).toBe(800)
    expect(m.flow.netCents).toBe(99200)
    expect(m.flow.ariaLabel).toBe('Of $1,000.00 in sales, $8.00 went to NETS fees and $992.00 goes to your bank')
  })
  it('first tile uses today only', () => {
    expect(m.tiles[0].value).toBe('$200.00')
    expect(m.tiles[0].hint).toBe('3 payments so far · 1 didn’t go through')
  })
  it('channel mix is percentages', () => {
    expect(m.mix).toEqual([
      { channel: 'nets_qr', label: 'NETS QR', pct: 70 },
      { channel: 'card', label: 'Cards', pct: 30 },
    ])
  })
  it('has no bad values', () => {
    expect(noBad(m)).toBe(true)
  })
})

describe('buildHomeModel: growth, previous period empty', () => {
  it('no previous data: no change tag and no Infinity', () => {
    const m = buildHomeModel({ ...EMPTY_INPUT, currRows: [row('2026-11-09', 'nets_qr', 5000)], fees: { grossCents: 5000, feeCents: 50 } })
    expect(m.headline).toBe('You made $50.00 this week.')
    expect(m.tags.some((t) => /vs last|same as/.test(t.label))).toBe(false)
    expect(noBad(m)).toBe(true)
  })
  it('growth tag shows a rounded percent', () => {
    const m = buildHomeModel({
      ...EMPTY_INPUT,
      currRows: [row('2026-11-09', 'nets_qr', 11000)],
      prevRows: [row('2026-11-02', 'nets_qr', 10000)],
    })
    expect(m.tags.map((t) => t.label)).toContain('Up 10% on last week')
  })
})

describe('buildHomeModel: settlements and attention', () => {
  const m = buildHomeModel({
    ...EMPTY_INPUT,
    todayRows: [row('2026-11-11', 'nets_qr', 1000, 5, 2)],
    settlements: [
      { businessDate: '2026-11-10', netCents: 59340, status: 'pending', expectedDate: '2026-11-13' },
      { businessDate: '2026-11-09', netCents: 56705, status: 'paid', expectedDate: '2026-11-11' },
      { businessDate: '2026-11-08', netCents: 50870, status: 'delayed', expectedDate: '2026-11-10' },
      { businessDate: '2026-11-07', netCents: 10000, status: 'pending', expectedDate: '2026-11-09' },
    ],
    settlementSummary: { pendingCents: 69340, nextExpectedDate: '2026-11-13', lateCount: 2, lateCents: 60870 },
    recon: { runAt: '2026-11-10T16:30:00.000Z', period: '2026-10-01', matchedCount: 120, exceptionCount: 3, openCount: 3 },
  })

  it('maps statuses to the mockup wording', () => {
    expect(m.settlements.map((s) => [s.dateLabel, s.statusLabel, s.tone])).toEqual([
      ['Tue 10 Nov', 'Arriving Fri 13 Nov', 'info'],
      ['Mon 9 Nov', 'In your bank', 'ok'],
      ['Sun 8 Nov', 'Late, due Tue 10 Nov', 'bad'],
      ['Sat 7 Nov', 'Late, due Mon 9 Nov', 'bad'],
    ])
    expect(m.settlements[0].amount).toBe('$593.40')
  })
  it('counts open exceptions + failed today + late settlements', () => {
    // 3 + 2 + 2
    expect(m.attention.count).toBe(7)
    expect(m.tiles[2].value).toBe('7 things')
    expect(m.tiles[2].tone).toBe('attention')
    expect(m.attention.items.map((i) => i.href)).toEqual(['/reconciliation', '/transactions?status=failed', '/settlements'])
  })
  it('coming-to-bank tile', () => {
    expect(m.tiles[1].value).toBe('$693.40')
    expect(m.tiles[1].hint).toBe('Next: Fri 13 Nov')
  })
  it('check-up card', () => {
    expect(m.checkup.hasRun).toBe(true)
    expect(m.checkup.summary).toBe('120 payments matched · 3 need a look')
    expect(m.checkup.lastRun).toBe('Last checked Wed 11 Nov')
  })
  it('singular wording', () => {
    const one = buildHomeModel({ ...EMPTY_INPUT, recon: { runAt: '2026-11-11T01:00:00.000Z', period: '2026-10-01', matchedCount: 1, exceptionCount: 1, openCount: 1 } })
    expect(one.tiles[2].value).toBe('1 thing')
  })
})

describe('buildHomeModel: other periods', () => {
  it('today compares with yesterday and charts the last 7 days', () => {
    const m = buildHomeModel({ ...EMPTY_INPUT, kind: 'today', currRows: [row('2026-11-11', 'nets_qr', 1000)], prevRows: [row('2026-11-10', 'nets_qr', 500)] })
    expect(m.headline).toContain('than yesterday')
    expect(m.chart.series).toHaveLength(7)
    expect(m.chart.series[6].day).toBe('2026-11-11')
    expect(m.chart.title).toBe('Sales, last 7 days')
  })
  it('month charts the whole month', () => {
    const m = buildHomeModel({ ...EMPTY_INPUT, kind: 'month' })
    expect(m.chart.series).toHaveLength(30)
    expect(m.chart.title).toBe('Sales this month')
    expect(m.flow.title).toBe('Where your money went this month')
  })
})
