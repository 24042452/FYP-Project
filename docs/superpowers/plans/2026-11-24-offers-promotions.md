# Offers & Promotions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/campaigns` (Promotions) and `/offers` (Offers): merchants take up ready-made NETS promotions (4 weeks, one per payment type per outlet, Stop, results) and NETS offers, all on the page through a right slide-out panel with an outlet picker.

**Architecture:** Catalogues and pure rules in `lib/promotions/` and `lib/offers/`; new tables for runs/take-ups and their outlets, filled by seed; merchant/outlet-scoped data functions; server-rendered pages with small client components and server actions; the slide-out reuses `components/ui/sheet.jsx` like `components/transactions/TxnDrawer.jsx`. Demo results come from a small lift on past promotion days added by the generator.

**Tech Stack:** Next.js 15 App Router (plain JS), Tailwind, MySQL 8 via `mysql2`, Zod, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-11-24-offers-promotions-design.md` (read its "Calls made after the builder check" section too).

## Global Constraints

- Every commit: `git -c user.name=IzakiXD -c user.email=247912433+IzakiXD@users.noreply.github.com commit ...`. No `Co-Authored-By`, no "Generated with" lines. Branch `feat/offers-promotions`.
- Every `lib/data/` function takes `merchantId` (from the session) and filters by it; outlet managers are scoped to `outletId`. One isolation test per new data function.
- Keys named after their table. Money in integer cents. Times stored UTC (`UTC_TIMESTAMP(3)` for any time written by code); dates (`starts_on`, `ends_on`, `stopped_on`) are Singapore calendar dates.
- Take up / stop rule: `role ∈ {'owner','outlet_manager'}` and `!readOnly` — reuse `canRespond` from `lib/disputes/rules.js`. Outlet managers act only on their own outlet. Checked on the server.
- Promotions run exactly 4 weeks: `starts_on` = tomorrow (SGT), `ends_on` = `starts_on` + 27 days. At most one running or scheduled promotion per payment type per outlet.
- Payment type ↔ outlet: NETS Click and eNETS only at online outlets; NETS QR and SGQR only at physical outlets; Cards at any outlet.
- Copy (verbatim from the spec): page titles "Promotions" / "Offers"; subtitles "Marketing campaigns · deals NETS runs for your customers" / "Deals from NETS and its partners for your business"; buttons "Take up", "Stop", "Yes, stop", "Cancel", "Start at N outlets" / "Start at 1 outlet" / "Start promotion", "Take up at N outlets"; pills "Running · ends Mon 15 Dec", "Starts tomorrow", "Active until Sat 28 Feb"; tag "Sample offer"; results footer "Estimate: promotion days compared with the same days in the 4 weeks before. Other things can change sales too."; "Too short to compare"; "About the same" (within ±2%).
- Take up is white with a blue outline (same classes as Accept on Refunds & disputes); the panel's start button is the red main action.
- Design: DESIGN.md tokens only; status = icon + word + colour; 44px targets; no sideways scroll at 375px; animations use the existing easing and switch off under reduced motion; the panel closes by clicking outside, Esc or ×.
- The October 2026 check-up of every demo business with anomalies still shows exactly 3 problems (TC-REC-01).

## Review Focus

1. **Two take-ups racing for the same payment type and outlet** (double click, two tabs): only one succeeds; the other gets "That outlet already has a NETS QR promotion. Pick another outlet." (Task 4 integration test).
2. **Forged outlet ids** (another merchant's outlet, or an outlet manager naming another outlet): refused, nothing written (Tasks 4 and 6).
3. **Stopping a promotion that has not started** (taken today): the run is deleted and the payment type is free again at once (Task 4).
4. **Results for a promotion stopped after fewer than 7 days, or with no baseline sales:** "Too short to compare", never NaN/Infinity (Task 3 unit tests).
5. **A business with one outlet / no online outlet:** no outlet list; online-only promotions (NETS Click, eNETS) do not appear as startable (Tasks 3 and 7).

---

### Task 1: Tables

**Files:**
- Create: `db/migrations/0010_offers_promotions.sql`
- Modify: `tests/integration/helpers.js` (TABLES: add `'promotion_run_outlets', 'promotion_runs', 'offer_takeup_outlets', 'offer_takeups'` before `'outlets'`), `tests/integration/schema.test.js`, `db/export/SOI-2026-0021-sherwin.sql` (regenerate with `node --env-file=.env.local scripts/export-schema.mjs SOI-2026-0021-sherwin`)

**Interfaces (produces):**
```sql
ALTER TABLE outlets ADD COLUMN is_online TINYINT(1) NOT NULL DEFAULT 0;
CREATE TABLE promotion_runs (
  promotion_run_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, promotion_key VARCHAR(40) NOT NULL,
  channel ENUM('nets_qr','nets_click','enets','card','sgqr') NOT NULL,
  starts_on DATE NOT NULL, ends_on DATE NOT NULL, stopped_on DATE NULL,
  started_by CHAR(36) NULL, stopped_by CHAR(36) NULL, created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (promotion_run_id), UNIQUE KEY uq_prun_id_merchant (promotion_run_id, merchant_id),
  KEY idx_prun_merchant (merchant_id, channel, ends_on),
  CONSTRAINT fk_prun_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_prun_started FOREIGN KEY (started_by) REFERENCES users (user_id) ON DELETE SET NULL,
  CONSTRAINT fk_prun_stopped FOREIGN KEY (stopped_by) REFERENCES users (user_id) ON DELETE SET NULL
);
CREATE TABLE promotion_run_outlets (
  promotion_run_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, outlet_id CHAR(36) NOT NULL,
  PRIMARY KEY (promotion_run_id, outlet_id),
  CONSTRAINT fk_pro_run FOREIGN KEY (promotion_run_id, merchant_id) REFERENCES promotion_runs (promotion_run_id, merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_pro_outlet FOREIGN KEY (outlet_id, merchant_id) REFERENCES outlets (outlet_id, merchant_id) ON DELETE CASCADE
);
CREATE TABLE offer_takeups ( offer_takeup_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, offer_key VARCHAR(40) NOT NULL,
  starts_on DATE NOT NULL, ends_on DATE NOT NULL, taken_by CHAR(36) NULL, created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (offer_takeup_id), UNIQUE KEY uq_otu_id_merchant (offer_takeup_id, merchant_id), KEY idx_otu_merchant (merchant_id, offer_key, ends_on),
  CONSTRAINT fk_otu_merchant FOREIGN KEY (merchant_id) REFERENCES merchants (merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_otu_user FOREIGN KEY (taken_by) REFERENCES users (user_id) ON DELETE SET NULL );
CREATE TABLE offer_takeup_outlets ( offer_takeup_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, outlet_id CHAR(36) NOT NULL,
  PRIMARY KEY (offer_takeup_id, outlet_id),
  CONSTRAINT fk_oto_takeup FOREIGN KEY (offer_takeup_id, merchant_id) REFERENCES offer_takeups (offer_takeup_id, merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_oto_outlet FOREIGN KEY (outlet_id, merchant_id) REFERENCES outlets (outlet_id, merchant_id) ON DELETE CASCADE );
```
(Check `outlets` has a `(outlet_id, merchant_id)` unique key; add one if missing, as 0009 did for transactions.)

- [ ] **Step 1:** schema test `it('has promotion and offer tables with merchant-scoped keys, and outlets.is_online')`: `outlets.is_online` default `0`; the four tables exist; `promotion_runs.channel` type equals the transactions channel enum.
- [ ] **Step 2:** `npm run test:integration -- schema` → FAIL. **Step 3:** write the migration; update TABLES. **Step 4:** `npm run migrate`; `npm run test:integration` → PASS; regenerate the export.
- [ ] **Step 5:** Commit `feat(db): tables for promotion runs and offer take-ups`.

### Task 2: Catalogues and demo lift in the generator

**Files:**
- Create: `lib/promotions/catalogue.js`, `lib/offers/catalogue.js`
- Modify: `lib/synthetic/profiles.js` (Tan & Sons "Online store" gets `online: true`), `lib/synthetic/generate.js`
- Test: `tests/unit/promotions-catalogue.test.js`, `tests/unit/generate.test.js`

**Interfaces (produces):**
- `PROMOTIONS: {key, channel, name, when, days: number[] (0=Sun..6=Sat), hours?: [startHour, endHour], categories: ('F&B'|'Retail')[], liftPct: number}[]` — the six spec items, e.g. `{key:'qr_tuesday', channel:'nets_qr', name:'10% off on Tuesdays', when:'Every Tuesday', days:[2], categories:['F&B','Retail'], liftPct:12}`; `{key:'qr_lunch', channel:'nets_qr', name:'Lunch deal: $1 off orders over $8', when:'11am to 2pm on weekdays', days:[1,2,3,4,5], hours:[11,14], categories:['F&B'], liftPct:9}`; `{key:'card_weekend', channel:'card', name:'10% off weekends with Cards', when:'Saturdays and Sundays', days:[0,6], categories:['F&B','Retail'], liftPct:14}`; `{key:'click_online', channel:'nets_click', name:'$2 off online orders over $20', when:'Every day, online store', days:[0..6], categories:['Retail'], liftPct:6}`; `{key:'sgqr_drink', channel:'sgqr', name:'Free drink with orders over $10', when:'Every day', days:[0..6], categories:['F&B'], liftPct:8}`; `{key:'enets_delivery', channel:'enets', name:'Free delivery over $30 with eNETS', when:'Every day, online store', days:[0..6], categories:['Retail'], liftPct:7}`. `promotionByKey(key)`.
- `OFFERS: {key, kind: 'fees'|'equipment'|'partner', name, detail, months, categories}[]` — the six spec items (keys `qr_fee_cut`, `qr_standee`, `second_terminal`, `packaging_partner`, `delivery_listing`, `shelf_labels`). `offerByKey(key)`.
- Generator: profile outlets may carry `online: true`; `Dataset.outlets[].online: boolean`; `Dataset.pastPromotions: {key, channel, outletIds: string[], starts_on, ends_on}[]` (2 per business, chosen from catalogue items that fit the business category and its outlets per the payment-type ↔ outlet rule; one ending 4–8 weeks before `today`, one 9–13 weeks before; never on `2026-10-18|card` or `2026-10-29|nets_qr`). Extra successful payments for each past promotion are added with a **third** PRNG (`mulberry32(seed ^ 0x9a0b)`) right after the normal payments and before STANs, payouts, invoices, refunds and disputes are built: on each promotion day (and hours, if any), at its outlets, for its payment type, add payments until that day+type sales are about `liftPct`% above the normal amount.

- [ ] **Step 1: Failing tests:** catalogue `it('has the six promotions and six offers with unique keys and valid channels')`; generate: `it('keeps every existing payment amount and time the same')` (capture `[id, amount_cents, created_at]` for hawker payments 0, 1000 and the last one from the unmodified generator first); `it('adds 2 past promotions per business that fit its category and outlets')`; `it('lifts sales on past promotion days by about the catalogue lift')` (promotion-day average for the payment type vs the same weekdays in the 4 weeks before: within ±4 points of `liftPct`); `it('still injects the 3 October anomalies')` (existing tests stay green).
- [ ] **Step 2:** `npm test -- generate promotions-catalogue` → FAIL. **Step 3:** implement. **Step 4:** `npm test` and `npm run test:integration` → PASS (fix tests that pinned STAN values or which payment is refunded/disputed only if they pinned incidental values; never change anomaly expectations).
- [ ] **Step 5:** Commit `feat(data): promotion and offer catalogues; demo lift on past promotion days`.

### Task 3: Rules (pure)

**Files:**
- Create: `lib/promotions/rules.js`, `lib/offers/rules.js`
- Test: `tests/unit/promotions-rules.test.js`, `tests/unit/offers-rules.test.js`

**Interfaces (produces):**
- `runStatus(run: {startsOn, endsOn, stoppedOn}, today): 'scheduled'|'running'|'finished'`; `runPill(run, today): {tone, icon, text}` ("Starts tomorrow" / "Running · ends Mon 15 Dec" / "Ended Mon 15 Dec" / "Stopped Thu 20 Nov"); `weekOf(run, today): 1..4`.
- `outletSuits(channel, outlet: {online: boolean}): boolean` (rule in Global Constraints); `outletChoices({promotion, outlets: {id, name, online}[], runs: Run[], today, access: {role, readOnly, outletId}}): {id, name, can: boolean, ticked: boolean, reason: string|null}[]` — reasons verbatim: `Already running "10% off on Tuesdays" (NETS QR) until Mon 15 Dec`, `Online only`, `Not an online outlet`; outlet managers get only their outlet.
- `startable({promotion, outlets, runs, today, access}): {can: boolean, note: string|null}` — notes "Already running a NETS QR promotion at 2 of your 3 outlets", "NETS QR already has a promotion running until Mon 15 Dec", "Not offered for your payment types".
- `datesFor(today): {startsOn, endsOn}` (tomorrow, +27 days); `startLabel(n): string` ("Start promotion" when the picker is hidden, "Start at 1 outlet", "Start at 2 outlets").
- `compareResults({promoDays: {day, cents}[], baseDays: {day, cents}[], ranDays: number}): {avgCents, changePct: number|null, label: string, tone: 'ok'|'mute'|'bad'}` — `ranDays < 7` or no base sales → `{changePct:null, label:'Too short to compare', tone:'mute'}`; |change| ≤ 2 → "About the same"; else "+14%" / "−5%" (Unicode minus).
- `pageSentence({running: number, last: {shortName, changePct}|null}): {text (with "{figure}"), figure}` — spec variants.
- `canTakeUp(access)` = `canRespond` re-exported; `viewOnlyNote(access)`: "You can look but not start promotions. The owner or outlet manager does that." / head office "… The franchisee does that."
- Offers: `offerStatus(takeup, today)`, `offerOutletChoices({offer, outlets, takeups, today, access})` (reason "Already active until Sat 28 Feb"), `offerSentence(...)`, `offersFor(category)`.

- [ ] **Step 1:** Unit tests with the exact strings above, including Review Focus 4 and 5 (one-outlet business, no online outlet, stopped after 3 days, zero baseline).
- [ ] **Step 2:** FAIL. **Step 3:** implement (dates via `lib/dates.js`, `formatDay` from `lib/transactions/format.js`, money via `lib/money.js`). **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(promotions): rules for status, outlets, results and wording`.

### Task 4: Data functions

**Files:**
- Create: `lib/data/promotions.js`, `lib/data/offers.js`
- Modify: `lib/data/outlets.js` (`listOutlets` also returns `online: boolean`)
- Test: `tests/integration/promotions.test.js`, `tests/integration/offers.test.js`, `tests/integration/isolation.test.js` (CASES)

**Interfaces (produces):**
- `listPromotionRuns(merchantId, {outletId = null} = {}): Promise<Run[]>`; `Run = {id, key, channel, startsOn, endsOn, stoppedOn, outletIds: string[], outletNames: string[]}`; with `outletId`, only runs that include it.
- `startPromotion(merchantId, {key, channel, outletIds, userId, today}): Promise<{ok:true, runId} | {ok:false, reason:'busy', outletId} | {ok:false, reason:'bad_outlet'}>` — one transaction: check every outlet id belongs to the merchant; `SELECT … FOR UPDATE` the merchant's runs of that channel that are not finished (`stopped_on IS NULL AND ends_on >= today`) and overlap the outlets; insert run (`starts_on` tomorrow, `ends_on` +27, `created_at = UTC_TIMESTAMP(3)`) and its outlets.
- `stopPromotion(merchantId, runId, {userId, today, outletId = null}): Promise<{ok:true, deleted: boolean} | {ok:false, reason:'not_found'|'already_finished'|'not_yours'}>` — scheduled → delete; running → `stopped_on = today`, `stopped_by`; with `outletId` (outlet manager) only when the run's outlets are exactly that outlet.
- `getPromotionSales(merchantId, {channel, outletIds, from, to, days, hours = null}): Promise<{day, cents}[]>` — successful payments only, SGT days, filtered by weekday (and hour range).
- `listOfferTakeups(merchantId, {outletId})`, `takeUpOffer(merchantId, {key, months, outletIds, userId, today})` (refuses an outlet with the same offer still active: `{ok:false, reason:'busy'}`).

- [ ] **Step 1: Failing tests:** scoping and isolation for each function; `startPromotion` refuses an overlapping outlet and accepts a different payment type; **two concurrent `startPromotion` calls for the same outlet and channel → exactly one ok** (Review Focus 1, `Promise.all`); foreign/unknown outlet id → `bad_outlet`, nothing written (Review Focus 2); `stopPromotion` deletes a scheduled run and frees the channel (Review Focus 3), sets `stopped_on` for a running one, refuses an outlet manager on a multi-outlet run; `getPromotionSales` honours days and hours; `listOutlets` returns `online`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(promotions): merchant-scoped data functions`.

### Task 5: Seed

**Files:**
- Modify: `scripts/seed.mjs` (insert `outlets.is_online`; 2 finished promotion runs from `data.pastPromotions` (with outlets); 1 running run per business started 6 days before the seed day on a payment type its outlets suit — Tan & Sons: `qr_tuesday` at Tampines Mall only (so its picker shows a busy outlet, an unsuitable one and a free one); others: `qr_tuesday` at all their physical outlets — and 1 offer take-up `qr_fee_cut` (3 months from 10 days before the seed day) at all outlets; `started_by`/`taken_by` = first owner or null)
- Test: `tests/unit/seed-demos.test.js` (add: Tan & Sons online outlet flagged)

- [ ] **Step 1:** Extend the unit test. **Step 2:** FAIL. **Step 3:** implement. **Step 4:** `npm run seed` (LOCAL only, never `.env.azure`) prints promotion/offer counts; `npm test`, `npm run test:integration` PASS; `npx playwright test tests/e2e/recon.spec.js --project=desktop` PASS (3 October problems).
- [ ] **Step 5:** Commit `feat(seed): running and finished promotions and an offer per business`.

### Task 6: Actions, menu

**Files:**
- Create: `app/(portal)/campaigns/actions.js`, `app/(portal)/offers/actions.js`
- Modify: `lib/nav.js` (Offers `{label:'Offers', href:'/offers', built:true, icon:'tag'}`, Promotions `{label:'Promotions', sub:'Marketing campaigns', href:'/campaigns', built:true, icon:'megaphone'}`; delete `COMING_SOON.offers` and `.campaigns`)
- Test: `tests/unit/promotions-actions.test.js`, `tests/unit/offers-actions.test.js`, `tests/unit/nav.test.js`

**Interfaces (produces):** `startPromotionAction(prev, formData)`, `stopPromotionAction(prev, formData)`, `takeUpOfferAction(prev, formData)` → `{ok:true, message} | {ok:false, message}`. FormData: `key`, `outletIds` (repeated), `runId`. Messages: view-only "Only the owner or an outlet manager can do this."; busy "That outlet already has a NETS QR promotion. Pick another outlet."; none ticked "Pick at least one outlet."; started "Started. It runs until Mon 22 Dec."; stopped "Stopped. Results show below."; removed "Removed. It had not started yet."; offer "Taken up. Active until Sat 28 Feb.". Server: `requirePage`, `canTakeUp`, session user, outlet managers forced to `merchant.outletId` (any other id → bad outlet message), key must exist in the catalogue and suit the business category, outlets must suit the channel (`outletSuits`), then the data function and `revalidatePath`.

- [ ] **Step 1:** Tests with `vi.mock` (as `tests/unit/disputes-actions.test.js`): accountant refused and data function not called; outlet manager naming another outlet refused; unknown key refused; online-only promotion at a physical outlet refused; success messages. Nav: items built, no coming-soon entries.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** `npm test` PASS.
- [ ] **Step 5:** Commit `feat(promotions): take up, stop and offer actions; menu`.

### Task 7: The Promotions page

**Files:**
- Create: `app/(portal)/campaigns/page.jsx`, `components/promotions/RunningCard.jsx` (client: progress bar, inline Stop confirm), `components/promotions/PromotionCards.jsx` (client: filter chips + grid), `components/promotions/TakeUpPanel.jsx` (client: right slide-out on `components/ui/sheet.jsx`, outlet picker with Select all, `useActionState(startPromotionAction)`), `components/promotions/ResultsTable.jsx`, `lib/promotions/view.js` (pure view model)
- Test: `tests/unit/promotions-view.test.js`

Layout and copy exactly as `design/promotions.html` (option A) and the spec's "The Promotions page" and "The slide-out panel". Data: `listPromotionRuns`, `listOutlets`, `getPromotionSales` per finished run (promotion days within its effective dates; base = the same weekdays in the 28 days before `startsOn`), with `outletId` from `getSelectedOutlet` for owners (like `/disputes`) and `merchant.outletId` for outlet managers. Answer sentence via `pageSentence`. Panel: opens from Take up, closes on outside click/Esc/×, focus to its heading, outlet list hidden for one outlet or outlet managers, eligible outlets pre-ticked, start button label from `startLabel`. After start: panel closes, the run slides into Running now, `role="status"` message. View-only: no Take up / Stop, plus the note.

- [ ] **Step 1:** View-model unit tests (sentence, cards with notes, results rows). FAIL → implement → PASS.
- [ ] **Step 2:** Build the page; `npm run seed`; check as retail@ (owner, 3 outlets; the "10% off on Tuesdays" panel shows Tampines Mall busy, Online store "Not an online outlet", Bedok Mall free and ticked), hawker@ (one outlet, no picker), kopi.bedok.local (outlet manager, own outlet only), retail.accounts@ (no buttons + note) at 1280×800 and 375×812, panel open; no sideways scroll; reduced motion. Screenshots `.impeccable/review/promotions-desktop.png`, `promotions-mobile.png`, `promotions-panel-desktop.png`, `promotions-panel-mobile.png`. Re-seed locally at the end.
- [ ] **Step 3:** `npm run lint && npm test` PASS. Commit `feat(promotions): Promotions page with take up, stop and results`.

### Task 8: The Offers page

**Files:**
- Create: `app/(portal)/offers/page.jsx`, `components/offers/*` (reuse the panel/cards pattern from Task 7; share code where it is the same component, e.g. a generic `components/promotions/OutletPicker.jsx`), `lib/offers/view.js`
- Test: `tests/unit/offers-view.test.js`

Spec "The Offers page": sentence, Your offers (green "Active until …" pills), Offers for you with chips (All, Lower fees, Equipment, Partner deals), "Sample offer" tag, Take up → same slide-out with "Sample offer: NETS has not set real terms yet", outlets, "Take up at N outlets". Same viewport checks and screenshots (`offers-desktop.png`, `offers-mobile.png`, `offers-panel-mobile.png`).

- [ ] **Step 1:** View-model tests FAIL → implement → PASS. **Step 2:** build and check as Task 7. **Step 3:** lint + unit PASS; commit `feat(offers): Offers page with take up`.

### Task 9: End-to-end tests

**Files:**
- Create: `tests/e2e/promotions.spec.js`
- Modify: `tests/e2e/helpers.js` (`resetPromotions(email)`: as admin, delete runs created after seeding for that merchant (created_at after the seeded ones — or by `promotion_key` not in the seeded set) and offer take-ups other than the seeded one; call in `beforeEach`)

Tests (desktop and iPhone 13): **TC-PRO-01** owner (retail@) takes up "10% off weekends with Cards" via the panel with Select all → appears in Running now with "Starts tomorrow"; **TC-PRO-02** retail@ opens "10% off on Tuesdays": Tampines Mall is disabled with `Already running "10% off on Tuesdays" (NETS QR) until …`, Online store with "Not an online outlet", Bedok Mall is ticked; clicking outside closes the panel and nothing starts; **TC-PRO-03** Stop with confirm moves a run to Results / removes a scheduled one; **TC-PRO-04** outlet manager (kopi.bedok.local) sees only Bedok and no outlet list; **TC-PRO-05** accountant sees no Take up/Stop and the note; **TC-OFF-01** owner takes up an offer → "Active until …"; **TC-PRO-06** (iPhone only) no sideways scroll with the panel open. TC-REC-01 unchanged.

- [ ] **Step 1:** Write. **Step 2:** `npm run seed && npm run test:e2e` → all PASS. **Step 3:** Commit `test(e2e): promotions and offers journeys`.

### Task 10: Docs

**Files:**
- Create: `docs/features/offers-promotions.md` (what it does, who can act, the outlet and payment-type rules, how results are estimated, sample offers, demo data, simplifications, assumptions to confirm with NETS: 4-week length, how NETS shows promotions to customers, offer terms)
- Modify: `docs/03-feature-catalogue.md`, `docs/02-technical-design.md` (tables, actions), `docs/04-documentation-and-test-plan.md` (TC-PRO-01..06, TC-OFF-01, counts from real runs), `docs/demo-script.md` (step after Refunds & disputes, ~45 s: Tan & Sons owner opens Promotions, takes up weekend Cards for 2 outlets, points at results), `docs/backlog.md`, `README.md`, `CLAUDE.md` (pending PR line; IzakiXD credit in "Working with Dylan" and "Conventions")
- [ ] **Step 1:** Run `node "C:/Users/DylanT/.claude/plugins/cache/impeccable/impeccable/4.1.3/skills/impeccable/scripts/detect.mjs" --json "app/(portal)/campaigns" "app/(portal)/offers" components/promotions components/offers`, fix mechanical findings only.
- [ ] **Step 2:** Write the docs; run `npm run lint`, `npm test`, `npm run test:integration`, `npm run seed` + `npm run test:e2e`; record counts.
- [ ] **Step 3:** Commit `docs: Offers & Promotions feature page, test plan, demo script`.

(The Impeccable finish review, whole-branch review, PR and the Azure migration question are the controller's.)
