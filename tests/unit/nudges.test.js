import { describe, expect, it } from 'vitest'
import { buildNudges } from '../../lib/nudges/build.js'

const base = { weekCurr: 0, weekPrev: 0, failedToday: 0, delayedSettlements: 0 }
const kinds = (/** @type {any} */ i) => buildNudges({ ...base, ...i }).map((n) => n.kind)

describe('buildNudges: sales_up', () => {
  it('is not raised at 9.99%', () => {
    expect(kinds({ weekPrev: 10000, weekCurr: 10999 })).not.toContain('sales_up')
  })
  it('is raised at exactly 10%', () => {
    const n = buildNudges({ ...base, weekPrev: 10000, weekCurr: 11000 })
    expect(n).toEqual([{ kind: 'sales_up', title: 'Your sales are up 10% this week', body: expect.any(String), link: '/' }])
  })
  it('rounds the percentage shown', () => {
    const n = buildNudges({ ...base, weekPrev: 10000, weekCurr: 12349 })
    expect(n[0].title).toBe('Your sales are up 23% this week')
  })
})

describe('buildNudges: sales_down', () => {
  it('is not raised at -14.99%', () => {
    expect(kinds({ weekPrev: 10000, weekCurr: 8501 })).not.toContain('sales_down')
  })
  it('is raised at exactly -15%', () => {
    const n = buildNudges({ ...base, weekPrev: 10000, weekCurr: 8500 })
    expect(n).toEqual([{ kind: 'sales_down', title: 'Sales are lower than usual this week', body: expect.any(String), link: '/' }])
  })
})

describe('buildNudges: failed_payments', () => {
  it('is not raised at 0', () => {
    expect(kinds({ failedToday: 0 })).not.toContain('failed_payments')
  })
  it('uses the singular for 1', () => {
    const n = buildNudges({ ...base, failedToday: 1 })
    expect(n[0]).toMatchObject({ kind: 'failed_payments', title: '1 payment needs attention', link: '/transactions?status=failed' })
  })
  it('uses the plural for more', () => {
    expect(buildNudges({ ...base, failedToday: 3 })[0].title).toBe('3 payments need attention')
  })
})

describe('buildNudges: settlement_delay', () => {
  it('is not raised at 0', () => {
    expect(kinds({ delayedSettlements: 0 })).not.toContain('settlement_delay')
  })
  it('is raised at 1', () => {
    expect(buildNudges({ ...base, delayedSettlements: 1 })[0]).toMatchObject({
      kind: 'settlement_delay',
      title: 'A payment to your bank is late',
      link: '/settlements',
    })
  })
})

describe('buildNudges: invoice_ready', () => {
  it('is raised for an unpaid invoice, with the full month name', () => {
    const n = buildNudges({ ...base, latestInvoice: { month: '2026-10', totalCents: 12345, status: 'unpaid' } })
    expect(n[0]).toMatchObject({ kind: 'invoice_ready', title: 'Your October invoice is ready', link: '/invoices' })
    expect(n[0].body).toContain('$123.45')
  })
  it('accepts a full date for the month', () => {
    const n = buildNudges({ ...base, latestInvoice: { month: '2026-01-01', totalCents: 100, status: 'unpaid' } })
    expect(n[0].title).toBe('Your January invoice is ready')
  })
  it('is not raised for paid invoices', () => {
    expect(kinds({ latestInvoice: { month: '2026-10', totalCents: 100, status: 'paid' } })).toEqual([])
  })
})

describe('buildNudges: empty inputs', () => {
  it('returns nothing and never NaN/undefined', () => {
    expect(buildNudges(base)).toEqual([])
    const all = buildNudges({
      weekCurr: 20000,
      weekPrev: 10000,
      failedToday: 2,
      delayedSettlements: 1,
      latestInvoice: { month: '2026-10', totalCents: 500, status: 'unpaid' },
    })
    expect(all).toHaveLength(4)
    for (const n of all) expect(`${n.title} ${n.body} ${n.link}`).not.toMatch(/NaN|undefined/)
  })
  it('raises no sales nudge when last week had no sales', () => {
    expect(kinds({ weekPrev: 0, weekCurr: 5000 })).toEqual([])
  })
  it('copes with missing/invalid numbers', () => {
    expect(buildNudges(/** @type {any} */ ({}))).toEqual([])
  })
})
