import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { NAV, TABS, COMING_SOON, ASK_HREF, allNavItems } from '../../lib/nav.js'

const root = path.resolve(__dirname, '../..')
const portalDir = path.join(root, 'app', '(portal)')

// Routes that exist as their own page today, or are planned tasks that will add them.
const BUILT_LATER = new Set(allNavItems().filter((i) => i.built).map((i) => i.href))

/** @param {string} href */
function resolves(href) {
  if (href === '/') return fs.existsSync(path.join(portalDir, 'page.jsx'))
  const slug = href.slice(1)
  if (fs.existsSync(path.join(portalDir, slug, 'page.jsx'))) return true // real or placeholder page
  if (COMING_SOON[slug]) return true // Coming Soon page via [module]
  return BUILT_LATER.has(href) // built-page slug: [module] shows "being built", not a 404
}

describe('shell links never 404', () => {
  it('the Ask button points at a real placeholder page', () => {
    expect(fs.existsSync(path.join(portalDir, 'assistant', 'page.jsx'))).toBe(true)
    expect(resolves(ASK_HREF)).toBe(true)
  })

  it('every sidebar and bottom-tab link resolves', () => {
    const hrefs = [...NAV.flatMap((g) => g.items.map((i) => i.href)), ...TABS.map((t) => t.href), ASK_HREF]
    for (const href of hrefs) expect(resolves(href), href).toBe(true)
  })
})
