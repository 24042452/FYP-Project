# Bills & charges (Invoices)

## What it is for
Lists the monthly invoices NETS sends the merchant, with each charge line, and lets them download a PDF copy.

## Where it lives
- Page: `/invoices` (`app/(portal)/invoices/page.jsx`), `?open=<invoice id>` opens one
- PDF: `GET /invoices/<id>/pdf` (`app/(portal)/invoices/[id]/pdf/route.js`), built by `lib/export/pdf.jsx`
- Model: `lib/invoices/model.js` (`buildInvoicesModel`, `invoiceStatusView`, `invoiceFilename`)
- Components: `components/invoices/` (`PayNowButton`)

## Data used
`listInvoices`, `getInvoiceWithLines`, `listInvoiceLines`, `getInvoiceLinesForMonth` (`lib/data/invoices.js`).

## Rules and edge cases
- Status words: **To pay**, **Overdue** (red), **Paid**. Only unpaid or overdue invoices show "Pay now".
- "Pay now" opens a dialog saying payments are not live in the prototype. No money moves.
- Lines with a quantity above 1 show "qty × unit price". MDR (merchant discount rate) lines carry the payment type in `invoice_lines.channel`; the check-up uses this to compare fees.
- PDF file name: `invoice-YYYY-MM.pdf`. The PDF lookup uses the session merchant, so another merchant's invoice id gives "not found".
- Amounts are integer cents.

## Tests
- Unit: `tests/unit/invoices-model.test.js`, `invoice-pdf.test.js`
- Integration: `tests/integration/invoices.test.js`, `isolation.test.js`
- Test plan: TC-INV-01 (see `docs/04-documentation-and-test-plan.md`)
