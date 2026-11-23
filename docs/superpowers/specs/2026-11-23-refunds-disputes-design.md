# Refunds & disputes: design

- **Date:** 2026-11-23
- **Owner:** Deron Kwok Yu Hng (commits authored as GitHub `igiveupman`, `220815669+igiveupman@users.noreply.github.com`; merged with a merge commit)
- **Status:** approved by the user 2026-11-23
- **Layout chosen:** option A, "each dispute as a case" (mockup `design/refunds.html`; the three options as shown: `.impeccable/mocks/decision/refunds-{a,b,c}-board.png`)

## Why

Refunds & disputes is a Phase 1 module in the project plan ("raise a refund, respond to a chargeback, upload evidence, status tracker") and is now Deron's area. Today the menu shows it greyed out as "Soon". Chargebacks are money a merchant can lose without noticing; NETS wants a portal that saves merchants work and that they open often. This page lets a merchant **see their refunds and disputes, and respond to chargebacks**, in plain words, before the deadline.

## Goals

1. One page, `/disputes`, replacing the "Soon" item: **Refunds & disputes** (technical term underneath: *Chargebacks*).
2. See refunds: when, how much, which payment, why, and which payout it came out of.
3. See disputes (chargebacks): open ones first with money at stake, the customer's reason, and days left to answer; then ones waiting for NETS; then closed ones (won, lost, accepted).
4. Respond to an open dispute:
   - **Accept** (white button, blue outline and text): confirm, then the dispute closes as "Accepted, money returned to the customer".
   - **Decline** (solid red button): a form inside the case: why you disagree (one choice), what proof you have (ticks), a note, and up to 3 photos/PDFs (2 MB each; phone camera works). Sending it moves the dispute to "Waiting for NETS".
5. Owners and outlet managers can respond; accountants and franchise head office can only look.
6. Demo data for every demo business, with one open dispute to answer live.

## Non-goals

- Starting a refund from the portal (refunds are done at the terminal or by NETS; this page only shows them).
- Partial refunds (every refund is for the whole payment).
- Any real NETS call or real money. The decision ("won"/"lost") for answered disputes comes only from seed data.
- Vercel Blob or any other file service (files live in MySQL, see Approaches).
- Changes to the assistant, alerts, the bell, or Home.
- Maker-checker approval (Phase 4).

## Anti-goals (would make it a failure even if it works)

- A merchant seeing or answering another merchant's dispute, or an outlet manager seeing another outlet's.
- A view-only user (accountant, head office) being able to accept or decline, even by sending the form by hand.
- Buttons whose meaning is not clear at one look; colour alone carrying the meaning.
- A page that looks different from the rest of the portal.

## Constraints

- Next.js 15 App Router, plain JavaScript, Tailwind, MySQL 8 via `mysql2` prepared statements, `.sql` migrations (ADR-001). No ORM.
- **Merchant isolation:** every query in `lib/data/` filters by the merchant id from the server session; each new data function gets an isolation test.
- Keys named after their table (`dispute_id`, ...; ADR-002). Money in integer cents. Times stored UTC, shown in Singapore time.
- Design: DESIGN.md (Clean Console). Plain words first, technical term underneath. Status = icon + word + colour. 44px touch targets. Works at 375px. Animations switch off with reduced motion.
- The school's shared Azure MySQL server: keep stored files small.

## Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Answer with a form; files stored in our MySQL (`MEDIUMBLOB`), 3 files max, 2 MB each, JPG/PNG/PDF | Realistic, works on phones, no new service, fully testable. Small files in the shared database, kept in check by the limits. |
| B | Same form; files in Vercel Blob | Closest to the long-term plan, but needs a Blob store and secret on Vercel and every PC, and tests must fake storage. Extra risk before a demo for no visible difference. |
| C | Answer without files | Quickest, but "upload evidence" is in the plan and is what NETS expects. |

Layout: three rendered options were shown (case cards with a 3-step track; one mixed list with a detail panel; the open dispute first in a big panel). The user picked **case cards** (option A).

## What the user decided

