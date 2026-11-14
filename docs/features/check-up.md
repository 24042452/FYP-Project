# Check-up (Reconciliation)

## What it is for
Compares a month's payments with the money NETS paid into the bank and with the NETS bill, and lists what does not match, so a merchant (or their accountant) sees problems early.

## Where it lives
- Page: `/reconciliation` (`app/(portal)/reconciliation/page.jsx`), `?month=YYYY-MM`. Actions: `actions.js` ("Run check-up" / "Check again", "Mark as sorted")
- Engine: `lib/recon/reconcile.js` (`reconcile`, pure), `lib/recon/run.js` (load, run, save), `lib/recon/view.js` (page model)
- Components: `components/recon/`
- Downloads: `/api/export/recon?run=<id>&format=xlsx|pdf`

## Data used
`getReconTransactions`, `saveReconRun`, `getReconRun`, `getLatestRunForMonth`, `listLatestRunIds`, `markExceptionSorted`, `getLatestRunSummary` (`lib/data/recon.js`), plus settlements and invoice lines.

## Rules and edge cases
- Exception types: amount mismatch, missing settlement, settlement delay, fee mismatch, failed payment.
- **Tolerance:** a difference of more than 1 cent is a mismatch (`TOLERANCE_CENTS = 1`); 1 cent of rounding is ignored.
- **Failed payments are collapsed:** they are not money problems, so they appear as ONE summary row ("45 payments didn't go through") with a link to Sales & payments, not as 45 cards. "N need a look" counts money problems only.
- "Checked" = settlements + one fee comparison per billed payment type + days with payments but no settlement; the page shows "X of Y matched".
- The late rule is the shared `isSettlementLate`.
- Each run is saved; the newest run for a month is shown. Months must be between May 2026 and the current month; default is the last full month.
- "Mark as sorted" stores an optional note (500 characters max) and moves the item to "Sorted".
- Seeded October 2026 has exactly 3 money problems for the demo.

## Progress bar
- Running the check-up shows a progress bar, the current step in plain words and "About N seconds left". The form uses `useActionState`: `runReconciliation` returns `{ok, runId, month, durationMs}` (or a friendly message for a bad month). The bar is an estimate: it eases to 90% (using the last run's real server time from `localStorage` `checkupDurationMs`, 6 seconds by default), and goes to 100% only when the answer is back and the panel has shown for 2.5 seconds; then "Done ✓" for about 0.6 s and the result opens. The results card says "Checked in N seconds" only for runs started in this tab (`sessionStorage` key `checkup:<runId>`). Maths in `lib/recon/progress.js`, UI in `components/recon/RunProgress.jsx`.

## Tests
- Unit: `tests/unit/reconcile.test.js`, `recon-export.test.js`
- Integration: `tests/integration/recon.test.js`, `isolation.test.js`
- Unit: `tests/unit/recon-progress.test.js`; end-to-end: `tests/e2e/ui-polish.spec.js` (TC-REC-02)
- End-to-end: `tests/e2e/recon.spec.js` (TC-REC-01, TC-EXP-01)
