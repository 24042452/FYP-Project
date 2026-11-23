# Refunds & disputes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/disputes` ("Refunds & disputes"): merchants see refunds and chargebacks, and owners/outlet managers accept or decline chargebacks with evidence files; refunds come out of later payouts and the check-up accounts for them.

**Architecture:** New tables (`refunds`, `disputes`, `dispute_files`, `settlements.refund_cents`) filled by the deterministic generator; pure rules in `lib/disputes/`; merchant-scoped queries in `lib/data/disputes.js` and `lib/data/refunds.js`; a server-rendered page with small client components and two server actions; read-only `/api/v1` endpoints. Layout = mockup `design/refunds.html` (option A).

**Tech Stack:** Next.js 15 App Router (plain JS), Tailwind, MySQL 8 via `mysql2` (prepared statements, `.sql` migrations), Zod, Vitest, Playwright (Edge).

**Spec:** `docs/superpowers/specs/2026-11-23-refunds-disputes-design.md`

## Global Constraints

- Every commit: `git -c user.name=igiveupman -c user.email=220815669+igiveupman@users.noreply.github.com commit ...`. No `Co-Authored-By`, no "Generated with" lines. Branch `feat/refunds-disputes`; PR from Dylan's `gh` login; Dylan merges with a **merge commit**.
- Every `lib/data/` function takes `merchantId` (from the session) and filters by it; outlet managers also by `outletId` via `transactions.outlet_id`. One isolation test per new data function.
- Keys named after the table (`refund_id`, `dispute_id`, `dispute_file_id`). Money integer cents. Times stored UTC, shown Asia/Singapore.
- Copy (verbatim): page title "Refunds & disputes", subtitle "Chargebacks · money customers asked for back"; buttons "Decline" (solid red), "Accept and refund $X" (white, blue outline + blue text), "See the payment"; form button "Send my answer to NETS"; pills "Answer by Mon 30 Nov", "Waiting for NETS", "Won, money kept", "Lost, money refunded", "Accepted, refunded", "Missed, money refunded", "Taken from payout Mon 23 Nov", "Next payout".
- Respond rule: `role ∈ {'owner','outlet_manager'}` and `!readOnly`. Checked on the server.
- Files: at most 3, each ≤ 2 MB (2 097 152 bytes), together ≤ 4 MB (4 194 304 bytes), JPEG/PNG/PDF by first bytes; photos shrunk in the browser (longest side 1600 px, JPEG quality 0.82) before sending. Note ≤ 500 characters.
- Design: DESIGN.md tokens only (Clean Console). Status = icon + word + colour. Touch targets ≥ 44px. No sideways scroll at 375px. Animations use the existing easing (`cubic-bezier(0.16,1,0.3,1)`) and switch off under reduced motion (`components/dashboard/use-reduced-motion.js`).
- The October 2026 check-up of every demo business with anomalies still shows exactly 3 problems (TC-REC-01).

## Review Focus

1. **Double submit / two tabs:** answering an already-answered dispute must fail with "This dispute was already answered." and change nothing (pinned in Task 6).
2. **Deadline passed while the page was open:** declining after `respond_by` must be refused ("The time to answer has passed.") and the dispute shows "Missed, money refunded" (Tasks 5 and 6).
3. **Forged form from a view-only user or another merchant's id:** server refuses; no row changes (Tasks 6 and 7).
4. **A file renamed to `.jpg` that is not an image, or 3 × 1.9 MB PDFs (5.7 MB total):** refused with the plain message, typed fields kept (Task 5 unit, Task 7 action).
5. **A payout with a refund taken out of it:** check-up does not flag it, Money to my bank shows "Refunds −$X", net = gross − fees − refunds (Tasks 2 and 3).

---

### Task 1: Database tables

**Files:**
- Create: `db/migrations/0009_refunds_disputes.sql`
- Modify: `tests/integration/helpers.js` (TABLES: add `'dispute_files', 'disputes', 'refunds'` before `'transactions'`)
- Modify: `tests/integration/schema.test.js`
- Modify: `db/export/SOI-2026-0021-sherwin.sql` (regenerate: `node scripts/export-schema.mjs SOI-2026-0021-sherwin`)

**Interfaces:**
- Produces: tables below; enums are the contract for every later task.

