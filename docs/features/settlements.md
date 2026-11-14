# Money to my bank (Settlements)

## What it is for
Shows what NETS has paid, or will pay, into the merchant's bank account, day by day, and flags money that is late.

## Where it lives
- Page: `/settlements` (`app/(portal)/settlements/page.jsx`), `?month=YYYY-MM`, `?status=paid|on_the_way|late`
- Model: `lib/settlements/model.js` (`parseMonth`, `parseSettlementStatus`, page model, pure)
- Late rule: `lib/settlements/status.js` (`isSettlementLate`)

## Data used
`listSettlements`, `getSettlementTotals`, `getSettlementSummary`, `getRecentSettlements` (`lib/data/settlements.js`).

## Rules and edge cases
- **Late rule (one place only):** a settlement is late if its status is `delayed`, or it is `pending` and its expected date is before today (Singapore). Pending with no expected date, or due today or later, is not late. Home, the check-up and the alerts use the same function.
- Status words: Paid, On its way, Late.
- An invalid or future `month` falls back to the current month; an invalid `status` means no filter.
- Gross, fee and net are integer cents per settlement.
- A settlement belongs to one payment type and one business day.

## Tests
- Unit: `tests/unit/settlements-model.test.js`
- Integration: `tests/integration/settlements.test.js`, `isolation.test.js`
