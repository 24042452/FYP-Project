import { describe, it, expect } from 'vitest'
import { DEMOS } from '../../scripts/seed.mjs'

describe('seed demos', () => {
  it('Tan & Sons has an owner and a view-only accountant', () => {
    const tan = DEMOS.find((d) => d.trading_name === 'Tan & Sons Retail')
    expect(tan.users.map((u) => u.role)).toEqual(['owner', 'accountant'])
    expect(tan.users[1].email).toBe('retail.accounts@demo.local')
  })
})
