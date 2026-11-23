# Offers & Promotions: design

- **Date:** 2026-11-24
- **Owner:** Lai Wei Jun Samuel (marketing: offers and promotions). Commits authored as GitHub `IzakiXD`, `247912433+IzakiXD@users.noreply.github.com`; PR from Dylan's `gh` login; merged with a merge commit.
- **Status:** approved by the user 2026-11-24
- **Layout chosen:** option A, "cards with payment-type filters" (mockup `design/promotions.html`; the three options as shown: `.impeccable/mocks/decision/promos-{a,b,c}-board.png`; Impeccable seed key `69023c37`)

## Why

NETS wants a portal merchants open often because it helps them grow. Offers and promotions are the "Grow" part of the menu, greyed out as "Soon" today. A merchant should be able to **take up NETS offers**, **run ready-made promotions for their customers**, and **see what the promotions did**, without leaving the page.

## Goals

1. Two pages, matching the two existing menu items:
   - **Offers** (`/offers`): NETS and partner offers for the merchant, picked for the business type. Take one up.
   - **Promotions** (`/campaigns`, label "Promotions", sub "Marketing campaigns"): ready-made promotions NETS shows to customers. Take one up, stop it, and see results.
2. **Everything happens on the page.** Taking up opens a panel that slides in from the right (same panel style as the payment details on Refunds & disputes): what it is, dates, and which outlets. Clicking outside, Esc or × closes it.
3. **Promotions run for a fixed 4 weeks**, starting tomorrow, with a **Stop** button.
4. **One running promotion per payment type per outlet.** Outlets that already run a promotion for that payment type are greyed out in the outlet list, with the reason.
5. **Outlets:**
   - An **owner with several outlets** picks outlets in the panel (tick boxes, **Select all outlets that can run it**). Outlets that can run it start ticked.
   - An **owner with one outlet** sees no list; the panel just confirms.
   - An **outlet manager** can take up and stop, but only for their own outlet.
6. **Results** for finished (ended or stopped) promotions: average sales per promotion day at its outlets, for its payment type (and its hours, if it has them), compared with the same weekdays in the 4 weeks before. Labelled as an estimate.
7. Demo data: every business starts with **1 running promotion and 2 finished ones with results**, and **1 offer already taken up**. The made-up sales get a small lift on past promotion days so the results look believable.

## Non-goals

- Merchants writing their own promotions (amount, days, wording).
- Changing fees, bills or payouts when an offer is taken up (no real NETS terms; offers are labelled as sample offers).
- Applying the discount to recorded payment amounts (payments stay as generated).
- Real delivery of promotions to customers (NETS app, terminal screen); the page says how it would work.
- Stopping or cancelling offers (offers are taken up only; they end on their own date).
- Bell alerts for offers or promotions.

## Anti-goals

- Leaving the page to take something up or see its details.
- An outlet manager starting, stopping or seeing another outlet's promotions.
- A view-only user (accountant, manager, cashier, head office) being able to take up or stop, even by sending the form by hand.
- Two running promotions of the same payment type at one outlet.
- Results that claim certainty ("this promotion earned you $X") instead of an honest comparison.
- Anything that moves the October check-up away from exactly 3 problems.

## Constraints

Same as the rest of the portal: Next.js 15 App Router, plain JavaScript, Tailwind; MySQL 8 via `mysql2` prepared statements and `.sql` migrations; every `lib/data/` function filters by the session merchant (and outlet for outlet managers) with an isolation test; keys named after their table; money in cents; times stored UTC, shown in Singapore time; DESIGN.md (Clean Console) tokens only; status = icon + word + colour; 44px targets; works at 375px; animations off under reduced motion.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Two pages matching the two menu items | One job per page; the menu stays as it is. One extra click between them. |
| B | One page with Offers / Promotions tabs | Everything in one place, but tabs hide half of it and two menu items point at one page. |
| C | One long page | Easy to scan on desktop, long on a phone; results far down. |

Taking up: the user asked that everything happen on the page, so the details and outlet choice are a **right slide-out panel**, not a pop-up in the middle or a separate page.

Promotions layout: three rendered options (cards with payment-type filters; results first; grouped by payment type). The user picked **cards with payment-type filters**.

