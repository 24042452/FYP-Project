# NETS Merchant Portal (Enhanced) — Project Plan

| | |
|---|---|
| Version | 0.1 (draft for team review) |
| Date | 2026-11-11 |
| Team | 4 members |
| Next milestone | Touchpoint 1 — MVP demo to NETS & RP (~2026-11-25, 2 weeks from today) |
| Hosting | Vercel (Next.js web app: React front end, Node.js back end and REST API) + hosted **MySQL 8** database (see [ADR-001](adr/001-mysql-database.md)) |

> Related docs: [02 Technical Design](02-technical-design.md) · [03 Feature Catalogue](03-feature-catalogue.md) · [04 Documentation & Test Plan](04-documentation-and-test-plan.md)

---

## 1. Why we are building this

Today most NETS merchants open the portal **once a month to check an invoice**. Payment fees are similar everywhere, so competitors now win merchants with the software around the payment. NETS wants the portal to change from a billing chore into a tool merchants **want** to open.

Our three goals come straight from the brief:

| NETS goal | Portal layer | What the merchant gets |
|---|---|---|
| Help merchants understand & grow their business | **Insights layer** | One dashboard for every NETS channel, plain-English summaries, trends and comparisons |
| Improve merchant workflow | **Operations layer** | Auto-reconciliation, exportable reports, settlement tracking, alerts |
| Increase engagement | **Assistant layer** | AI copilot, self-service help, nudges that bring them back |

On top of the brief, the portal includes business modules: offers, marketing campaigns, lending, service requests, terminal management, business structure (tax & accounting), refunds & disputes, finance reporting, invoices & charges, partner integrations (e.g. SAP) and a data analytics studio.

### Design principle: "simple enough for a hawker uncle"

Many users are **not tech-savvy**. Every screen must pass this test:

1. **Plain words, not jargon.** Say "Money coming to you" instead of "Pending settlement", and show the technical term in small text underneath.
2. **One main action per screen**, as a big obvious button.
3. **Answer first, details after.** Each page opens with a one-sentence summary ("You made $4,210 this week, up 12%"), then charts, then tables.
4. **Mobile-first.** Many owners will use a phone at the stall.
5. **Large text and high contrast** (WCAG 2.1 AA), with no meaning carried by colour alone.
6. **Help is always one tap away.** A "Ask NETS Assistant" button sits on every page.
7. **Guided first login.** A 3-step tour, plus an empty-state message on each page that explains what will appear there.

---

## 2. Methodology

**Agile Scrum with 1-week sprints, combined with User-Centred Design (UCD).**

Why this fits:
- The **3 industry touchpoints** (initial engagement → mentoring check-in → company visit) work as natural sprint reviews with the real stakeholder, NETS.
- With a fixed 2-week MVP deadline, scope has to be managed tightly, and Scrum's prioritised backlog does that.
- UCD makes the "non-tech-savvy" requirement testable: we run quick usability tests with 3–5 non-technical people (family members, hawkers) at the end of each phase.

