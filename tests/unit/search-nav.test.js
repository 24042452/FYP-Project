import { describe, expect, it } from 'vitest'
import { moveHighlight, searchHref, rowHref, suggestionView, shouldSearch, rangeLine, liveMessage } from '../../lib/search/nav.js'

describe('moveHighlight (rows + the "See all" footer, wrapping)', () => {
  // 3 rows => 4 stops: 0,1,2 are rows, 3 is "See all". -1 means nothing highlighted.
  it('ArrowDown from nothing goes to the first row, then on, then wraps to none', () => {
    expect(moveHighlight(-1, 'down', 3)).toBe(0)
    expect(moveHighlight(2, 'down', 3)).toBe(3)
    expect(moveHighlight(3, 'down', 3)).toBe(0)
  })
  it('ArrowUp from nothing goes to the footer, and wraps from the first row', () => {
    expect(moveHighlight(-1, 'up', 3)).toBe(3)
    expect(moveHighlight(0, 'up', 3)).toBe(3)
    expect(moveHighlight(3, 'up', 3)).toBe(2)
  })
  it('with no rows the footer is the only stop; with no stops nothing moves', () => {
    expect(moveHighlight(-1, 'down', 0, false)).toBe(-1)
    expect(moveHighlight(-1, 'down', 0)).toBe(0)
  })
})

describe('hrefs', () => {
  it('searchHref encodes q and keeps the outlet', () => {
    expect(searchHref('12.50')).toBe('/transactions?q=12.50')
    expect(searchHref('a b&c')).toBe('/transactions?q=a+b%26c')
  })
  it('rowHref opens the drawer', () => {
    expect(rowHref('abc')).toBe('/transactions?id=abc')
  })
})

describe('shouldSearch', () => {
  it('needs 2+ characters after trimming', () => {
    expect(shouldSearch('')).toBe(false)
    expect(shouldSearch(' 1 ')).toBe(false)
    expect(shouldSearch('12')).toBe(true)
  })
})

describe('suggestionView', () => {
  it('formats time, amount, way of paying, outlet and status', () => {
    const v = suggestionView({
      id: 'x', created_at: '2026-11-14T04:41:00.000Z', amount_cents: 1250, fee_cents: 10, channel: 'nets_qr',
      status: 'failed', failure_code: '51', customer_ref: null, outlet: null, terminal_serial: null, settlement_date: null,
    })
    expect(v).toMatchObject({ id: 'x', when: 'Sat 14 Nov, 12:41 pm', amount: '$12.50', outlet: 'Not recorded', pill: { label: 'Failed', tone: 'bad' } })
    expect(typeof v.how).toBe('string')
  })
})

describe('rangeLine', () => {
  const formatDay = (d) => `D${d}`
  it('says 12 months for a search with no dates', () => {
    expect(rangeLine({ q: '12.50', from: 'a', to: 'b', explicitDates: false, formatDay })).toBe("Payments matching '12.50' in the last 12 months.")
  })
  it('uses the chosen dates for a search, and keeps the 7-day wording without q', () => {
    expect(rangeLine({ q: 'x', from: 'a', to: 'b', explicitDates: true, formatDay })).toBe("Payments matching 'x' from Da to Db.")
    expect(rangeLine({ from: 'a', to: 'b', explicitDates: false, formatDay })).toBe('Payments from Da to Db (the last 7 days).')
    expect(rangeLine({ from: 'a', to: 'b', explicitDates: true, formatDay })).toBe('Payments from Da to Db.')
  })
})

describe('liveMessage', () => {
  it('says what a screen reader should hear', () => {
    expect(liveMessage('idle', 0, 'x')).toBe('')
    expect(liveMessage('loading', 0, 'x')).toBe('Searching…')
    expect(liveMessage('ok', 5, 'x')).toBe('5 results')
    expect(liveMessage('ok', 1, 'x')).toBe('1 result')
    expect(liveMessage('empty', 0, ' zz ')).toBe('No payments match ‘zz’.')
    expect(liveMessage('error', 0, 'x')).toMatch(/isn't working/)
  })
})
