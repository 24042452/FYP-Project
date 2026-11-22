import { describe, expect, it } from 'vitest'
import { buildGroupModel } from '../../lib/group/model.js'

const f = (over) => ({
  id: 'x', tradingName: 'X', outlets: 1, currCents: 0, prevCents: 0, todayCents: 0,
  lateCount: 0, lateCents: 0, openProblems: 0, ...over,
})

describe('buildGroupModel', () => {
  const m = buildGroupModel({
    groupName: 'Kopi Corner',
    franchisees: [
      f({ id: 'a', tradingName: 'East', outlets: 2, currCents: 60000, prevCents: 50000, todayCents: 9000 }),
      f({ id: 'b', tradingName: 'West', currCents: 40000, prevCents: 50000, todayCents: 1000, lateCount: 1, lateCents: 12345, openProblems: 2 }),
    ],
  })

  it('adds up the group and compares with last week', () => {
    expect(m.headline).toBe('Kopi Corner made $1,000.00 this week, the same as last week.')
    expect(m.subline).toContain('2 franchisees and 3 outlets')
    expect(m.tiles[0]).toMatchObject({ value: '$1,000.00', note: 'Same as last week' })
    expect(m.tiles[1]).toMatchObject({ value: '$100.00' })
  })

  it('ranks franchisees by sales, with their change and share', () => {
    expect(m.rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(m.rows[0]).toMatchObject({ change: 'Up 20% on last week', changeTone: 'ok', sharePct: 60, outlets: '2 outlets' })
    expect(m.rows[1]).toMatchObject({ change: 'Down 20% on last week', changeTone: 'bad', sharePct: 40 })
    expect(m.best).toBe('East sold the most this week (60% of the group).')
  })

  it('flags franchisees with late payouts or open check-up items', () => {
    expect(m.rows[0].status.label).toBe('Healthy')
    expect(m.rows[1].status.label).toBe('Needs a look')
    expect(m.rows[1].issues).toEqual(['1 late payout ($123.45)', '2 check-up items'])
    expect(m.tiles[2]).toMatchObject({ value: '1', note: 'West', tone: 'warn' })
  })

  it('says when the group is up overall', () => {
    const up = buildGroupModel({ groupName: 'G', franchisees: [f({ currCents: 1100, prevCents: 1000 })] })
    expect(up.headline).toBe('G made $11.00 this week, up 10% on last week.')
  })

  it('handles a group with no sales yet', () => {
    const none = buildGroupModel({ groupName: 'G', franchisees: [f({})] })
    expect(none.headline).toBe('G made $0.00 this week.')
    expect(none.best).toBeNull()
  })
})
