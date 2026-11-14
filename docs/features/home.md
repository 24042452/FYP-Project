# Home

## What it is for
The answer first: one plain sentence about how business is ("You took $4,309.00 this week, $460.00 more than last week"), then the numbers behind it. Built so a hawker can read it on a phone in seconds.

## Where it lives
- Page: `/` (`app/(portal)/page.jsx`), `?period=today|week|month` (default `week`)
- Model: `lib/dashboard/home-model.js` (`buildHomeModel`, pure, no database or clock)
- Metrics: `lib/metrics/summary.js`, `headline.js`, `health.js`
- Dates: `lib/dates.js` (`periodRange`)
- Components: `components/dashboard/` (headline, "Where your money went" bar, sales chart, channel bars, needs-attention list)

## Data used
`getDailySales`, `getHeatmap`, `getFeeTotals` (`lib/data/sales.js`), `getSettlementSummary`, `getRecentSettlements` (`lib/data/settlements.js`), `getLatestRunSummary` (`lib/data/recon.js`).

## Rules and edge cases
- **Like-for-like comparison:** the current period so far (`from`..`toDate`) is compared with the same number of days of the previous period (`prevFrom`..`prevToDate`), so a half-finished week is not compared with a full one. A month compares with the true previous calendar month.
- "Where your money went": sales, then NETS fees, then what goes to your bank, for the same range.
- "Coming to your bank" counts pending money due today or later (or with no expected date). Late money is shown separately as "plus $X late", never double counted.
- **Needs your attention** counts each problem once: a late settlement that the check-up also lists as a "settlement delay" is counted only as late. The late figure covers all time, the same rule as the Money to my bank tiles.
- **Before a demo: run `npm run seed` that morning** (and against the hosted database too). The seed sets the pending, late and "today" figures relative to the day it runs, and nothing refreshes them afterwards, so old seed data shows stale numbers.
- Money is integer cents everywhere and formatted only for display. No `NaN`: empty periods show "No sales yet for this period".
- **Business health** (0-100, `lib/metrics/health.js`): start at 75, then three factors. Sales vs the previous period: half a point per 1 % change, capped at 30 % (so -15 to +15). Payments that didn't go through: -5 per 1 % of payments, capped at -15 (3 % or more). Late payouts: -3 each, capped at -12 (4 or more). Anything not a number counts as no change. The score is rounded and kept between 0 and 100. **70 or more = "Healthy"** (green), **50 to 69 = "Okay"** (amber), **below 50 = "Needs a look"** (red). The tag reads "Business health: 75 · Healthy".
- The tag is a button (`components/dashboard/HealthTag.jsx`). It opens a panel "How we worked this out": "We start at 75.", one row per factor (what it is, the detail such as "Down 23 %", and the signed points in red, green or grey), then "= 75 out of 100 · Healthy" and "Scores of 70 or more are healthy." It closes with Escape, a click outside or the Close button, and focus returns to the tag. Each factor's points are rounded for display, so the rows can differ from the score by 1.
- Greeting uses the signed-in person's name and the Singapore hour.

## Outlet menu
- The "Showing" menu in the sidebar (and the phone menu) picks one outlet or "All outlets". A merchant with one outlet just sees its name.
- The choice is the cookie `portal_outlet` (set by the server action `selectOutlet` in `app/outlet-actions.js`, which only accepts the merchant's own outlets; read by `getSelectedOutlet` in `lib/outlets/server.js`, which ignores any id that is not theirs).
- With an outlet picked, **everything on Home follows it**: the headline names the outlet (`buildHeadline` `subject`), sales, chart, channel mix and failed payments use `outletId`; money to the bank is the outlet's share of each settlement (`getOutletSettlementShares`, summed from its successful payments inside each settlement; pure helpers in `lib/settlements/outlet-share.js`; labelled "This outlet's share of NETS payouts"); check-up problems count only those whose settlement holds a payment from the outlet (`getLatestRunSummary(merchantId, outletId)`), with one muted line for whole-business items (such as a fee mismatch). Sales & payments follows the outlet too. Money to my bank, Bills, Check-up, Reports and the Assistant stay merchant-wide and show a note saying so.
- Switching plays short animations (count-up numbers, panels fading in, a ring on the headline, bars growing, a "Now showing ..." message); all are off with reduced motion.

## Tests
- Unit: `tests/unit/home-model.test.js`, `metrics.test.js`
- Integration: `tests/integration/sales.test.js`, `isolation.test.js`
- End-to-end: `tests/e2e/ui-polish.spec.js` (TC-OUT-01 to 04 outlet menu); also `tests/unit/outlet-selection.test.js`, `tests/integration/outlets.test.js`
- End-to-end: `tests/e2e/dashboard.spec.js` (TC-DASH-01 headline and no NaN, TC-DASH-02 health panel opens and Escape closes it, TC-MOB-01 no sideways scroll at 375px)