- See refunds and disputes, and respond to chargebacks.
- Files in MySQL (approach A).
- Button words: **Accept** and **Decline**. Decline is solid red; Accept is white with a blue outline (Claude's call within "blue or white").
- Owners and outlet managers can respond; accountant and head office view only.
- Use Impeccable for the design and keep it like the rest of the portal; layout option A.

## The page (option A)

Top to bottom, same frame as other pages (sidebar, top bar, phone tab bar):

1. **Title:** "Refunds & disputes", subtitle "Chargebacks · money customers asked for back".
2. **Answer sentence** (answer style, key figure in blue), chosen by state:
   - Open dispute(s): "1 dispute needs your answer by Mon 30 Nov. **$46.50** is at stake." (plural form for more than one; earliest deadline named.)
   - None open, some waiting: "Nothing to answer. **$18.20** is waiting for NETS to decide."
   - Nothing open or waiting: "Nothing to answer. You had **3 refunds** ($31.60) this month."
   - View-only users get a second line: "You can look but not answer. The owner answers disputes." (head office: "The franchisee answers disputes.")
3. **Summary strip** (one panel, three parts): Needs your answer (count, red when > 0, with the earliest deadline and days left) · Waiting for NETS (amount, count) · Refunds this month (amount, count).
4. **Disputes panel** ("Disputes" / *Chargebacks*):
   - Each open or waiting dispute is a **case**: red alert tile (open) or blue clock tile (waiting); heading = the customer's reason in plain words + amount + status pill ("Answer by Mon 30 Nov" red, or "Waiting for NETS" blue); meta line = payment type, paid date/time, TID, STAN; a **3-step track** (Customer disputed → Your answer → NETS decides; done steps blue, the current step a red ring while it is the merchant's turn, a blue ring while waiting for NETS); a blue "what this means" box (open cases only), e.g. "We found only one payment of $46.50 that day, so declining may win this. If you lose, $46.50 is taken back from a future payout." The hint is worked out from the data, as described under "Hints"; and the buttons **Decline**, **Accept and refund $46.50**, and a quiet link "See the payment" (opens `/transactions` with that payment selected).
   - **Decline** hides the buttons and opens the form inside the case (slide/expand animation, off under reduced motion). **Cancel** closes it.
   - **Accept** asks for confirmation inline ("Accept and refund $46.50 to the customer? You can't undo this." with **Yes, accept** (blue outline) and **Cancel**), then saves.
   - Closed disputes: a compact list under the cases (reason · amount, payment type · month · what you did), with a pill: "Won, money kept" (green, tick), "Lost, money refunded" (red), "Accepted, refunded" (grey). Show the latest 10; "Show all" if more.
   - Waiting and closed cases that were declined show "N files sent" with links to open each file.
   - Empty state: "No disputes. When a customer's bank asks for money back, it shows here with what to do."
5. **Refunds panel:** table (Refunded on, Bought on, Paid with, Reason, Amount, Payout) with a pill "Taken from payout Mon 23 Nov" (green when that payout is paid; blue "Next payout" when not yet). Rows link to the payment. Last 3 months, newest first; "Download Excel" uses the existing export pattern (`/api/export/refunds`). Empty state: "No refunds in the last 3 months."
6. **Phones:** strip stacks, track becomes vertical, buttons full width, form fields full width; nothing scrolls sideways at 375px.

### The Decline form

- **Why do you disagree?** (one, required): reasons depend on the dispute reason:
  - "Charged twice" → "The customer paid only once. I can show the one payment."
  - "Not received" → "The customer got their food or goods."
  - "Doesn't recognise the payment" → "The customer made this payment."
  - "Wrong amount" → "The amount charged was right."
  - Always also: "Something else" (then the note is required).
