# Refunds & disputes (Chargebacks)

## What it is for
Shows a merchant the money they gave back to customers (refunds) and the cases where a customer's bank asked for money back (chargebacks, called "disputes" here). Each dispute is a case: what happened, the amount, the deadline, and what to do. The owner can accept it or decline it with proof. Layout option A (each dispute a case with a 3-step track), picked 23 Nov 2026. Built by Deron Kwok Yu Hng.

## Where it lives
- Page: `/disputes` ("Refunds & disputes", sub-label "Chargebacks"), `app/(portal)/disputes/page.jsx`; server actions in `app/(portal)/disputes/actions.js`; evidence downloads in `app/(portal)/disputes/files`
- Components: `components/disputes/` (`DisputeCase`, `Track`, `DeclineForm`, `AcceptConfirm`, `FileLinks`, `ClosedList`, `RefundsTable`, `shrink-image.js`)
- Data: `lib/data/disputes.js`, `lib/data/refunds.js` (every query filters by the session merchant)

## How a dispute is answered
- Each open dispute shows a 3-step track (Raised, Waiting for NETS, Decided), the reason in plain words, a hint on what proof helps, and the deadline.
- **Accept** (white button, blue outline): asks "Are you sure?", then gives the money back to the customer.
- **Decline** (solid red button): opens an inline form. Write why, and add up to 3 files as proof. After sending, the case moves to "Waiting for NETS".
- **Evidence files:** JPG, PNG or PDF, up to 2 MB each and 4 MB in total. Photos are shrunk in the browser to 1600 px JPEG before they are sent, so a phone photo usually fits.
- A file that is too big or the wrong type is refused with a plain sentence and nothing is sent.
- If the deadline passes with no answer, the case shows "Missed, money refunded".
- Sending twice (double click, second tab) is refused: only the first answer counts.

## Who can do what
- **Owners and outlet managers** can respond. An outlet manager sees only the disputes of their outlet.
- **Accountant, manager, cashier and head office** can look only. There are no buttons, and a short note says why. This is enforced on the server too, not just hidden in the page.
- Head office sees the chosen franchisee's cases, view only.

## Money
- A refund happens 1 to 14 days after the purchase. This is a common shop practice, not a NETS rule.
- A refund is taken from the payout of the day it was given: `settlements.refund_cents`, and net = gross - fee - refunds.
- The check-up counts successful and refunded payments when it works out a payout's expected gross, so refunds do not show as false problems.
- "Money to my bank" shows a line "Refunds -$X". Each outlet's payout share does the same.

## Known simplifications
- A chargeback does not change the stored money or the sales totals. Only the case and its status change.
- No bell alerts for disputes yet: notifications have no `outlet_id`, so an outlet manager could not be shown only their own (see `docs/backlog.md`).

## Data model
Migration `0009`: `refunds`, `disputes`, `dispute_files` (file bytes in a MEDIUMBLOB), and `settlements.refund_cents`. Seed adds about 3 to 5 refunds a month and 4 disputes per business (open, waiting, won, accepted), plus a Tan & Sons accountant login `retail.accounts@demo.local` (no demo button). The Tan & Sons "Try as" button now says Owner. Re-seeding resets every dispute.

## API
Read-only, portal-session sign-in, snake_case fields:
- `GET /api/v1/disputes` and `GET /api/v1/refunds`
- Paging by page number: `?page=N`, answer `{data, page, page_size: 50, has_more}`
- Outlet scope: `?outlet=`
- Refunds Excel: `/api/export/refunds` (last 3 months)

Answering a dispute is done by server actions, not the public API (yet).

## Tests
- Unit and integration: refunds and disputes data functions, merchant isolation, role rules, API responses, the Excel workbook, the check-up with refunds
- End-to-end `tests/e2e/disputes.spec.js`: TC-DSP-01 decline with proof and a photo; TC-DSP-02 accept; TC-DSP-03 accountant looks only; TC-DSP-04 file over 2 MB refused; TC-DSP-05 no sideways scroll on a phone