```sql
ALTER TABLE settlements ADD COLUMN refund_cents BIGINT NOT NULL DEFAULT 0 AFTER fee_cents;

CREATE TABLE refunds (
  refund_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, transaction_id CHAR(36) NOT NULL,
  amount_cents BIGINT NOT NULL,
  reason ENUM('wrong_order','charged_twice','sold_out','changed_mind','other') NOT NULL,
  refunded_at DATETIME(3) NOT NULL, settlement_id CHAR(36) NULL,
  PRIMARY KEY (refund_id), UNIQUE KEY uq_refunds_txn (transaction_id),
  KEY idx_refunds_merchant (merchant_id, refunded_at),
  CONSTRAINT fk_refunds_txn FOREIGN KEY (transaction_id, merchant_id) REFERENCES transactions (transaction_id, merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_refunds_settlement FOREIGN KEY (settlement_id) REFERENCES settlements (settlement_id) ON DELETE SET NULL
);
CREATE TABLE disputes (
  dispute_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL, transaction_id CHAR(36) NOT NULL,
  amount_cents BIGINT NOT NULL,
  reason ENUM('charged_twice','not_received','not_recognised','wrong_amount') NOT NULL,
  opened_at DATETIME(3) NOT NULL, respond_by DATE NOT NULL,
  status ENUM('open','accepted','declined','won','lost') NOT NULL DEFAULT 'open',
  answered_at DATETIME(3) NULL, answered_by CHAR(36) NULL,
  decline_reason VARCHAR(40) NULL, evidence JSON NULL, note VARCHAR(500) NULL,
  decide_by DATE NULL, decided_at DATETIME(3) NULL,
  PRIMARY KEY (dispute_id), UNIQUE KEY uq_disputes_id_merchant (dispute_id, merchant_id),
  KEY idx_disputes_merchant (merchant_id, status, opened_at),
  CONSTRAINT fk_disputes_txn FOREIGN KEY (transaction_id, merchant_id) REFERENCES transactions (transaction_id, merchant_id) ON DELETE CASCADE,
  CONSTRAINT fk_disputes_user FOREIGN KEY (answered_by) REFERENCES users (user_id) ON DELETE SET NULL
);
CREATE TABLE dispute_files (
  dispute_file_id CHAR(36) NOT NULL, dispute_id CHAR(36) NOT NULL, merchant_id CHAR(36) NOT NULL,
  file_name VARCHAR(200) NOT NULL, mime_type ENUM('image/jpeg','image/png','application/pdf') NOT NULL,
  size_bytes INT NOT NULL, data MEDIUMBLOB NOT NULL, uploaded_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (dispute_file_id), KEY idx_dfiles_dispute (dispute_id, merchant_id),
  CONSTRAINT fk_dfiles_dispute FOREIGN KEY (dispute_id, merchant_id) REFERENCES disputes (dispute_id, merchant_id) ON DELETE CASCADE
);
```
(Check that `transactions` has a `(transaction_id, merchant_id)` unique key; if not, add `UNIQUE KEY uq_txn_id_merchant` in this migration, as `recon_exceptions` does for runs. Grant the app user the same rights as on other tables, as earlier migrations do.)

- [ ] **Step 1:** In `schema.test.js` add `it('has refunds, disputes and dispute_files with merchant-scoped foreign keys')`: query `information_schema.COLUMNS` and assert `settlements.refund_cents` exists with default `0`, the three tables exist, and `disputes.status` column type is `enum('open','accepted','declined','won','lost')`.
- [ ] **Step 2:** `npm run test:integration -- schema` → FAIL (tables missing).
- [ ] **Step 3:** Write the migration; update TABLES in helpers.
- [ ] **Step 4:** `npm run migrate` then `npm run test:integration` → all PASS (migrate also runs on the test DB in global setup).
- [ ] **Step 5:** Regenerate the schema export; commit `feat(db): tables for refunds, disputes and evidence files`.

### Task 2: Demo data (generator)

**Files:**
- Modify: `lib/synthetic/generate.js`, `lib/synthetic/trim.js`
- Test: `tests/unit/generate.test.js`, `tests/unit/trim.test.js`