| Scrum element | How we run it (4-person team) |
|---|---|
| Product Owner | Rotating team member who speaks for NETS' brief; NETS mentor is the external stakeholder |
| Scrum Master | One member (also handles docs/test), keeps board & ceremonies on track |
| Sprint length | 1 week (MVP = Sprint 1 + Sprint 2) |
| Sprint planning | Monday, 30 min |
| Daily stand-up | 10 min async (WhatsApp/Discord message: done / doing / blocked) |
| Sprint review | Friday, demo the deployed Vercel URL |
| Retrospective | Friday, 15 min (keep / stop / try) |
| Backlog & board | GitHub Projects (Kanban: Backlog → To do → In progress → Review → Done) |
| Definition of Done | Code reviewed by 1 teammate · deployed to Vercel preview · works on mobile width · test case written · docs page updated |
| Prioritisation | MoSCoW (Must / Should / Could / Won't-this-phase) |

Version control: GitHub, with a `main` branch (production) and short-lived feature branches merged through Pull Requests. Each PR gets an automatic Vercel preview link.

---

## 3. Phases

> Assumption: the project runs about 14 weeks in total. Adjust the later phase dates once the RP schedule is confirmed. **Phase 0 (MVP) is fixed at 2 weeks.**

### Phase 0 — MVP (Weeks 1–2) → Touchpoint 1 demo

**Goal:** a deployed, clickable portal that runs on realistic synthetic data and shows all three layers working end-to-end. Later modules show in the menu as "Coming soon" preview pages, so NETS can see the full vision.

| # | MVP feature | Layer | MoSCoW |
|---|---|---|---|
| 1 | Login (our own email + password login, sessions stored in MySQL) with 2 demo merchants (a hawker stall and a retail chain) | Platform | Must |
| 2 | Synthetic data generator: 6 months of transactions across NETS QR / Click / eNETS / Cards / SGQR, plus settlements, invoices, failures and deliberate mismatches | Platform | Must |
| 3 | **Home dashboard**: today / week / month KPIs, revenue trend, channel mix, peak hours heatmap, this-month-vs-last comparison | Insights | Must |
| 4 | **Plain-language summary card** ("How business is going"), template-based so it is always reliable | Insights | Must |
| 5 | **Transactions** list with search, filter (date, channel, status) and a detail drawer showing the failure reason in plain words | Insights | Must |
| 6 | **Settlements**: paid / pending / expected date timeline | Operations | Must |
| 7 | **Invoices & merchant charges**: list, view breakdown, download PDF, "Pay now" (mock) | Operations | Must |
| 8 | **Reconciliation v1**: one-click match of transactions → settlements → invoice, with a list of flagged mismatches, delays and failures | Operations | Must |
| 9 | **Export** reconciliation & transactions to Excel (.xlsx) and PDF | Operations | Must |
| 10 | **NETS Assistant (copilot) v1**: chat that answers questions about the merchant's own data through safe, pre-defined query tools, plus answers from ~20 FAQ entries | Assistant | Must |
| 11 | **Notifications bell** with rule-based nudges ("Sales up 12% this week", "Invoice ready", "2 payments failed") | Assistant | Should |
| 12 | Navigation shell with all modules; unbuilt ones show a polished "Coming soon" preview | Platform | Should |
| 13 | Mobile-responsive layout | Platform | Must |

**MVP API groundwork:** the internal data access goes through `/lib` service functions that P1's `/api/v1` routes will reuse, so the public API is a thin layer added later rather than a rewrite.

**Explicitly NOT in MVP:** public API keys/webhooks (P1), real SAP/Xero integrations, real payments, lending, campaigns, terminal management, disputes workflow, configurable alerts UI, multi-language.

#### MVP 2-week schedule & team split

| Member | Role | Week 1 | Week 2 |
|---|---|---|---|
| **A** | Frontend lead / UI | App shell, nav, design system (from chosen design), login page, dashboard layout | Dashboard charts, transactions page, settlements, mobile polish |
| **B** | Data & backend | Local MySQL setup, schema migrations, login + sessions, data layer with merchant-isolation tests, synthetic data generator, seed both demo merchants | Reconciliation engine, dashboard aggregate SQL queries, invoices data, hosted MySQL for the deployed demo |
| **C** | AI & assistant | Copilot API route, query tools (sales by period, busiest day, failed payment lookup, settlement status), FAQ content + full-text search | Chat UI, summary card text, notifications rules, prompt tuning & guardrails |
| **D** | Reports, QA, PM & docs | GitHub repo/board, CI, Vercel setup, invoice PDF template | Excel/PDF exports, test plan + test cases, user-guide draft, demo script & slides |

**Scope decisions (2026-11-11):** two demo merchants (hawker stall + 3-outlet retailer); login offers both email/password and one-click demo buttons (demo mode only); the assistant ships in no-AI "rules" mode first, with AI/RAG mode switched on when an API key is available.

**If the team falls behind, cut in this order:** (1) notifications bell → (2) PDF version of the reconciliation export (Excel stays) → (3) "Coming soon" pages, replaced by greyed-out "Soon" menu items → (4) assistant AI mode (rules mode stays).

Day 10 = **feature freeze**. Days 11–12 = bug fixes, rehearse the demo, keep a backup demo video.

---

### Phase 1 — Operations depth (Weeks 3–5)
- Reconciliation v2: automatic nightly run (Vercel Cron), tolerance rules, mark-as-resolved workflow, audit trail
- **Configurable alerts**: failed transactions, settlement delay, unusual sales dip (threshold or % drop), delivered in-app and by email
- **Refunds & chargeback disputes**: raise a refund, respond to a chargeback, upload evidence, status tracker
- **Finance reporting**: monthly P&L-style sales report, fee report, GST-ready summary, scheduled email reports
- Accounting-format exports (Xero / QuickBooks / SAP-compatible CSV column layouts)
- Roles: Owner / Manager / Cashier / Accountant (read-only), with permissions
- **Public REST API v1** (`/api/v1`, OpenAPI docs at `/developers`), merchant **API keys** with scopes, **outbound webhooks** (signed, with retries); see Technical Design §7

### Phase 2 — Assistant & engagement (Weeks 6–8) → Touchpoint 2 (mentoring check-in)
- Copilot v2: multi-turn memory, charts inside answers, "explain this chart" button on every widget, suggested questions
- RAG self-service support over NETS merchant documentation (with page citations)
- Proactive nudges engine: weekly digest, milestone celebrations, "you're quieter than usual on Tuesdays" insights
- **Offers page** (NETS offers & promotions matched to merchant type)
- **Marketing campaigns**: create a simple promo (e.g. "10% off on Tuesdays via NETS QR"), then track uplift
- Usability test round 2 with non-technical users

### Phase 3 — Business modules (Weeks 9–11) → Touchpoint 3 (company visit)
- **Partner integrations hub**: connect SAP, Xero, QuickBooks, Shopify; status, last-sync and field mapping (mock connectors plus one real sandbox if feasible); **OAuth 2.0 client-credentials** for partner apps calling our API
- **Business structure**: entities, outlets, UEN, GST registration, tax & accounting settings, bank accounts
- **Terminal management**: list terminals per outlet, status (online/offline), request replacement or paper roll
- **Services & change requests**: request tracking (change bank account, add outlet, new terminal) with a status timeline
- **Merchant lending**: eligibility estimate based on sales history, application form, status (mock decisioning)
- **Data Analytics Studio**: customisable dashboards, repeat-customer analysis, cohort view, recommendations

### Phase 4 — Stretch, hardening & handover (Weeks 12–14)
- Stretch: **cash-flow forecasting**, **anomaly / fraud alerts**, **maker-checker approval flow** for outgoing actions (refunds, bank changes, loan applications)
- Performance, accessibility audit (axe), security review (merchant-isolation tests, SQL injection check), full test run
- Final report, technical documentation, user guide, presentation

---

## 4. Milestones

| Week | Milestone | Deliverable shown |
|---|---|---|
| 2 | **Touchpoint 1: Initial engagement** | MVP on Vercel: dashboard, recon + export, invoices, copilot v1 |
| 5 | Internal review | Operations layer complete |
| 8 | **Touchpoint 2: Mentoring check-in** | Copilot v2, RAG support, offers, campaigns, usability results |
| 11 | **Touchpoint 3: Company visit** | Full portal including business modules |
| 14 | Final submission | Report, technical docs, user guide, test plan, presentation |

## 5. Key risks

| Risk | Mitigation |
|---|---|
| NETS sandbox data arrives late or not at all | We build our own synthetic data generator first, shaped like real NETS data, and swap in the real data later through an import script |
| AI gives wrong numbers | The copilot never invents numbers: it can only call pre-defined, tested query tools, and its answers show the figure and the date range used |
| 2-week MVP is too tight | Strict MoSCoW and a Day-10 freeze; "Should" items get dropped first |
| Scope creep from the module list | Later modules live as "Coming soon" pages until their phase |
| Leaking one merchant's data to another | All SQL in one data layer; every query filters by the merchant id from the server session; an automated isolation test for every data function (MySQL has no row-level security, see ADR-001) |
| Free-tier limits (hosted MySQL/Vercel) | Keep the data volume moderate (~50k transactions per merchant); check the MySQL host's limits and whether it sleeps when idle, and open the demo before presenting |
