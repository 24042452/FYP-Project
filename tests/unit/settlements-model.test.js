import { describe, it, expect } from 'vitest'
import { buildSettlementsModel, monthBounds, parseMonth, parseSettlementStatus } from '../../lib/settlements/model.js'

const noBad = (v) => !/NaN|Infinity|undefined/.test(JSON.stringify(v))
const TODAY = '2026-11-11'
const row = (o) => ({
  id: o.id ?? 'x', businessDate: '2026-11-10', channel: 'nets_qr', grossCents: 10000, feeCents: 100, netCents: 9900,
  status: 'paid', expectedDate: null, paidDate: '2026-11-12', ...o,
})
const totals = { paidCents: 0, onTheWayCents: 0, lateCents: 0, lateCount: 0 }

describe('parseMonth', () => {
  it('accepts real months up to the current one, else the current month', () => {
    expect(parseMonth('2026-10', TODAY)).toBe('2026-10')
    expect(parseMonth('2026-11', TODAY)).toBe('2026-11')
    for (const bad of ['2026-13', '2026-00', '2026-12', '2027-01', 'abc', '2026-1', '', undefined, ['2026-10', 'x'], '2026-10-01']) {
      expect(parseMonth(bad, TODAY)).toBe('2026-11')
    }
  })
})

describe('monthBounds', () => {
  it('gives the first and last day', () => {
    expect(monthBounds('2026-10')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
})

describe('parseSettlementStatus', () => {
  it('accepts the three filters only', () => {
    expect(parseSettlementStatus('paid')).toBe('paid')
    expect(parseSettlementStatus('on_the_way')).toBe('on_the_way')
    expect(parseSettlementStatus('late')).toBe('late')
    expect(parseSettlementStatus('pending')).toBeUndefined()
    expect(parseSettlementStatus(undefined)).toBeUndefined()
  })
})

describe('buildSettlementsModel', () => {
  it('shows the empty month without bad values', () => {
    const m = buildSettlementsModel({ month: '2026-11', today: TODAY, rows: [], totals })
    expect(m.isEmpty).toBe(true)
    expect(m.emptyText).toBe('No payments to your bank in this period')
    expect(m.groups).toEqual([])
    expect(m.tiles.map((t) => t.value)).toEqual(['$0.00', '$0.00', '$0.00'])
    expect(noBad(m)).toBe(true)
  })

  it('groups by business date, newest first, with plain details', () => {
    const rows = [
      row({ id: 'a', businessDate: '2026-11-10', netCents: 9900 }),
      row({ id: 'b', businessDate: '2026-11-10', channel: 'card', grossCents: 5000, feeCents: 150, netCents: 4850, status: 'pending', expectedDate: '2026-11-13', paidDate: null }),
      row({ id: 'c', businessDate: '2026-11-09', status: 'delayed', expectedDate: '2026-11-11', paidDate: null }),
    ]
    const m = buildSettlementsModel({ month: '2026-11', today: TODAY, rows, totals })
    expect(m.groups.map((g) => g.dateLabel)).toEqual(['Tue 10 Nov', 'Mon 9 Nov'])
    expect(m.groups[0].totalNet).toBe('$147.50')
    const [a, b] = m.groups[0].rows
    expect(a).toMatchObject({ channelLabel: 'NETS QR', net: '$99.00', detail: 'Sales $100.00 · NETS fees $1.00', statusLabel: 'In your bank', tone: 'ok', dateNote: 'Paid Thu 12 Nov' })
    expect(b).toMatchObject({ channelLabel: 'Cards', statusLabel: 'Arriving Fri 13 Nov', tone: 'info', dateNote: '' })
    expect(m.groups[1].rows[0]).toMatchObject({ statusLabel: 'Late, due Wed 11 Nov', tone: 'bad' })
    expect(noBad(m)).toBe(true)
  })

  it('treats pending past its date as late and pending with no date as on the way', () => {
    const rows = [
      row({ id: 'a', status: 'pending', expectedDate: '2026-11-09', paidDate: null }),
      row({ id: 'b', status: 'pending', expectedDate: null, paidDate: null }),
    ]
    const [a, b] = buildSettlementsModel({ month: '2026-11', today: TODAY, rows, totals }).groups[0].rows
    expect(a.tone).toBe('bad')
    expect(b).toMatchObject({ statusLabel: 'On its way', tone: 'info', dateNote: '' })
  })

  it('tiles carry their own period hints', () => {
    const cur = buildSettlementsModel({ month: '2026-11', today: TODAY, rows: [], totals: { paidCents: 123456, onTheWayCents: 5000, lateCents: 900, lateCount: 2 } })
    expect(cur.tiles[0]).toMatchObject({ label: 'In your bank this month', value: '$1,234.56', hint: 'Paid out in November 2026' })
    expect(cur.tiles[1]).toMatchObject({ label: 'On the way', value: '$50.00', hint: 'Not due yet · all months' })
    expect(cur.tiles[2]).toMatchObject({ label: 'Late', value: '$9.00', tone: 'attention', hint: '2 days · all months' })
    const old = buildSettlementsModel({ month: '2026-10', today: TODAY, rows: [], totals })
    expect(old.tiles[0].label).toBe('In your bank in October')
    expect(old.tiles[2].hint).toBe('Nothing late · all months')
  })

  it('builds month links and keeps the status filter', () => {
    const m = buildSettlementsModel({ month: '2026-11', today: TODAY, status: 'late', rows: [], totals })
    expect(m.monthLabel).toBe('November 2026')
    expect(m.prevHref).toBe('/settlements?month=2026-10&status=late')
    expect(m.nextHref).toBeNull()
    const p = buildSettlementsModel({ month: '2026-10', today: TODAY, rows: [], totals })
    expect(p.prevHref).toBe('/settlements?month=2026-09')
    expect(p.nextHref).toBe('/settlements?month=2026-11')
    expect(p.filters.map((f) => [f.label, f.href, f.active])).toEqual([
      ['All', '/settlements?month=2026-10', true],
      ['In your bank', '/settlements?month=2026-10&status=paid', false],
      ['On the way', '/settlements?month=2026-10&status=on_the_way', false],
      ['Late', '/settlements?month=2026-10&status=late', false],
    ])
  })
})