## What the user decided

- Take up NETS offers; take up ready-made promotions and see their results.
- Show several promotions; only one can run per payment type (per outlet).
- Promotions: one tap, a fixed 4 weeks, with Stop.
- Owners and outlet managers can take up and stop; outlet managers only for their outlet.
- Owners with several outlets choose outlets, with Select all.
- Two pages (A); everything on the page with a right slide-out; promotions layout A.

## The Promotions page (`/campaigns`)

1. Title "Promotions", subtitle "Marketing campaigns · deals NETS runs for your customers".
2. **Answer sentence** (key figure in blue):
   - "1 promotion is running. Your last one, **weekend Cards**, brought in about 14% more on weekends." (When the last result was not higher: "…, **weekend Cards**, did about the same as before." / "…was lower than before.")
   - None running and no results yet: "No promotions running. Take one up and NETS shows it to your customers when they pay."
   - Sub-line: "Take up a promotion and NETS shows it to your customers when they pay. Each one runs for 4 weeks."
3. **Running now**: one card per running promotion: payment type, name, outlets ("Tampines Mall, Bedok Mall"), "started Tue 18 Nov", a pill "Running · ends Mon 15 Dec" (blue, clock), a 4-week progress bar ("Week 1 of 4 · results when it ends"), and **Stop** (secondary button). Stop asks inline: "Stop this promotion? It ends today at all its outlets." with **Yes, stop** and **Cancel**. Empty: "Nothing running. Pick one below."
4. **Promotions you can start**: filter chips (All, NETS QR, Cards, NETS Click, SGQR, eNETS; only payment types that have promotions); a grid of cards (3 columns desktop, 2 tablet, 1 phone). Each card: payment type, name, "when" line ("Saturdays and Sundays · 4 weeks"), and **Take up** (white with blue outline, like Accept). Under the button, a grey note when it matters:
   - "Already running a NETS QR promotion at 2 of your 3 outlets" (can still be taken up for the rest)
   - "NETS QR already has a promotion running until Mon 15 Dec" (no outlet left; button replaced by the note)
   - "Not offered for your payment types" when the merchant has no sales on that payment type (button replaced by the note).
5. **Results**: table of finished promotions (newest first): name with payment type and dates, "Sales on promotion days" (e.g. "$1,240 a weekend day"), "Compared with before" (green "+14%", grey "About the same" within ±2%, red "−5%"). Footer: "Estimate: promotion days compared with the same days in the 4 weeks before. Other things can change sales too." A stopped promotion that ran fewer than 7 days shows "Too short to compare". Empty: "Results show here when a promotion ends."
6. View-only users see everything without Take up / Stop, plus a note: "You can look but not start promotions. The owner or outlet manager does that." (head office: "The franchisee does that.").

### The slide-out panel (Take up)