**Interfaces:**
- Produces: `Dataset` gains
  - `settlements[].refund_cents: number` (net = gross − fee − refund)
  - `refunds: {id, transaction_id, amount_cents, reason, refunded_at (ISO), settlement_id}[]`
  - `disputes: {id, transaction_id, amount_cents, reason, opened_at (ISO), respond_by (YYYY-MM-DD), status, answered_at (ISO|null), decline_reason, evidence (string[]|null), note, decide_by (YYYY-MM-DD|null), decided_at (ISO|null), files: number}[]`
  - transactions may now have `status: 'refunded'`.

Rules (all after the existing generation, using a **second** PRNG `mulberry32(seed ^ 0x5eed)` so every existing value stays identical):
- Refunds: per calendar month, 3 to 5 successful payments (any channel), not on business days/channels `2026-10-18|card`, `2026-10-29|nets_qr` or the demo-delayed settlement. Refund day = payment SGT day + 1..14, must be `< today`; the refund's settlement is `settleMap.get(refundDay|channel)` (try up to 3 following days, else skip that payment); never one of the three excluded settlements. Set `t.status = 'refunded'` (its `settlement_id` stays its own day's payout), add `amount_cents` to the refund settlement's `refund_cents`. Reasons weighted: wrong_order 35, charged_twice 20, sold_out 20, changed_mind 15, other 10. `refunded_at` = refund day 11:00–20:00 SGT.
- Invoice MDR lines and settlement `gross/fee` count `success` **and** `refunded` payments (the payout already happened). `net_cents = gross_cents − fee_cents − refund_cents` for every settlement.
- Disputes: only on successful `card`, `nets_click` or `enets` payments not refunded, nearest to the target day (skip a dispute when none exists). Relative to `today`:
  - open: payment `today−10`, `reason 'charged_twice'`, payment amount must be unique for that day+terminal+channel (pick another candidate otherwise), `opened_at` today−3 10:00 SGT, `respond_by` = today+7.
  - declined (waiting): payment today−25, `not_recognised`, opened today−18, answered today−14, `decline_reason 'made_payment'`, `evidence ['receipt','printout']`, `decide_by` = answered+30, `files: 2`.
  - won: payment today−60, `not_received`, opened today−55, answered today−50, `evidence ['photo']`, decided today−20, `files: 1`.
  - accepted: payment today−80, `wrong_amount`, opened today−75, answered today−72, no files.
- `trimFuture`: recompute counts `success` and `refunded`, keeps `refund_cents`, net = gross − fee − refund; drops refunds/disputes whose payment was trimmed.

- [ ] **Step 1: Failing tests** in `generate.test.js`:
  - `it('keeps every existing payment the same')`: before changing the generator, record `[id, amount_cents, created_at]` of hawker (seed 1001, start 2026-05-01, today 2026-11-23) payments 0, 1000 and the last one; assert they are unchanged afterwards.
  - `it('refunds 3 to 5 payments a month, 1 to 14 days later, from the payout of the refund day')`: for each refund, `1 <= days(refunded_at − payment) <= 14`, refunded payment `status === 'refunded'`, refund settlement has same channel and `business_date === sgtDate(refunded_at)`.
  - `it('net is gross minus fees minus refunds')`: every settlement.
  - `it('never puts a refund on the October check-up anomalies')`.
  - `it('makes one open, one waiting, one won and one accepted dispute on card, NETS Click or eNETS')` with `respond_by === addDays(today, 7)` for the open one and its amount unique for that day+terminal+channel.
  - `trim.test.js`: `it('keeps refund_cents when recomputing a trimmed payout')`.
- [ ] **Step 2:** `npm test -- generate trim` → FAIL.
- [ ] **Step 3:** Implement as above.
- [ ] **Step 4:** `npm test` → all PASS (fix any existing test that assumed only success/failed; do not change expected anomaly values).
- [ ] **Step 5:** Commit `feat(data): demo refunds within 14 days and disputes`.

### Task 3: Payouts and check-up count refunds

**Files:**
- Modify: `lib/data/recon.js` (`getReconTransactions`: `status IN ('success','refunded')` for gross and fees)
- Modify: `lib/data/settlements.js` (`listSettlements`, `getRecentSettlements`: also return `refundCents`)
- Modify: `lib/settlements/model.js`, `app/(portal)/settlements/page.jsx` (show "Refunds −$X" on a payout row/detail when `refundCents > 0`)
- Test: `tests/integration/recon.test.js`, `tests/integration/settlements.test.js`, `tests/unit/settlements-model.test.js`

