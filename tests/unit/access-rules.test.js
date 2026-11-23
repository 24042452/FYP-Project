import { describe, expect, it } from 'vitest'
import { canOpen, resolveAccess, validateFranchiseeChoice } from '../../lib/access/rules.js'

const G = 'g1'
const franchisees = [
  { groupId: G, groupName: 'Kopi Corner', merchantId: 'm-west', tradingName: 'Kopi Corner West', category: 'F&B' },
  { groupId: G, groupName: 'Kopi Corner', merchantId: 'm-east', tradingName: 'Kopi Corner East', category: 'F&B' },
]

describe('resolveAccess', () => {
  it('a merchant owner sees their merchant, with no outlet lock', () => {
    const a = resolveAccess({
      memberships: [{ merchantId: 'm1', tradingName: 'Ah Hock', category: 'F&B', role: 'owner', outletId: null }],
      franchisees: [],
    })
    expect(a).toMatchObject({ id: 'm1', tier: 'merchant', readOnly: false, outletId: null, group: null, chosen: true })
  })

  it('an outlet manager is locked to their outlet', () => {
    const a = resolveAccess({
      memberships: [{ merchantId: 'm1', tradingName: 'KC East', category: 'F&B', role: 'outlet_manager', outletId: 'o2' }],
      franchisees: [],
    })
    expect(a).toMatchObject({ id: 'm1', tier: 'outlet', outletId: 'o2', readOnly: false })
  })

  it('an HQ owner sees the first franchisee by name until they pick one, read-only', () => {
    const a = resolveAccess({ memberships: [], franchisees })
    expect(a).toMatchObject({ id: 'm-east', tier: 'hq', readOnly: true, role: 'hq_owner', chosen: false })
    expect(a?.group?.franchisees.map((f) => f.id)).toEqual(['m-east', 'm-west'])
  })

  it('an HQ owner sees the franchisee in the cookie, but only if it is in their group', () => {
    expect(resolveAccess({ memberships: [], franchisees, choice: 'm-west' })).toMatchObject({ id: 'm-west', chosen: true })
    expect(resolveAccess({ memberships: [], franchisees, choice: 'someone-else' })).toMatchObject({ id: 'm-east', chosen: false })
  })

  it('no membership and no group means no access', () => {
    expect(resolveAccess({ memberships: [], franchisees: [] })).toBeNull()
  })
})

describe('canOpen', () => {
  it('outlet managers only open pages that follow their outlet', () => {
    const o = { tier: /** @type {const} */ ('outlet') }
    expect(canOpen(o, '/')).toBe(true)
    expect(canOpen(o, '/transactions')).toBe(true)
    expect(canOpen(o, '/disputes')).toBe(true)
    expect(canOpen(o, '/disputes/files/abc')).toBe(true)
    for (const p of ['/settlements', '/reconciliation', '/invoices/abc/pdf', '/reports', '/assistant', '/group']) {
      expect(canOpen(o, p)).toBe(false)
    }
  })

  it('the group overview is for HQ owners only', () => {
    expect(canOpen({ tier: 'hq' }, '/group')).toBe(true)
    expect(canOpen({ tier: 'merchant' }, '/group')).toBe(false)
    expect(canOpen({ tier: 'merchant' }, '/settlements')).toBe(true)
  })
})

describe('validateFranchiseeChoice', () => {
  const hq = /** @type {import('../../lib/access/rules.js').Access} */ (resolveAccess({ memberships: [], franchisees }))
  it('accepts only a franchisee of the same group', () => {
    expect(validateFranchiseeChoice(hq, 'm-west')).toBe('m-west')
    expect(validateFranchiseeChoice(hq, 'other')).toBeNull()
    expect(validateFranchiseeChoice(hq, 42)).toBeNull()
  })
  it('refuses for anyone who is not HQ', () => {
    const owner = /** @type {import('../../lib/access/rules.js').Access} */ (resolveAccess({
      memberships: [{ merchantId: 'm1', tradingName: 'A', category: 'F&B', role: 'owner', outletId: null }],
      franchisees,
    }))
    expect(validateFranchiseeChoice(owner, 'm-west')).toBeNull()
  })
})