- Payment type, name, "when" line, and dates: "4 weeks, from tomorrow (Tue 25 Nov) to Mon 22 Dec".
- Blue note: "NETS shows this deal to your customers when they pay by NETS QR at the outlets you pick. The discount comes off the price they pay; you see the results when it ends."
- **Which outlets?** (owner, several outlets): "Select all outlets that can run it" plus one tick box per outlet; outlets already running a promotion of that payment type are disabled with "Already running "10% off on Tuesdays" (NETS QR) until Mon 15 Dec". Outlets that can run it start ticked.
- Main button (red, the panel's one main action): "Start at 2 outlets" / "Start at 1 outlet" / "Start promotion" (single outlet or outlet manager). Disabled with "Pick at least one outlet." when none ticked. **Cancel**.
- After starting: the panel closes, the promotion appears in Running now (slide in), a status line says "Started. It runs until Mon 22 Dec."

## The Offers page (`/offers`)

Same structure as Promotions, layout A:
1. Title "Offers", subtitle "Deals from NETS and its partners for your business".
2. Answer sentence: "You have 1 offer active: **0.5% off NETS QR fees** until 28 Feb." / "No offers active. Pick one below."
3. **Your offers**: cards for active offers (outlets, "Active until Sat 28 Feb" green pill).
4. **Offers for you**: filter chips by kind (All, Lower fees, Equipment, Partner deals); cards with name, one-line detail, length ("3 months"), "Sample offer" tag, and **Take up**. An offer already active at every outlet shows "Active at all your outlets until 28 Feb" instead of the button.
5. Taking up uses the same right slide-out: what it is, how long, the "Sample offer: NETS has not set real terms yet" note, outlets (same rules as promotions, but several offers can be active at once; an offer can't be taken twice at the same outlet while active), and "Take up at 2 outlets".
6. Offers are picked by business category: F&B (hawker, café) and Retail each see their own list.

## Catalogue (sample content, in code)

`lib/offers/catalogue.js` and `lib/promotions/catalogue.js`, each item with a stable `key`. Promotions carry: `key`, `channel`, `name`, `when` text, rule (`days` of week, optional `hours`), and the demo lift (percent). Offers carry: `key`, `kind` (fees | equipment | partner), `name`, `detail`, `months`, `categories`.

- Promotions (both categories unless noted): NETS QR "10% off on Tuesdays"; NETS QR "Lunch deal: $1 off orders over $8" (11am–2pm weekdays, F&B); Cards "10% off weekends with Cards"; NETS Click "$2 off online orders over $20" (Retail); SGQR "Free drink with orders over $10" (F&B); eNETS "Free delivery over $30 with eNETS" (Retail).
- Offers: "0.5% off NETS QR fees" (3 months, fees, all); "Free NETS QR standee" (equipment, all); "Second terminal free for 2 months" (equipment, Retail); "8% off packaging from a NETS partner" (partner, F&B); "Free listing on a NETS partner delivery app for 1 month" (partner, F&B); "10% off shelf labels from a NETS partner" (partner, Retail). No real partner names.

## Who can do what

| Login | Sees | Can take up / stop |
|---|---|---|
| Owner (merchant or franchisee) | Whole business | Yes; picks outlets |
| Outlet manager | Only promotions and offers that include their outlet; results for their outlet | Yes, for their own outlet only |
| Accountant, manager, cashier | Whole business | No |
| Franchise head office | The franchisee it is looking at | No |

Rule: `role ∈ {'owner','outlet_manager'}` and not read-only, checked on the server. An outlet manager's requests are forced to their own outlet; any other outlet id is refused. Stopping a promotion that runs at several outlets is allowed for an outlet manager only if it runs at their outlet alone (otherwise the Stop button is hidden for them and the server refuses).

## Data model (migration `0010_offers_promotions.sql`)

- `promotion_runs`: `promotion_run_id` PK, `merchant_id`, `promotion_key`, `channel` (same enum as transactions), `starts_on` DATE, `ends_on` DATE (starts + 27 days), `stopped_on` DATE NULL, `started_by` user id NULL, `stopped_by` NULL, `created_at`. Unique `(promotion_run_id, merchant_id)`.
- `promotion_run_outlets`: `promotion_run_id`, `merchant_id`, `outlet_id`; PK (run, outlet); FKs to `promotion_runs(promotion_run_id, merchant_id)` and `outlets(outlet_id, merchant_id)`.
- `offer_takeups`: `offer_takeup_id` PK, `merchant_id`, `offer_key`, `starts_on`, `ends_on`, `taken_by`, `created_at`.
- `offer_takeup_outlets`: same pattern as promotion run outlets.
- A run is **running** when `starts_on ≤ today ≤ effective end` and not stopped; **scheduled** when `starts_on > today` (shown in Running now as "Starts tomorrow"); **finished** otherwise. Effective end = `stopped_on` (the day before, if stopped before starting it is removed from results) or `ends_on`.
- **One per payment type per outlet** is enforced inside the take-up transaction: lock (`SELECT … FOR UPDATE`) the merchant's running/scheduled runs for that channel and refuse outlets that overlap.

## Code layout

- `lib/promotions/` and `lib/offers/`: catalogues and pure rules (status, which outlets can take a promotion, answer sentence, results comparison, wording). Unit-tested.
- `lib/data/promotions.js`, `lib/data/offers.js`: list runs/take-ups with outlets (merchant- and outlet-scoped), `startPromotion`, `stopPromotion`, `takeUpOffer`, and `getPromotionSales(merchantId, {channel, outletIds, from, to, days, hours})` for results (successful payments only).
- `app/(portal)/campaigns/page.jsx`, `app/(portal)/offers/page.jsx`, `app/(portal)/campaigns/actions.js`, `app/(portal)/offers/actions.js` (server actions using `requirePage`, the respond rule, and the session user).
- `components/promotions/*`, `components/offers/*` (cards, chips, running card with progress and inline Stop confirm, results table, the slide-out panel built on the existing `components/ui/sheet.jsx` like `TxnDrawer`).
- `lib/nav.js`: Offers and Promotions built; remove their `COMING_SOON` entries. `lib/access/rules.js`: outlet managers may open both pages.
- Optional read-only API is out of scope.

## Demo data

- `lib/synthetic/generate.js` (second PRNG only; every existing payment stays the same, so the check-up keeps its 3 October problems): for each business, 2 finished promotions in the past (one 4–8 weeks ago, one 9–13 weeks ago, on payment types the business uses, never on the October anomaly days/payouts) and their lift: extra successful payments of that payment type on the promotion days (and hours) so the day's sales are about the catalogue lift higher (e.g. +14%, +6%). Extra payments get STANs, settlements and invoice fees like any other payment.
- Seed: 1 running promotion per business (started 6 days before the seed day; Tan & Sons at 2 of 3 outlets, so the outlet rule shows), the 2 finished ones, and 1 offer taken up (e.g. "0.5% off NETS QR fees" until 3 months later).

## Testing

- Unit: catalogue integrity, status, outlet eligibility (per payment type, per outlet, outlet manager), answer sentences, results maths (averages, ±2% "About the same", "Too short to compare"), wording.
- Integration: isolation for every data function; outlet manager scope; take-up refuses overlap even when two requests race; stop rules; results use only the run's outlets, payment type, days and hours.
- e2e: owner takes up a promotion for chosen outlets via the slide-out (click outside closes it); a busy outlet is disabled with its reason; stop with confirm; outlet manager sees only their outlet; accountant sees no buttons; offers take-up; no sideways scroll at 375px; TC-REC-01 still 3 problems.
- Docs: `docs/features/offers-promotions.md`, catalogue, technical design, test plan, demo script step, README, CLAUDE.md credit for IzakiXD.

## Left to the builder

- Exact sample copy within the catalogue lines above; chip order; animation timings (existing easing and durations).
- Whether "Results" also shows the payment-type total for context.

## Calls made after the builder check (Claude's)

1. **Demo lift order:** the extra payments on past promotion days are added right after the normal payments and **before** STANs, payouts, invoices, refunds and disputes are built, so they behave like any other payment (STAN, payout, fee). Existing payment amounts and times stay the same; STAN numbers and which payments get refunded or disputed may shift. The disputes rules (one open "charged twice" case with a single matching payment) are kept by the generator, and the full test suite (incl. TC-REC-01: exactly 3 October problems) is re-run.
2. **October anomalies:** past promotion windows only need to avoid the anomaly day + payment type pairs (`2026-10-18|card`, `2026-10-29|nets_qr`) and the October card fee line; the lift is added before payouts are built, so the anomaly offsets stay exactly as they are.
3. **Which outlets suit which payment type:** NETS Click and eNETS promotions only at online outlets (Tan & Sons "Online store"); NETS QR and SGQR only at physical outlets; Cards at any outlet. The outlet list shows unsuitable outlets greyed out ("Not an online outlet" / "Online only"), and results count only those outlets. Profiles get an `online: true` flag on online outlets.
4. **Live database:** like Refunds & disputes, migration 0010 and a re-seed are needed on Azure before merging. Claude asks Dylan first, then runs `node --env-file=.env.azure scripts/migrate.mjs` and the seed, and regenerates the schema export in the PR.
5. **Stopping a scheduled promotion** (taken up today, starts tomorrow) deletes the run: it never ran, so it has no results and frees the payment type at once. A running promotion keeps its row with `stopped_on` = today.
6. Dates in this document's examples are illustrative (e.g. "Tue 25 Nov"); the page always uses real dates. Outlet names show in full ("Tampines Mall #02-15").
7. `lib/access/rules.js` needs no change: outlet managers can already open `/offers` and `/campaigns`. The respond rule is the same as `canRespond` in `lib/disputes/rules.js`, so it is reused.
