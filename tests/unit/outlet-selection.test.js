import { describe, it, expect } from 'vitest'
import { OUTLET_COOKIE, resolveOutlet, validateOutletChoice } from '../../lib/outlets/selection.js'

const OUTLETS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Online' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Tampines Mall' },
]

describe('resolveOutlet', () => {
  it('finds the chosen outlet', () => {
    expect(resolveOutlet(OUTLETS, OUTLETS[1].id)).toEqual(OUTLETS[1])
  })
  it('treats nothing, "all" and unknown ids as all outlets', () => {
    for (const v of [undefined, null, '', 'all', 'nope', '33333333-3333-4333-8333-333333333333', 42]) {
      expect(resolveOutlet(OUTLETS, /** @type {any} */ (v))).toBeNull()
    }
  })
  it('ignores an outlet id when the merchant has no outlets', () => {
    expect(resolveOutlet([], OUTLETS[0].id)).toBeNull()
  })
})

describe('validateOutletChoice', () => {
  it('accepts "all" and this merchants outlets', () => {
    expect(validateOutletChoice(OUTLETS, 'all')).toEqual({ ok: true, outletId: null })
    expect(validateOutletChoice(OUTLETS, OUTLETS[0].id)).toEqual({ ok: true, outletId: OUTLETS[0].id })
  })
  it('rejects another merchants outlet and junk', () => {
    for (const v of ['33333333-3333-4333-8333-333333333333', '', 'x', null, undefined, 7]) {
      expect(validateOutletChoice(OUTLETS, /** @type {any} */ (v)).ok).toBe(false)
    }
  })
  it('exposes the cookie name', () => {
    expect(OUTLET_COOKIE).toBe('portal_outlet')
  })
})
