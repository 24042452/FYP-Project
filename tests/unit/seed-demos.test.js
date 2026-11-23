import { describe, it, expect } from 'vitest'
import { DEMOS } from '../../scripts/seed.mjs'

describe('seed demos', () => {
  it('Tan & Sons has an owner and a view-only accountant', () => {
    const tan = DEMOS.find((d) => d.trading_name === 'Tan & Sons Retail')
    expect(tan.users.map((u) => u.role)).toEqual(['owner', 'accountant'])
    expect(tan.users[1].email).toBe('retail.accounts@demo.local')
  })
})

import { generateDataset } from '../../lib/synthetic/generate.js'
import { planPromotionsAndOffer } from '../../scripts/seed.mjs'

describe('seed promotions and offer', () => {
  const today = '2026-11-24'
  const plan = (demo) => {
    const data = generateDataset({ profile: demo.profile, seed: demo.seed, start: '2026-05-01', end: today, today, outlets: demo.outlets })
    return { data, p: planPromotionsAndOffer(demo, data, today) }
  }
  const tan = DEMOS.find((d) => d.trading_name === 'Tan & Sons Retail')

  it('Tan & Sons has an online outlet flagged and its running promotion is at Tampines Mall only', () => {
    const { data, p } = plan(tan)
    expect(data.outlets.filter((o) => o.online).map((o) => o.name)).toEqual(['Online store'])
    const run = p.runs.find((r) => r.running)
    expect(run.key).toBe('qr_tuesday')
    expect(run.starts_on).toBe('2026-11-18')
    expect(run.ends_on).toBe('2026-12-15')
    expect(run.outletIds).toEqual([data.outlets.find((o) => o.name === 'Tampines Mall #02-15').id])
    expect(p.runs.filter((r) => !r.running)).toHaveLength(2)
  })

  it('other businesses run it at all physical outlets, and each takes up the offer at all outlets', () => {
    for (const demo of DEMOS) {
      const { data, p } = plan(demo)
      const run = p.runs.find((r) => r.running)
      if (demo !== tan) expect(run.outletIds).toEqual(data.outlets.filter((o) => !o.online).map((o) => o.id))
      expect(p.offer).toMatchObject({ key: 'qr_fee_cut', starts_on: '2026-11-14', ends_on: '2027-02-13', outletIds: data.outlets.map((o) => o.id) })
    }
  })
})