**Interfaces:**
- Produces: `SettlementRow.refundCents: number`; model row field `refundsLabel: string | null` ("Refunds −$12.80").

- [ ] **Step 1: Failing tests:**
  - recon integration `it('does not flag a payout whose payment was refunded later')`: payment A $20 success-then-`refunded` on day D, settlement D gross 2000; `getReconTransactions` day D grossCents === 2000; running `reconcile` gives no `amount_mismatch`.
  - settlements integration `it('returns refundCents and net = gross − fee − refunds')`.
  - settlements-model unit `it('labels a payout with refunds')` → `refundsLabel === 'Refunds −$12.80'`; null when 0.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement; page shows the label in the payout row's secondary line (13px `text-ink-3`) and keeps totals on `net_cents`.
- [ ] **Step 4:** `npm test && npm run test:integration` → PASS.
- [ ] **Step 5:** Commit `feat(settlements): refunds taken from payouts; check-up counts refunded payments`.

### Task 4: Seed, logins and the Tan & Sons label

**Files:**
- Modify: `scripts/seed.mjs` (insert `settlements.refund_cents`, `refunds`, `disputes` with `answered_by` = the business's first owner (or null), `dispute_files` placeholder rows; add user `{ userId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', email: 'retail.accounts@demo.local', name: 'Ms Chen', role: 'accountant' }` to Tan & Sons)
- Modify: `app/login/LoginForm.jsx:12` sub → `'3 outlets incl. online shop · Owner'`
- Modify: `tests/unit/login-form.test.jsx` if it asserts "Accountant"
- Test: `tests/integration/demo-login.test.js`

Placeholder file bytes: 1×1 PNG `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=` (base64), names `receipt-1.png`, `receipt-2.png`, `mime 'image/png'`.

- [ ] **Step 1:** Unit test `tests/unit/seed-demos.test.js` `it('Tan & Sons has an owner and a view-only accountant')`: export `DEMOS` from `scripts/seed.mjs` (run `main()` only when the file is executed directly: `if (import.meta.url === pathToFileURL(process.argv[1]).href)`) and assert the two Tan & Sons roles. Login-form unit: the Tan & Sons sub text contains "Owner".
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm run seed` prints counts including refunds/disputes; `npm test && npm run test:integration` PASS. Manually: `SELECT status, COUNT(*) FROM disputes GROUP BY status` shows open/declined/won/accepted for each business with card/Click/eNETS sales.
- [ ] **Step 5:** Commit `feat(seed): refunds, disputes, evidence placeholders and a Tan & Sons accountant login`.

### Task 5: Dispute rules (pure)

**Files:**
- Create: `lib/disputes/rules.js`, `lib/disputes/files.js`
- Test: `tests/unit/disputes-rules.test.js`, `tests/unit/disputes-files.test.js`

