# Backlog: open issues and ideas after the MVP

Last updated: 2026-11-15. Collected from the build reviews of PRs #1–#3. None of these block the Touchpoint 1 demo. Bigger next features are in [01-project-plan.md](01-project-plan.md) (Phase 1 onwards).

Each item says where it is and why it matters. Tick items off (or delete them) in the PR that fixes them.

## Before the demo (decide or do)

- [ ] **Re-seed the demo data on demo morning** (local and Azure: `node --env-file=.env.azure scripts/seed.mjs`). "Today", "this week", pending and late figures are fixed to the day the seed ran.
- [ ] **Change the Azure database password** (it was exposed once outside the repo), then update `.env.azure` and Vercel.
- [x] **Health score wording** (`lib/metrics/health.js`): it shows a low red score ("21 · Needs attention") next to "Business is good this week" because the plan's formula takes off 1,000 × failed rate and 5 per late payout. Soften the formula or rename it (e.g. "Things to check"). (done: new rule and explanation panel)
- [ ] **AI mode has never run against the live Anthropic API** (no key). Test it before showing it, or keep rules mode for the demo.
- [ ] Desktop top-bar search box does nothing yet (the phone search icon opens Sales & payments with search focused).

## User experience

- [ ] Money to my bank: the "Late" and "On the way" tiles cover all months but the list is per month, so the Late filter can be empty while the tile is above zero. Add "see all months" or match the periods.
- [ ] Money to my bank: "‹ Earlier" / "Later ›" wrap onto two lines at 375 px.
- [ ] Check-up: failed payments are ordered by day, then by id, not by time.
- [ ] Check-up: the transactions Excel export stops at 50,000 rows without saying so.
- [ ] Home week chart tooltip shows a raw date ("2026-11-05"); use the day label.
- [ ] Outlet switch animation may not replay if you switch twice within ~250 ms (`components/dashboard/SwitchFx.jsx`).
- [ ] Sales & payments: Ctrl/Cmd-click on a row doesn't open a new tab.

## Accessibility

- [ ] Sales & payments rows use `aria-selected` on a plain table row (not valid ARIA); use `aria-current` or a data attribute.
- [ ] Bills: the "Pay now" button's accessible name differs from its visible text (WCAG 2.5.3).
- [ ] Assistant: the whole message list is an `aria-live` region; screen readers re-read it. Put it on the newest answer only.
- [ ] Settlements: section `aria-label`s repeat their headings.

## Data, security and robustness

- [ ] Login rate limit lives in memory (per server, never pruned) and a blocked email answers slightly faster than a wrong password. Fine for a prototype; use the database or Redis before real users.
- [ ] Old login sessions are never cleaned up; add a cleanup job (Phase 1 cron).
- [ ] `middleware.js` matcher also skips paths like `/loginx`; tighten to `login(?:/|$)`.
- [ ] The portal shell receives the whole merchant object (id, category, email) on the client; pass only what it shows.
- [ ] Deleting an outlet, terminal or settlement would delete its payments (cascade). The app never does this; keep it that way or switch to soft deletes before adding any delete feature.
- [ ] `recon_exceptions.settlement_id` / `transaction_id` are loose references (no foreign keys).
- [ ] `withTransaction` hides the original error if the rollback itself fails.
- [x] `healthScore` isn't guarded against a NaN growth figure (callers never pass one today). (done: non-finite inputs count as 0)
- [ ] Refunds: channel mix ignores negative totals and `txnCount` includes refunded rows. Revisit when refunds are built (Phase 1).
- [ ] Assistant: `get_settlement_status` has no maximum date range; the "unknown tool" check matches error text.
- [ ] `getLatestRunSummary` returns the stored exception count (incl. failed payments) next to the open count (excl. them). Only the open count is shown; don't render both.

## Code tidy-ups

- [ ] Month helpers and constants (`MONTH_SHORT`/`MONTH_LONG`, month regex, first month, link-button styles) are copied across several files; move them to `lib/dates.js` and one UI helper.
- [ ] `LIMIT` in two queries is a clamped number written into the SQL instead of a placeholder.
- [ ] `scripts/seed.mjs` re-implements the week-sales and late rules in SQL (it can't import server-only code); keep it in step with `lib/data` or share pure helpers.
- [ ] Seeder: the invoice for a month can include fees from payments trimmed at seed time if the seed runs on the month's last day; terminal rental divides by the terminal count (NaN with zero terminals); MDR lines are detected by having a channel.
- [ ] shadcn UI files were reformatted when converted to JavaScript, so future shadcn updates will show big diffs.
- [ ] `eslint.config.mjs` still ignores `next-env.d.ts`, a TypeScript-era file.

## Tests and CI

- [ ] e2e TC-DASH-01 visits week twice and never "Today"; the dashboard e2e only checks that the headline exists.
- [ ] Invoice PDF test only checks the file is a PDF, not its contents (UEN, footer).
- [ ] Seed trimming tests miss the "nothing to trim" and "delayed settlement" cases.
- [ ] CI: no `timeout-minutes`, runs twice on PR branches (push + pull_request), MySQL password on the command line (warning only).