- **What proof do you have?** (ticks, at least one): Receipt or order slip · Terminal printout · Photo of the order · Messages with the customer.
- **Anything else NETS should know?** (note, up to 500 characters; required only with "Something else").
- **Add photos or PDFs:** up to 3 files, each at most 2 MB and 4 MB together (Vercel refuses requests over about 4.5 MB), JPG, PNG or PDF. Photos are shrunk in the browser before sending (longest side 1600 px, JPEG), so a phone photo normally ends up well under 1 MB (checked by the file's first bytes, not only the name). `accept="image/jpeg,image/png,application/pdf"` and `capture` friendly so a phone can take a photo. Shows file name and size, with Remove.
- **Send my answer to NETS** (red, the form's main action) and **Cancel**.
- Errors in plain words next to the field ("Choose why you disagree.", "That file is 3.4 MB. Files can be up to 2 MB.", "Only photos (JPG, PNG) or PDFs.", "You can add up to 3 files."). The form keeps what was typed after an error.
- After sending: the case moves to "Waiting for NETS" with the track advanced and a short confirmation line ("Sent to NETS on Mon 23 Nov. NETS usually decides within 30 days.").

### Hints ("what this means")

Worked out per open dispute from the merchant's own data, plain sentence, never a promise:
- Charged twice: count payments of the same amount by the same card type on that day at that terminal; one → "We found only one payment of $X that day, so declining may win this."; two or more → "We found 2 payments of $X that day. If one was a mistake, accepting may be right."
- Other reasons: a general line ("Photos of the receipt or the order help NETS decide.").
- Always: "If you lose, $X is taken back from a future payout."

## Who can do what

| Login | Sees | Can respond |
|---|---|---|
| Owner (merchant or franchisee) | Whole business | Yes |
| Outlet manager | Only their outlet's refunds and disputes | Yes, for their outlet |
| Accountant, manager, cashier | Whole business | No (Claude's call: the user named owners and outlet managers only) |
| Franchise head office | The franchisee it is looking at | No |

- Rule: may respond when `role` is `owner` or `outlet_manager` and the access is not read-only. Enforced on the server in the respond actions (not only by hiding buttons). View-only users see the page without buttons, plus the one-line note.
- `/disputes` is added to the pages an outlet manager may open (it follows their outlet, like Home and Sales & payments).

## Money effects (Claude's calls after the builder check)

- **Refunds (user's choice, option B):** in the demo a refund happens **1 to 14 days after the purchase** (a common shop policy, not a NETS or legal rule). The original payment was already paid out on its own day, so its status becomes `refunded` but it still counts in that day's payout. The refund is **taken from the payout of the refund day, same payment type**: `settlements` gets a `refund_cents` column and `net_cents = gross_cents - fee_cents - refund_cents`. The pill reads "Taken from payout Mon 23 Nov" (green when that payout is paid, blue "Next payout" when not yet). Only refunds dated on or before the seed day exist.
- **Disputes** change no stored money in the demo. The wording is honest about that: "If you lose, $X is taken back from a future payout." (not "held").
- **Accept, lost or missed** close the dispute only. The payment keeps `status = 'success'` and gets no `refunds` row; a chargeback is not a refund. The Refunds panel lists refunds only; lost and accepted disputes show in the Disputes panel. Sales totals do not change (stated in the feature doc as a known simplification).
- **Check-up:** a payout's expected amount becomes (successful **and refunded** payments of that day and type) minus their fees minus the refunds taken that day. Without this change every payout with a refund would be flagged as short. The October check-up must still show exactly 3 problems (TC-REC-01). The "refund or chargeback" step in the fix guide stays.
- **Money to my bank (Settlements):** each payout shows "Refunds −$12.80" when it has any, in its detail and in the totals.
- Sales totals on Home and Insights count successful payments only, so a refunded payment drops out of the sales of its original day. That is correct (a refunded sale is not a sale) and is noted in the feature doc.

## Data model (new migration `0009_refunds_disputes.sql`)

- `refunds`: `refund_id` PK, `merchant_id`, `transaction_id` (unique; one refund per payment), `amount_cents`, `reason` (enum: `wrong_order`, `charged_twice`, `sold_out`, `customer_changed_mind`, `other`), `refunded_at` (1 to 14 days after the payment), `settlement_id` (the payout it was taken from: same merchant and payment type, the refund's business day). The refunded transaction gets `status = 'refunded'` (existing value), so Sales & payments already shows it.
- `settlements`: new column `refund_cents` (default 0); `net_cents` already stored, now gross minus fee minus refunds.
- `disputes`: `dispute_id` PK, `merchant_id`, `transaction_id`, `amount_cents`, `reason` (enum: `charged_twice`, `not_received`, `not_recognised`, `wrong_amount`), `opened_at`, `respond_by` (date), `status` (enum: `open`, `accepted`, `declined`, `won`, `lost`), `answered_at`, `answered_by` (user id), `decline_reason`, `evidence` (JSON array of ticked items), `note` (≤500), `decided_at`, `decide_by` (date NETS is expected to decide).
  - "Waiting for NETS" = `declined`. An `open` dispute past `respond_by` shows as "Missed, money refunded" (worked out on read, like invoice status; no job needed).
- `dispute_files`: `dispute_file_id` PK, `dispute_id`, `merchant_id`, `file_name`, `mime_type`, `size_bytes`, `data MEDIUMBLOB`, `uploaded_at`. At most 3 per dispute, enforced in code.
- Composite foreign keys include `merchant_id` (same pattern as `recon_exceptions`), so a row can never point at another merchant's payment.
- Outlet filtering joins the payment and uses `transactions.outlet_id` (same as Sales & payments).

## Code layout (follows existing patterns)

- `lib/data/disputes.js` and `lib/data/refunds.js`: list and summary functions taking `merchantId` (and optional `outletId`); `answerDispute(merchantId, disputeId, ...)` that only updates an `open` dispute of that merchant inside a transaction (status check in the `WHERE`, so a double submit cannot answer twice).
- `lib/disputes/`: pure logic: labels, the answer sentence, hints, deadline wording, form validation (Zod), file checks (size, count, magic bytes). Unit-tested.
- `app/(portal)/disputes/page.jsx` (server) + `components/disputes/*` (client parts: case, track, decline form, accept confirm).
- `app/(portal)/disputes/actions.js`: server actions `acceptDispute`, `declineDispute` (FormData with files), using `requirePage('/disputes')`, refusing view-only users, then `revalidatePath`.
- `app/(portal)/disputes/files/[id]/route.js`: serves one evidence file to its own merchant (content-type from the stored MIME, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`).
- `app/api/v1/disputes/route.js` and `app/api/v1/refunds/route.js`: read-only JSON, same auth and paging as `/api/v1/transactions`.
- Check-up and payouts: `lib/data/recon.js` (`getReconTransactions` also returns refunded payments' gross and fees, plus refunds taken per day and type) and `lib/recon/reconcile.js` (expected = gross − fees − refunds); `lib/data/settlements.js` and the Money to my bank page show `refund_cents`.
- Login: `app/login/LoginForm.jsx` Tan & Sons button sub-label "Owner"; seed adds `retail.accounts@demo.local` (accountant).
- `lib/nav.js`: the item becomes built, with sub "Chargebacks"; remove its `COMING_SOON` entry. `lib/access/rules.js`: outlet managers may open `/disputes`.
- Next.js server action body limit raised to 4.5 MB (`experimental.serverActions.bodySizeLimit`); the 4 MB total is checked in the browser and again on the server.

## Demo data

In `lib/synthetic/generate.js` (deterministic), for every demo business, relative to the seed day:
- About 3 to 5 refunds a month, on successful NETS QR, card and NETS Click payments, full amount, mixed reasons, 1 to 14 days after the purchase, each taken from the payout of the refund day (same payment type). Refunds never land on the payouts used by the 3 seeded October check-up problems, so TC-REC-01 still sees exactly 3.
- Disputes only on Cards, NETS Click and eNETS payments: per business, 1 open (opened 3 days before the seed day, answer within 10 days), 1 declined and waiting for NETS, 1 won, 1 lost or accepted. Ah Hock's open one is "charged twice" with a single matching payment, so the hint reads "declining may win this".
- No bell alerts for disputes in this build: `notifications` has no outlet column, so an outlet manager would see other outlets' disputes. (Later: add `outlet_id` to notifications.)
- Seeded "sent" files are tiny generated placeholder images/PDFs.

## Testing

- **Unit:** answer sentence, hints, deadline wording, status (incl. missed deadline), form validation, file checks (size, count, type by magic bytes), role rule.
- **Integration (MySQL):** check-up expected amounts with refunds (a payout with a refund is not flagged); settlements show refunds; list/summary per merchant; isolation (merchant A never sees or answers B's dispute; outlet manager sees only their outlet); answering twice fails; view-only cannot answer; file count limit; refunds tied to payouts; October check-up still 3 problems.
- **End-to-end (Playwright, desktop and phone):** owner declines with a file and sees "Waiting for NETS"; owner accepts with confirmation; accountant/head office see no buttons; page has no sideways scroll at 375px.
- Docs: `docs/features/refunds-disputes.md`, feature catalogue, technical design (API rows), test plan rows, demo script step, Word technical document mention later (separate PR).

## Left to the builder

- Exact copy of seed reasons and amounts; exact animation timings (use existing easing and durations).
- Whether the Accept confirmation is an inline row or the same expand pattern as the form (inline preferred).
- Pagination of closed disputes if a business has many (demo data has few).

## Answered by the user (2026-11-23)

- The "Try as Tan & Sons" button is relabelled **Owner** (it already signs in as an owner), so Tan & Sons can answer disputes in the demo. A separate Tan & Sons accountant login (`retail.accounts@demo.local`, role `accountant`, no button, same demo password) shows and tests view-only. Head office (Kopi Corner HQ) also shows view-only.
- Refunds follow the 14-day shop practice and come out of later payouts (option B above).