**Interfaces (produces):**
- `REASON_TEXT: Record<Reason, string>`: `charged_twice` "Customer says they were charged twice", `not_received` "Customer says they didn't get their food or goods", `not_recognised` "Customer doesn't recognise this payment", `wrong_amount` "Customer says they were charged the wrong amount".
- `REASON_SHORT: Record<Reason, string>`: "Charged twice", "Not received", "Doesn't recognise the payment", "Charged the wrong amount".
- `REFUND_REASON_TEXT`: wrong_order "Wrong order", charged_twice "Charged twice", sold_out "Item sold out", changed_mind "Customer changed their mind", other "Other".
- `EVIDENCE: {value: 'receipt'|'printout'|'photo'|'messages', label}[]` (labels per spec).
- `declineReasons(reason): {value, label}[]`: charged_twice → `paid_once` "The customer paid only once. I can show the one payment."; not_received → `received` "The customer got their food or goods."; not_recognised → `made_payment` "The customer made this payment."; wrong_amount → `right_amount` "The amount charged was right."; always last `something_else` "Something else".
- `effectiveStatus(d: {status, respondBy}, today: string): 'open'|'missed'|'waiting'|'won'|'lost'|'accepted'` (`open` and `respondBy < today` → `missed`; `declined` → `waiting`).
- `daysLeft(respondBy, today): number` (calendar days, `respondBy − today`).
- `statusPill(d, today): {tone: 'bad'|'info'|'ok'|'mute', icon: 'clock'|'tick'|'alert'|'refund', text}` (open → bad "Answer by Mon 30 Nov"; waiting → info "Waiting for NETS"; won → ok "Won, money kept"; lost → bad "Lost, money refunded"; accepted → mute "Accepted, refunded"; missed → bad "Missed, money refunded").
- `trackSteps(d, today): {label, sub, state: 'done'|'now'|'wait'|'todo'}[]` (3 steps: "Customer disputed" + date; "Your answer" + "7 days left" / "You declined" + date and "N files sent" / "You accepted"; "NETS decides" + "About 30 days after" / "By Wed 9 Dec" / outcome date).
- `hint(d, sameAmountCount: number): string` (spec "Hints", ending "If you lose, $X is taken back from a future payout.").
- `pageSentence({openCount, earliestRespondBy, openCents, waitingCount, waitingCents, refundsMonthCount, refundsMonthCents}, today): {text: string, figure: string}` (three spec variants; `figure` is the blue amount).
- `canRespond(access: {role, readOnly}): boolean`.
- `viewOnlyNote(access): string | null` ("You can look but not answer. The owner answers disputes." / head office: "You can look but not answer. The franchisee answers disputes.").
- `parseDecline(formData-like object): {ok: true, value: {declineReason, evidence: string[], note: string|null}} | {ok: false, errors: Record<'declineReason'|'evidence'|'note', string>}` (Zod; messages "Choose why you disagree.", "Tick at least one kind of proof.", "Tell NETS what happened (up to 500 characters)." when `something_else` and empty, "Keep the note under 500 characters.").
- `files.js`: `MAX_FILES = 3`, `MAX_FILE_BYTES = 2_097_152`, `MAX_TOTAL_BYTES = 4_194_304`, `sniffMime(head: Uint8Array): 'image/jpeg'|'image/png'|'application/pdf'|null` (FF D8 FF / 89 50 4E 47 / 25 50 44 46), `checkFiles(files: {name, size, head}[]): {ok: true, mimes: string[]} | {ok: false, message}` with messages "You can add up to 3 files.", "That file is 3.4 MB. Files can be up to 2 MB." (one decimal), "Your files add up to 5.7 MB. Together they can be up to 4 MB.", "Only photos (JPG, PNG) or PDFs.".

