import { canOpen } from './access/rules.js'

/**
 * Sidebar structure (Option 1 · Clean Console). Plain word first, technical term underneath.
 * `icon` is a key that components/layout/nav-icons.jsx maps to an icon.
 * @typedef {{label: string, sub?: string, href: string, built: boolean, icon: string}} NavItem
 * @typedef {{group: string, items: NavItem[]}} NavGroup
 * @type {NavGroup[]}
 */
export const NAV = [
  {
    group: 'My business',
    items: [
      { label: 'Home', href: '/', built: true, icon: 'home' },
      { label: 'Sales & payments', sub: 'Transactions', href: '/transactions', built: true, icon: 'receipt' },
      { label: 'Insights', sub: 'Analytics', href: '/insights', built: true, icon: 'trend' },
    ],
  },
  {
    group: 'My money',
    items: [
      { label: 'Money to my bank', sub: 'Settlements', href: '/settlements', built: true, icon: 'bank' },
      { label: 'Check-up', sub: 'Reconciliation', href: '/reconciliation', built: true, icon: 'check' },
      { label: 'Bills & charges', sub: 'Invoices', href: '/invoices', built: true, icon: 'bill' },
      { label: 'Reports', sub: 'Finance reporting', href: '/reports', built: true, icon: 'report' },
      { label: 'Refunds & disputes', href: '/disputes', built: false, icon: 'refund' },
    ],
  },
  {
    group: 'Grow',
    items: [
      { label: 'Offers', href: '/offers', built: false, icon: 'tag' },
      { label: 'Promotions', sub: 'Marketing campaigns', href: '/campaigns', built: false, icon: 'megaphone' },
      { label: 'Business loans', sub: 'Merchant lending', href: '/lending', built: false, icon: 'cash' },
    ],
  },
  {
    group: 'Settings',
    items: [
      { label: 'Terminals', href: '/terminals', built: false, icon: 'terminal' },
      { label: 'Requests', sub: 'Services & change requests', href: '/requests', built: false, icon: 'inbox' },
      { label: 'Business & tax', href: '/business', built: false, icon: 'building' },
      { label: 'Connected apps', sub: 'Integrations & API', href: '/integrations', built: false, icon: 'plug' },
    ],
  },
]

/** The assistant has its own page (placeholder until Task 12); it is not in NAV. */
export const ASK_HREF = '/assistant'

/** Phone bottom tab bar. "More" opens the full menu, so it has no href. */
export const TABS = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Payments', href: '/transactions', icon: 'receipt' },
  { label: 'Check-up', href: '/reconciliation', icon: 'check' },
  { label: 'Ask', href: ASK_HREF, icon: 'chat' },
]

/**
 * The coming-soon entry for a URL slug, or undefined (own properties only, so "constructor" is not a page).
 * @param {string} slug
 */
export function comingSoonEntry(slug) {
  return Object.hasOwn(COMING_SOON, slug) ? COMING_SOON[slug] : undefined
}

/**
 * Pages that are planned but not built yet, keyed by URL slug.
 * @type {Record<string, {title: string, pitch: string, phase: number}>}
 */
export const COMING_SOON = {
  disputes: {
    title: 'Refunds & disputes',
    pitch: 'Track refunds and customer disputes in one place, and answer them before the deadline.',
    phase: 2,
  },
  offers: {
    title: 'Offers',
    pitch: 'Pick offers from NETS and its partners that bring more customers to your shop.',
    phase: 2,
  },
  campaigns: {
    title: 'Promotions',
    pitch: 'Run simple promotions, such as a discount week, and see what they earned you.',
    phase: 3,
  },
  lending: {
    title: 'Business loans',
    pitch: 'See loan offers based on your sales history, with no paperwork to start.',
    phase: 3,
  },
  terminals: {
    title: 'Terminals',
    pitch: 'See your payment terminals, check if they are online, and ask for repairs.',
    phase: 2,
  },
  requests: {
    title: 'Requests',
    pitch: 'Ask NETS to change your details or services, and follow each request until it is done.',
    phase: 2,
  },
  business: {
    title: 'Business & tax',
    pitch: 'Keep your business details and GST information up to date in one place.',
    phase: 2,
  },
  integrations: {
    title: 'Connected apps',
    pitch: 'Link your accounting or shop software so your sales flow in without retyping.',
    phase: 3,
  },
}

/** @returns {NavItem[]} */
export function allNavItems() {
  return NAV.flatMap((g) => g.items)
}

/** Head office's extra menu item: every franchisee side by side. */
export const GROUP_ITEM = { label: 'Group overview', sub: 'All franchisees', href: '/group', built: true, icon: 'group' }

/**
 * The menu for one person. Outlet managers do not see the whole-business pages (they only open Home and
 * Sales & payments); head office gets "Group overview" at the top. Same rule as canOpen in lib/access/rules.js.
 * @param {{tier: import('./access/rules.js').Tier}} access
 * @returns {{nav: NavGroup[], tabs: typeof TABS, showAsk: boolean}}
 */
export function navFor(access) {
  const allowed = (/** @type {string} */ href) => canOpen(access, href)
  const nav = NAV.map((g) => ({
    ...g,
    items: [
      ...(g.group === 'My business' && access.tier === 'hq' ? [GROUP_ITEM] : []),
      ...g.items.filter((i) => !i.built || allowed(i.href)),
    ],
  })).filter((g) => g.items.length > 0)
  return { nav, tabs: TABS.filter((t) => allowed(t.href)), showAsk: allowed(ASK_HREF) }
}
