import { describe, it, expect } from 'vitest'
import { NAV, COMING_SOON, allNavItems, comingSoonEntry, navFor } from '../../lib/nav.js'

const slug = (/** @type {string} */ href) => href.replace(/^\//, '')

describe('NAV', () => {
  const items = allNavItems()

  it('has unique hrefs', () => {
    const hrefs = items.map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('has the four groups in order', () => {
    expect(NAV.map((g) => g.group)).toEqual(['My business', 'My money', 'Grow', 'Settings'])
  })

  it('marks exactly the MVP pages as built', () => {
    const built = items.filter((i) => i.built).map((i) => i.href).sort()
    expect(built).toEqual(
      ['/', '/transactions', '/insights', '/settlements', '/reconciliation', '/invoices', '/reports'].sort(),
    )
  })

  it('gives every unbuilt page a Coming Soon entry with a title, pitch and phase', () => {
    for (const item of items.filter((i) => !i.built)) {
      const entry = COMING_SOON[slug(item.href)]
      expect(entry, item.href).toBeDefined()
      expect(entry.title.length).toBeGreaterThan(0)
      expect(entry.pitch.length).toBeGreaterThan(0)
      expect(entry.pitch).not.toContain('\n')
      expect(Number.isInteger(entry.phase)).toBe(true)
    }
  })
})

describe('comingSoonEntry', () => {
  it('finds real entries and ignores prototype names', () => {
    expect(comingSoonEntry('disputes')).toBeDefined()
    expect(comingSoonEntry('insights')).toBeUndefined()
    for (const k of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) expect(comingSoonEntry(k)).toBeUndefined()
  })
})

describe('navFor', () => {
  const hrefs = (/** @type {any} */ n) => n.nav.flatMap((g) => g.items.filter((i) => i.built).map((i) => i.href))

  it('gives a merchant owner every built page, and no group overview', () => {
    const n = navFor({ tier: 'merchant' })
    expect(hrefs(n)).toEqual(['/', '/transactions', '/insights', '/settlements', '/reconciliation', '/invoices', '/reports'])
    expect(n.showAsk).toBe(true)
    expect(n.tabs.map((t) => t.href)).toEqual(['/', '/transactions', '/reconciliation', '/assistant'])
  })

  it('puts the group overview first for head office', () => {
    expect(hrefs(navFor({ tier: 'hq' }))[0]).toBe('/group')
  })

  it('shows an outlet manager only the pages that follow their outlet', () => {
    const n = navFor({ tier: 'outlet' })
    expect(hrefs(n)).toEqual(['/', '/transactions', '/insights'])
    expect(n.showAsk).toBe(false)
    expect(n.tabs.map((t) => t.href)).toEqual(['/', '/transactions'])
  })
})
