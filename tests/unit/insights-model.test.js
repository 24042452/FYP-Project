import { describe, expect, it } from 'vitest'
import { addDays, dayOfWeek } from '../../lib/dates.js'
import { buildInsightsModel, hourLabel, insightDates, parseRange } from '../../lib/insights/model.js'

const TODAY = '2026-11-23' // a Monday

// Ah Hock-like week: Friday and Saturday ~$840, other days ~$600-680 (cents per day, split 60/40 NETS QR/cards).
const PER_DAY = [61500, 58200, 65200, 67700, 84800, 83500, 58000]
/** @param {string} from @param {string} to */
function rowsBetween(from, to) {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const c = PER_DAY[dayOfWeek(d)]
    out.push({ day: d, channel: 'nets_qr', grossCents: Math.round(c * 0.6), txnCount: 10, failedCount: 0 })
    out.push({ day: d, channel: 'card', grossCents: Math.round(c * 0.4), txnCount: 5, failedCount: 0 })
  }
  return out
}
// Hours 7 am to 9 pm: lunch and dinner peaks, quiet 3-5 pm (dollars over the range).
const HOURS = { 7: 2162, 8: 3075, 9: 2185, 10: 2495, 11: 6220, 12: 11023, 13: 7958, 14: 2373, 15: 1505, 16: 1423, 17: 3460, 18: 7555, 19: 7029, 20: 3159, 21: 638 }
const heat = Object.entries(HOURS).map(([h, v]) => ({ dow: 0, hour: Number(h), grossCents: v * 100 }))

const dates = insightDates('3m', TODAY)
const rows = rowsBetween(dates.loadFrom, TODAY)
const m = buildInsightsModel({ range: '3m', today: TODAY, rows, heat })

describe('insight dates', () => {
  it('uses whole weeks ending yesterday, and loads back to the start of the 6-month trend', () => {
    expect(dates).toEqual({ from: '2026-08-24', to: '2026-11-22', trendFrom: '2026-05-01', loadFrom: '2026-05-01' })
    expect(insightDates('4w', TODAY).from).toBe('2026-10-26')
    expect(parseRange('6m')).toBe('6m')
    expect(parseRange('everything')).toBe('3m')
    expect([hourLabel(0), hourLabel(9), hourLabel(12), hourLabel(15)]).toEqual(['12 am', '9 am', '12 pm', '3 pm'])
  })
})

describe('buildInsightsModel', () => {
  it('finds the best days, the rush hours and the quiet time, in plain words', () => {
    expect(m.findings).toEqual([
      { title: 'Fridays and Saturdays are your best days', text: 'About $842 a day, 35% more than other days.', tone: 'info' },
      { title: 'Lunch is your rush', text: '11 am to 2 pm brings in 40% of your sales. Dinner (5 pm to 8 pm) brings 29%.', tone: 'info' },
      { title: '3 pm to 5 pm is quiet', text: 'Only 5% of your sales. A deal at that time could bring more customers in.', tone: 'tip' },
    ])
  })

  it('names a single best day when no other day is close', () => {
    const one = PER_DAY.map((c, i) => (i === 4 ? c : Math.round(c * 0.8)))
    const r = []
    for (let d = dates.from; d <= dates.to; d = addDays(d, 1)) r.push({ day: d, channel: 'nets_qr', grossCents: one[dayOfWeek(d)], txnCount: 1, failedCount: 0 })
    expect(buildInsightsModel({ range: '3m', today: TODAY, rows: r, heat }).findings[0].title).toBe('Friday is your best day')
  })

  it('averages each weekday and highlights the best ones', () => {
    expect(m.days.bars.map((b) => b.top)).toEqual(['$615', '$582', '$652', '$677', '$848', '$835', '$580'])
    expect(m.days.bars.filter((b) => b.highlight).map((b) => b.label)).toEqual(['Fri', 'Sat'])
    expect(m.days.say).toBe('Friday is your best day, Sunday your quietest.')
  })

  it('shows the open hours, with the two rushes highlighted', () => {
    expect(m.hours.bars[0].label).toBe('7a')
    expect(m.hours.bars.at(-1)?.label).toBe('9p')
    expect(m.hours.bars.filter((b) => b.highlight).map((b) => b.label)).toEqual(['11a', '12p', '1p', '5p', '6p', '7p'])
    expect(m.hours.say).toBe('Busiest from 11 am to 2 pm and 5 pm to 8 pm.')
  })

  it('shows 6 full months plus this month so far, comparing the last two full months', () => {
    expect(m.trend.bars.map((b) => b.label)).toEqual(['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'])
    expect(m.trend.bars.at(-1)).toMatchObject({ partial: true, highlight: false })
    expect(m.trend.bars.find((b) => b.highlight)?.label).toBe('Oct')
    expect(m.trend.say).toMatch(/^October: \$\d{1,2},\d{3}\.\d{2}, (up|down) \d+\.\d% on September\.$/)
    expect(m.trend.note).toMatch(/^November so far \(to 22 Nov\) is striped\./)
  })

  it('gives each payment type its share, biggest first', () => {
    expect(m.mix.rows).toEqual([
      { channel: 'nets_qr', label: 'NETS QR', pct: 60 },
      { channel: 'card', label: 'Cards', pct: 40 },
    ])
    expect(m.mix.say).toBe('Customers pay most with NETS QR (60% of sales).')
  })

  it('compares outlets only when there are two or more', () => {
    expect(m.outlets.rows).toEqual([])
    const two = buildInsightsModel({ range: '3m', today: TODAY, rows, heat, outlets: [{ id: 'a', name: 'Online', grossCents: 25000 }, { id: 'b', name: 'Jurong', grossCents: 75000 }] })
    expect(two.outlets.rows.map((o) => [o.name, o.pct, o.amount])).toEqual([['Jurong', 75, '$750.00'], ['Online', 25, '$250.00']])
    expect(two.outlets.say).toBe('Jurong brings in 75% of your sales.')
  })

  it('has nothing to show for a new merchant', () => {
    const none = buildInsightsModel({ range: '4w', today: TODAY, rows: [], heat: [] })
    expect(none.hasData).toBe(false)
    expect(none.findings).toEqual([])
    expect(none.hours.bars).toEqual([])
  })

  it('labels the range with its dates', () => {
    expect(m.rangeLabel).toBe('Last 3 months')
    expect(m.dates).toBe('24 Aug to 22 Nov 2026')
  })
})
