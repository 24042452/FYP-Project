# Feature Catalogue

Every portal module, the phase it is built in, and what it does in plain words.
**P0 = MVP (2 weeks)**, P1–P4 = later phases (see [Project Plan](01-project-plan.md)).

## A. Modules you asked for

| Module | Phase | What the merchant can do |
|---|---|---|
| **Home dashboard** | P0 | See today's, this week's and this month's sales across all NETS channels in one view, with a "how business is going" summary |
| **Transactions** | P0 | Search and filter every payment; tap one to see why it failed |
| **Settlements** | P0 | See what's been paid into the bank, what's pending, and when to expect it |
| **Invoices & merchant charges** | P0 | See each monthly invoice and its charge breakdown, download the PDF, pay (mock) |
| **Reconciliation** | P0 → P1 | One click checks transactions against settlements and the invoice, then lists anything that doesn't match |
| **Finance reporting** | P0 (export) → P1 | Download Excel/PDF reports laid out for an accountant; monthly sales, fees, GST summary; scheduled emails |
| **NETS Assistant (AI copilot)** | P0 → P2 | Ask "How much did I take last week?" or "Why did this payment fail?", and get help-centre answers with sources |
| **Notifications & alerts** | P0 (basic) → P1 | Nudges ("Sales up 12%"), plus configurable alerts for failed payments, settlement delays and sales dips |
| **Refunds & chargeback disputes** | P1 (built, see [features/refunds-disputes.md](features/refunds-disputes.md)) | See refunds, accept or decline chargebacks with proof (up to 3 files), track status. Issuing a refund from the portal is later |
| **Offers (by NETS)** | P2 | Personalised NETS offers to grow the business (e.g. reduced MDR promo, new QR standee, partner deals) |
| **Marketing campaigns** | P2 | Create simple promos, choose dates and channels, see the uplift afterwards |
| **Partner integrations** | P3 | Connect SAP, Xero, QuickBooks, Shopify; see sync status and map fields |
| **Business structure** | P3 | Manage company details, outlets, UEN, GST/tax settings, accounting settings, bank accounts |
| **Terminal management** | P3 | See every terminal and its status; request a replacement, repair or supplies |
| **Services & change requests** | P3 | Raise and track requests (change bank, add outlet, new terminal) on a status timeline |
| **Merchant lending** | P3 | See an indicative loan offer based on sales history, apply, track status |
| **Data Analytics Studio** | P3 | Build your own dashboards, repeat-customer and cohort analysis, recommendations |
| **Developers / Open API** | P1 → P3 | Create API keys, read API docs, subscribe webhooks (e.g. "tell my system when a settlement is paid"), view delivery logs; partners connect via OAuth |
| **Settings & users** | P1 | Invite staff with roles (Owner, Manager, Cashier, Accountant); profile, language, notification preferences |

## B. Brief stretch goals (P4)
- **Cash-flow forecasting**: "You'll likely receive ~$12,400 in the next 7 days"
- **Anomaly / fraud alerts**: unusual refund spikes, odd-hour high-value transactions, sudden channel drops
- **Maker-checker approvals**: refunds, bank changes and loan applications need a second person to approve

## C. Extra ideas to make it stand out (recommended)

Ranked by value-for-effort. ★ = strongly recommended.

| Idea | Why it helps | Effort |
|---|---|---|
| ★ **Business Health Score (0–100)** on the home page | One number non-tech users instantly understand, built from growth, failed-payment rate and settlement status | Low |
| ★ **Peer benchmarking** | "Your Tuesday sales are 18% below similar F&B stalls in Tampines" (anonymised aggregate) is a big reason to come back | Medium |
| ★ **Multi-language: English, 中文, Bahasa Melayu, தமிழ்** | Matches Singapore's merchant base; huge accessibility win | Medium |
| ★ **Weekly WhatsApp / Telegram / email digest** | Brings insight to merchants without a login, driving engagement | Medium |
| ★ **"Explain this" button on every chart** | The AI explains the chart in one sentence | Low (once the copilot exists) |
| **Installable mobile app (PWA)** | Home-screen icon and push notifications on phones | Low |
| **Voice questions to the assistant** | Easier for older users than typing | Low–Medium |
| **Accountant share link** | Owner gives the accountant read-only access to reports | Low |
| **Calendar-aware insights** | "Expect a busier week: Hari Raya on Monday", using SG public holidays and school holidays | Low |
| **Goals & milestones** | Owner sets a monthly target, with a progress bar and a celebration when it's hit | Low |
| **Onboarding checklist** | "3 of 5 done: connect accounting, set an alert…" | Low |
| **Multi-outlet comparison** | Chains compare outlets side by side | Low (data already supports it) |
| **GST helper** | Pre-filled figures for the quarterly GST F5 return | Medium |
| **Dark mode & large-text mode** | Accessibility | Low |
| **Audit log viewer** | Owners see who exported data or issued refunds | Low |
| **Feedback widget** | "Was this helpful?" on assistant answers, giving evidence for the report | Low |

Recommended picks to add to the plan: Health Score (P0 if time allows, otherwise P1), "Explain this" (P2), Multi-language (P2), Peer benchmarking (P3), PWA plus weekly digest (P2).
