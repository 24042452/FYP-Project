import { describe, expect, it } from 'vitest'
import { buildNumbersModel } from '../../lib/dashboard/numbers-model.js'

/** One day's row for a payment type. @param {string} channel @param {number} grossCents @param {number} ok @param {number} failed */
const row = (channel, grossCents, ok, failed = 0) => ({ day: '2026-11-16', channel, grossCents, txnCount: ok + failed, failedCount: failed })

// Ah Hock, week of 16 Nov against the same days a week earlier (the mock-up figures).
const curr = [
  row('nets_qr', 209928, 275, 6), row('nets_click', 51812, 68, 2), row('enets', 27560, 35),
  row('card', 125125, 153, 3), row('sgqr', 58548, 79),
]
const prev = [
  row('nets_qr', 239067, 290, 4), row('nets_click', 43903, 54, 1), row('enets', 28445, 36, 1),
  row('card', 125717, 168, 2), row('sgqr', 78186, 91),
]

describe('buildNumbersModel', () => {
  const m = buildNumbersModel({ kind: 'week', currRows: curr, prevRows: prev })

  it('titles the panel for the period and says what it is compared with', () => {
    expect(m.title).toBe('This week in numbers')
    expect(m.compared).toBe('compared with the same days last week')
    expect(buildNumbersModel({ kind: 'today', currRows: curr, prevRows: prev }).compared).toBe('compared with yesterday')
    expect(buildNumbersModel({ kind: 'month', currRows: curr, prevRows: prev }).title).toBe('This month in numbers')
  })

  it('gives four key numbers with their change', () => {
    expect(m.tiles.map((t) => [t.label, t.value, t.change, t.tone])).toEqual([
      ['Sales', '$4,729.73', '8.2%', 'bad'],
      ['Payments', '610', '4.5%', 'bad'],
      ['Average sale', '$7.75', '3.9%', 'bad'],
      ['Didn’t go through', '1.8%', '0.5 pts', 'bad'],
    ])
    expect(m.tiles.map((t) => t.direction)).toEqual(['down', 'down', 'down', 'up'])
    expect(m.tiles[0].was).toBe('$5,153.18 last week')
  })

  it('ranks payment types by how much they moved sales, with bar sizes', () => {
    expect(m.drivers.map((d) => [d.label, d.delta, d.pct, d.tone])).toEqual([
      ['NETS QR', '−$291.39', '−12.2%', 'bad'],
      ['SGQR', '−$196.38', '−25.1%', 'bad'],
      ['NETS Click', '+$79.09', '+18.0%', 'ok'],
      ['eNETS (online)', '−$8.85', '−3.1%', 'bad'],
      ['Cards', '−$5.92', '−0.5%', 'bad'],
    ])
    expect(m.drivers[0].size).toBe(100)
    expect(m.drivers[1].size).toBe(67)
    expect(m.drivers[2].size).toBe(27)
  })

  it('says in words what drove the change', () => {
    expect(m.summary).toBe('Sales fell 8.2%. Most of the drop came from NETS QR (−⁠$291.39) and SGQR (−⁠$196.38). NETS Click grew 18.0%.')
  })

  it('says when sales rose', () => {
    const up = buildNumbersModel({ kind: 'week', currRows: prev, prevRows: curr })
    expect(up.summary).toBe('Sales rose 9.0%. Most of the rise came from NETS QR (+⁠$291.39) and SGQR (+⁠$196.38). NETS Click fell 15.3%.')
    expect(up.tiles[0]).toMatchObject({ direction: 'up', tone: 'ok' })
  })

  it('has nothing to compare when the previous period had no sales', () => {
    const fresh = buildNumbersModel({ kind: 'week', currRows: curr, prevRows: [] })
    expect(fresh.tiles[0]).toMatchObject({ value: '$4,729.73', change: null, was: 'No sales last week' })
    expect(fresh.summary).toBe('No sales last week to compare with.')
    expect(fresh.drivers).toEqual([])
  })

  it('does not call an empty start of the period a 100% drop', () => {
    const early = buildNumbersModel({ kind: 'week', currRows: [], prevRows: prev })
    expect(early.hasData).toBe(true)
    expect(early.tiles[0]).toMatchObject({ value: '$0.00', change: null, was: '$5,153.18 last week' })
    expect(early.summary).toBe('No sales yet this week. Over the same days last week you made $5,153.18.')
    expect(early.drivers).toEqual([])
  })

  it('keeps the minus sign with its amount when the summary wraps', () => {
    expect(m.summary).not.toContain('−$')
    expect(m.summary).toContain('−⁠$291.39')
  })

  it('is empty when there are no sales at all', () => {
    const none = buildNumbersModel({ kind: 'today', currRows: [], prevRows: [] })
    expect(none.hasData).toBe(false)
  })

  it('treats a change under 0.05% as no change', () => {
    const same = buildNumbersModel({ kind: 'week', currRows: prev, prevRows: prev })
    expect(same.tiles[0]).toMatchObject({ change: '0.0%', direction: 'flat', tone: 'mute' })
    expect(same.summary).toBe('Sales are the same as last week.')
  })
})
