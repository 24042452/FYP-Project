# Reports

## What it is for
Files to download for the merchant or their accountant: payments as Excel, and the check-up as Excel or PDF.

## Where it lives
- Page: `/reports` (`app/(portal)/reports/page.jsx`): one row per full month since May 2026
- Download route: `app/api/export/[kind]/route.js` (`recon` and `transactions`)
- Builders: `lib/export/xlsx.js` (ExcelJS), `lib/export/pdf.jsx` (@react-pdf/renderer)

## Data used
`listTransactionsForExport` (`lib/data/transactions.js`), `loadReconExport` (`lib/recon/run.js`), `listLatestRunIds` (`lib/data/recon.js`).

## Rules and edge cases
- `GET /api/export/transactions?from=&to=&format=xlsx`: dates must be valid, `from <= to`, at most 93 days, and at most 50,000 rows. File name `payments-<from>-to-<to>.xlsx`.
- `GET /api/export/recon?run=<id>&format=xlsx|pdf`: file name `check-up-YYYY-MM.xlsx` or `.pdf`. A run that is not the signed-in merchant's gives 404.
- A month without a check-up shows "Run a check-up first" instead of the check-up links.
- Responses are `Cache-Control: private, no-store`. The merchant always comes from the session.
- The check-up Excel has Summary, Exceptions and Settlements sheets (which may list the failed payments that the page collapses).

## Tests
- Unit: `tests/unit/recon-export.test.js`
- Integration: `tests/integration/transactions.test.js` (export query)
- End-to-end: `tests/e2e/recon.spec.js` (TC-EXP-01, 01b: the downloaded file name ends in `.xlsx`)