- [ ] **Step 1:** Unit tests for each export with the exact strings above, including: `effectiveStatus({status:'open', respondBy:'2026-11-22'}, '2026-11-23') === 'missed'`; `daysLeft('2026-11-30','2026-11-23') === 7`; `canRespond({role:'accountant', readOnly:false}) === false`, `({role:'outlet_manager', readOnly:false}) === true`, `({role:'hq_owner', readOnly:true}) === false`; `sniffMime` rejects a text file named `.jpg`; three 1.9 MB files → total message.
- [ ] **Step 2:** `npm test -- disputes` → FAIL.
- [ ] **Step 3:** Implement (dates via `lib/dates.js`, money via `lib/money.js` `formatSGD`).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(disputes): rules for statuses, wording, permissions and file checks`.

### Task 6: Data functions

**Files:**
- Create: `lib/data/disputes.js`, `lib/data/refunds.js`
- Test: `tests/integration/disputes.test.js`, `tests/integration/isolation.test.js` (add CASES)

**Interfaces (produces):**
- `listDisputes(merchantId, {outletId = null} = {}): Promise<DisputeRow[]>` — newest `opened_at` first; `DisputeRow = {id, transactionId, amountCents, reason, status, openedAt, respondBy, answeredAt, declineReason, evidence: string[], note, decideBy, decidedAt, channel, paidAt, tid, stan, outletId, sameAmountCount, files: {id, name, sizeBytes}[]}`; `sameAmountCount` = successful/refunded payments of this merchant with same amount, channel, terminal and SGT day.
- `answerDispute(merchantId, disputeId, {action: 'accept'|'decline', userId, outletId = null, today, declineReason?, evidence?, note?, files?: {name, mime, bytes: Buffer}[]}): Promise<{ok: true} | {ok: false, reason: 'not_found'|'already_answered'|'too_late'}>` — one DB transaction: `UPDATE disputes d JOIN transactions t ... SET status = 'accepted'|'declined', answered_at = NOW(3), answered_by, decline_reason, evidence, note, decide_by = DATE_ADD(today, 30 days) (decline only) WHERE d.merchant_id = ? AND d.dispute_id = ? AND d.status = 'open' AND d.respond_by >= ? [AND t.outlet_id = ?]`; on 0 rows read the row to pick the reason; insert files only after a successful update.
- `getDisputeFile(merchantId, fileId, {outletId = null} = {}): Promise<{name, mime, data: Buffer} | null>`.
- `listRefunds(merchantId, {from, to, outletId = null}): Promise<RefundRow[]>` — `RefundRow = {id, transactionId, amountCents, reason, refundedAt, paidAt, channel, payout: {id, businessDate, status, expectedDate, paidDate} | null}`, newest first, `from/to` SGT dates on `refunded_at`.

- [ ] **Step 1: Failing tests** (`disputes.test.js`, fixtures via `insertFixture` + `adminExecute`):
  - `it('lists only this merchant\'s disputes, newest first, with files')`
  - `it('an outlet manager sees only their outlet\'s disputes and refunds')`
  - `it('declines an open dispute once; a second answer returns already_answered')`
  - `it('refuses an answer after respond_by with too_late')`
  - `it('cannot answer another merchant\'s dispute (not_found) and writes no files')`
  - `it('counts same-amount payments for the hint')`
  - `it('lists refunds with the payout they were taken from')`
  - isolation CASES: `listDisputes`, `listRefunds`, `getDisputeFile`.
- [ ] **Step 2:** `npm run test:integration` → FAIL.
- [ ] **Step 3:** Implement with prepared statements (`query`, `withTransaction` from `lib/db.js`).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(disputes): merchant-scoped data functions`.

### Task 7: Actions, file download, access and menu

**Files:**
- Create: `app/(portal)/disputes/actions.js`, `app/(portal)/disputes/files/[id]/route.js`
- Modify: `lib/access/rules.js` (outlet managers may open `/disputes`; it is not in `MERCHANT_WIDE_PATHS`), `lib/nav.js` (item `{ label: 'Refunds & disputes', sub: 'Chargebacks', href: '/disputes', built: true, icon: 'refund' }`; delete `COMING_SOON.disputes`), `next.config.mjs` (`experimental: { serverActions: { bodySizeLimit: '4.5mb' } }`)
- Test: `tests/unit/access-rules.test.js`, `tests/unit/nav.test.js`, `tests/unit/disputes-actions.test.js` (mock `@/lib/data/merchant` and `@/lib/data/disputes` with `vi.mock`)

