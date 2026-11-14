# Sales & payments (Transactions)

## What it is for
A searchable list of every payment, from all NETS payment types (NETS QR, cards, SGQR, NETS Click, eNETS). Tap a payment to see the detail, and for a failed one, a plain-words reason and what to do.

## Where it lives
- Page: `/transactions` (`app/(portal)/transactions/page.jsx`, `actions.js`)
- Params: `lib/transactions/params.js` (`parseTxnParams`), formatting: `lib/transactions/format.js`
- Failure reasons: `lib/failure-codes.js`
- Components: `components/transactions/` (filters, table, detail drawer)
- Excel download: `/api/export/transactions` (see [reports](reports.md))

## Data used
`listTransactions`, `getTransaction`, `listTransactionsForExport` (`lib/data/transactions.js`).

## Rules and edge cases
- Filters in the address: `from`, `to`, `channel`, `status` (success, failed, refunded), `q`, `cursor`, `id`. Anything invalid is ignored and the default used (last 7 Singapore days), so unchecked text never reaches SQL.
- Dates are Singapore days (`to` inclusive); times are stored in UTC and shown in Singapore time.
- Paging is by cursor, 50 per page (max 100). An unreadable cursor means the first page.
- `?id=` opens one payment. The lookup is `WHERE merchant_id = ? AND id = ?`, so another merchant's payment id shows "We couldn't find that payment" and leaks nothing.
- Search text is escaped for `LIKE` (`likeEscape`).
- Failed payments show a failure code explained in plain words.
- Excel export is capped at 93 days and 50,000 rows.

## Tests
- Unit: `tests/unit/txn-params.test.js`, `txn-format.test.js`
- Integration: `tests/integration/transactions.test.js`, `isolation.test.js`
- End-to-end: `tests/e2e/auth.spec.js` (TC-AUTH-02), `dashboard.spec.js` (TC-MOB-01)
