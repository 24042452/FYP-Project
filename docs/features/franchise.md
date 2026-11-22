# Franchises: three levels of access

## What it is for
Some merchants are franchises. NETS asked (mock meeting, 22 Nov 2026) for three tiers of owners:

| Tier | Who | Sees | Can change |
|---|---|---|---|
| **Group** (head office) | The franchisor, e.g. Kopi Corner HQ | Every franchisee in the group: a group overview, then any franchisee's portal | Nothing (view only) |
| **Merchant** (franchisee owner) | The company that runs one or more outlets (has a MID) | Their own business, all outlets | Everything, as before |
| **Outlet** (outlet manager) | The manager of one shop | Home and Sales & payments for their outlet only | Nothing merchant-wide |

## Where it lives
- Rules (pure, unit-tested): `lib/access/rules.js` (`resolveAccess`, `canOpen`, `validateFranchiseeChoice`)
- Loading: `findMerchantForUser(userId, choice)` and `getCurrentMerchant()` in `lib/data/merchant.js`; `requirePage(path)` sends anyone who may not open a page to Home
- Group overview: `/group` (`app/(portal)/group/page.jsx`), model `lib/group/model.js`
- Head office's franchisee menu: `components/layout/FranchiseePicker.jsx`, action `selectFranchisee` in `app/franchise-actions.js` (cookie `portal_merchant`)
- Menu per tier: `navFor(access)` in `lib/nav.js`
- Tables: `merchant_groups`, `merchants.group_id`, `group_users`, `merchant_users.outlet_id` (migration `0008_franchise_groups.sql`, [ADR-003](../adr/003-franchise-tiers.md))

## Rules and edge cases
- `getCurrentMerchant()` is still the only source of the merchant id. For head office it is the franchisee they picked, and only one of **their own group's** franchisees is accepted; a made-up or other group's id falls back to the first franchisee. Every data function still filters by that one merchant id.
- Head office starts on the group overview after logging in (the old choice is cleared at sign-in). Picking a franchisee resets the outlet menu to "All outlets".
- Head office is **view only**: a blue "Head office view" line on every page, no "Run check-up" or "Mark as sorted" (the server actions refuse too).
- An outlet manager's outlet is fixed (`merchant_users.outlet_id`, a composite foreign key, so it must be an outlet of that merchant). The outlet menu shows just its name. Whole-business pages (Money to my bank, Check-up, Bills, Reports, Assistant) are hidden from the menu, redirect to Home, and the API answers 403 for settlements and filters payments and the summary to the outlet. Home keeps "Needs your attention" items they cannot open, without the link.
- A direct membership wins over a group link: a franchisee owner who is also in `group_users` sees their own business.
- The group overview compares this week so far with the same days of last week (like for like), per franchisee and in total, ranks franchisees by sales with their share of the group, and marks a franchisee "Needs a look" when it has late payouts or open check-up items.

## Demo data
`npm run seed` adds the Kopi Corner group: Kopi Corner East (2 outlets, has the October demo problems), West (a recent late payout) and North (healthy). Logins (demo password): `kopi.hq@demo.local` (head office), `kopi.east@demo.local` (East owner), `kopi.bedok@demo.local` (Bedok outlet manager). The login page has a button for each.

## Tests
- Unit: `tests/unit/access-rules.test.js`, `group-model.test.js`, `nav.test.js` (`navFor`), `home-model.test.js` (links an outlet manager cannot open)
- Integration: `tests/integration/franchise.test.js` (two groups: head office never reaches another group's franchisee; outlet lock in the API)
- End to end: `tests/e2e/franchise.spec.js` (TC-FR-01 to 04)