**Interfaces:**
- Produces: `acceptDispute(prev, formData): Promise<ActionResult>`, `declineDispute(prev, formData): Promise<ActionResult>`; `ActionResult = {ok: true, message: string} | {ok: false, message?: string, errors?: Record<string,string>, values?: {declineReason, evidence, note}}`. FormData fields: `disputeId`, `declineReason`, `evidence` (repeated), `note`, `files` (repeated `File`). Messages: view-only → "Only the owner can answer disputes."; `already_answered` → "This dispute was already answered."; `too_late` → "The time to answer has passed."; `not_found` → "We couldn't find that dispute."; success decline → "Sent to NETS on Mon 23 Nov. NETS usually decides within 30 days."; success accept → "Accepted. $46.50 goes back to the customer."
- Both actions: `requirePage('/disputes')`, `canRespond`, validate, read files (`file.arrayBuffer()`, first 8 bytes to `checkFiles`), call `answerDispute` with `userId` from the session (`getCurrentUser` / the session helper the portal already uses) and `today = sgtDate(...)`, then `revalidatePath('/disputes')`.
- File route: `GET` → `requirePage('/disputes')`, `getDisputeFile(merchant.id, params.id, {outletId: merchant.outletId})`, 404 if null; headers `Content-Type` stored mime, `Content-Disposition: inline; filename="<name>"` (strip quotes/newlines), `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.

- [ ] **Step 1: Failing tests:** access `canOpen({tier:'outlet'}, '/disputes') === true`; nav item built with sub "Chargebacks" and no `COMING_SOON.disputes`; actions: accountant → message "Only the owner can answer disputes." and `answerDispute` not called; invalid file → `{ok:false, message, values}` keeps typed note; `already_answered` mapped to its message.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** `npm test` PASS.
- [ ] **Step 5:** Commit `feat(disputes): accept and decline actions, evidence download, menu and access`.

### Task 8: The page

**Files:**
- Create: `app/(portal)/disputes/page.jsx`, `components/disputes/DisputeCase.jsx` (client), `components/disputes/Track.jsx`, `components/disputes/DeclineForm.jsx` (client), `components/disputes/AcceptConfirm.jsx` (client), `components/disputes/ClosedList.jsx`, `components/disputes/RefundsTable.jsx`, `components/disputes/shrink-image.js`
- Reuse: `components/dashboard/Pill.jsx`, `StatTile.jsx`, `Panel.jsx` (`EmptyState`), `MerchantWideNote` pattern, `use-reduced-motion.js`
- Test: `tests/unit/shrink-image.test.js` (pure size math only)

Layout and copy exactly as `design/refunds.html` and spec "The page": title/subtitle; answer sentence (`pageSentence`, figure in `text-accent-ink`); view-only note under it; summary strip (3 tiles: Needs your answer / Waiting for NETS / Refunds this month); Disputes panel: open and waiting cases (`DisputeCase`), closed list (latest 10, "Show all" toggles the rest), empty state; Refunds panel (last 3 months via `listRefunds`, "Download Excel" → `/api/export/refunds`), empty state. Data: `listDisputes` + `listRefunds` with `merchant.outletId`.

- `DisputeCase`: buttons only when `canRespond`; Decline hides the buttons and expands `DeclineForm` (height + opacity, 280ms, existing easing; instant under reduced motion), focus moves to the form heading; Waiting and closed declined cases show "N files sent" with each file linking to `/disputes/files/<id>` (opens in a new tab). Accept shows `AcceptConfirm` inline ("Accept and refund $46.50 to the customer? You can't undo this." / "Yes, accept" (blue outline) / "Cancel"). After success, the track's current step animates to the next state and a `role="status"` line shows the action's message.
- `DeclineForm`: `useActionState(declineDispute)`; radios from `declineReasons`, checkboxes from `EVIDENCE`, note textarea (`maxLength 500`, counter), file input `accept="image/jpeg,image/png,application/pdf"` (multiple, up to 3) listing name + size with Remove; images go through `shrinkImage(file): Promise<File>` (canvas, longest side 1600, `image/jpeg` 0.82; returns the original if not an image or already smaller) before being put into the FormData; client-side `checkFiles` before submit; field errors under each field (`aria-describedby`), values kept on error; submit shows "Sending…" and is disabled while pending.
- `shrink-image.js`: export `fitWithin(w, h, max = 1600): {w, h}` (pure, tested) and `shrinkImage(file)`.
- Phone (<640px): strip stacks, track vertical, buttons and form actions full width.

- [ ] **Step 1:** Unit test `fitWithin(4032, 3024) → {w:1600, h:1200}`, `fitWithin(800, 600) → {w:800, h:600}`. Run → FAIL. Implement → PASS.
- [ ] **Step 2:** Build the page and components.
- [ ] **Step 3:** `npm run seed`, `npm run dev`; check `/disputes` as hawker@ (owner), retail.accounts@ (no buttons + note), kopi.hq@ viewing East (no buttons, franchisee note), kopi.bedok.local (only Bedok rows) at 1280×800 and 375×812, including the open form; no sideways scroll; reduced motion. Screenshots to `.impeccable/review/disputes-desktop.png`, `disputes-mobile.png`.
- [ ] **Step 4:** `npm run lint && npm test` PASS.
- [ ] **Step 5:** Commit `feat(disputes): Refunds & disputes page with accept and decline`.

### Task 9: API and Excel export

**Files:**
- Modify: `lib/api/v1.js` (add `disputesResponse(merchantId, sp, today, scope)`, `refundsResponse(...)` following `transactionsResponse`: JSON `{data: [...], page, pageSize: 50, hasMore}`, outlet-scoped by `scope.outletId`, never includes file bytes or notes of other merchants), `lib/export/xlsx.js` (`buildRefundsWorkbook(rows)`: columns Refunded on, Bought on, Paid with, Reason, Amount, Payout), `app/api/export/[kind]/route.js` (kind `refunds`, last 3 months)
- Create: `app/api/v1/disputes/route.js`, `app/api/v1/refunds/route.js`
- Test: `tests/unit/api-v1.test.js`, `tests/integration/api.test.js`, `tests/unit/recon-export.test.js` pattern for the workbook

- [ ] **Step 1:** Tests: disputes response shape (`id, amountCents, reason, status (effective), respondBy, channel, paidAt`), signed-out 401, outlet scope; workbook totals equal rows.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(api): read-only disputes and refunds endpoints; refunds Excel`.

### Task 10: End-to-end tests

**Files:**
- Create: `tests/e2e/disputes.spec.js`
- Modify: `tests/e2e/helpers.js` (add `reopenOpenDispute(merchantId)`: as admin, set the seeded open dispute back to `status='open'`, clear answer fields, delete its files; call in `beforeEach`)

Tests (both projects, desktop and iPhone 13):
- `TC-DSP-01`: hawker@ opens `/disputes`, sees "1 dispute needs your answer", clicks Decline, picks "The customer paid only once…", ticks Receipt, attaches a small PNG (`setInputFiles` with buffer), sends → sees "Waiting for NETS" and "1 file sent".
- `TC-DSP-02`: retail@ clicks "Accept and refund …", confirms "Yes, accept" → "Accepted, refunded".
- `TC-DSP-03`: retail.accounts@ sees "You can look but not answer." and no Decline/Accept buttons.
- `TC-DSP-04`: a 3 MB file shows "Files can be up to 2 MB." and nothing is sent (use a non-image PDF-header buffer so it is not shrunk).
- `TC-DSP-05` (iPhone 13 only): `scrollWidth <= 390` on `/disputes` with the form open.
- `TC-REC-01` still passes unchanged.

- [ ] **Step 1:** Write the spec. **Step 2:** `npm run seed && npm run test:e2e` → new tests PASS, all old tests PASS.
- [ ] **Step 3:** Commit `test(e2e): refunds and disputes journeys`.

### Task 11: Docs, design finish and PR

**Files:**
- Create: `docs/features/refunds-disputes.md` (what it does, who can respond, money effects incl. the known simplification "chargebacks don't change sales totals", data model, API, tests)
- Modify: `docs/03-feature-catalogue.md` (status built), `docs/02-technical-design.md` (API rows `GET /api/v1/disputes`, `GET /api/v1/refunds` built; respond via server actions), `docs/04-documentation-and-test-plan.md` (TC-DSP-01..05 rows + new counts), `docs/demo-script.md` (step "Refunds & disputes: answer a chargeback", ~45 s, re-open via seed note), `docs/backlog.md` (refunds note resolved; add "dispute alerts in the bell need notifications.outlet_id"), `README.md` feature list, `CLAUDE.md` (merged list, Deron credit), `DESIGN.md` only to add the Accept button (white, blue outline) under Buttons if the documenter decides so
- [ ] **Step 1:** Impeccable finish: `node "<impeccable>/scripts/detect.mjs" --json "app/(portal)/disputes" components/disputes`; fix mechanical findings; spawn `impeccable:impeccable-finish-reviewer` with the request, the surface brief `.impeccable/surfaces/app-portal-disputes-page-jsx.md`, the screenshots, `design/refunds.html` + `.impeccable/mocks/decision/refunds-a-board.png` as critique reference, and the craft-floor path; apply its fix round (max two).
- [ ] **Step 2:** Write the docs; `npm run lint && npm test && npm run test:integration && npm run test:e2e` all PASS; record counts in the test plan.
- [ ] **Step 3:** Commit `docs: Refunds & disputes feature page, test plan, demo script`.
- [ ] **Step 4:** Whole-branch review (superpowers:requesting-code-review), fix, then `git push -u origin feat/refunds-disputes`, `gh pr create` (no Claude lines), wait for the Vercel preview and send Dylan the PR and preview links with desktop and 375px screenshots. Re-seed Azure only when Dylan asks (demo day rule).
