# CLAUDE.md — NETS Merchant Portal (FYP)

Final Year Project with industry partner **NETS** (Singapore payments): an enhanced Merchant Portal prototype. 4-person team. Read `docs/` before doing anything.

## Where we left off (update this section at the end of every session)

**Last updated:** 2026-11-23 (all NETS mock-meeting feedback done and merged; Insights page built and merged, PRs #12-#14)
**Current phase: MVP LIVE, polishing and preparing the Touchpoint 1 demo.** The MVP is built, reviewed, merged into `main` and deployed.
**Next deadline:** Touchpoint 1 MVP demo to NETS & RP, about 2026-11-25.
**Start next session with:** read "Next steps" and "Working with Dylan" below, then `git checkout main && git pull`. On a new computer, do "Setting up on another computer" first.

Where things are:
- **Live site:** https://fyp-project-taupe.vercel.app (Vercel Hobby, deploys from `main`; every PR gets a preview link, which needs a Vercel login)
- **Repo:** https://github.com/24042452/FYP-Project (moved from `Rampy2122/FYP-Project`; the old URL redirects). `main` is protected by a ruleset: changes go in through pull requests, no force pushes or deletion
- **Database (live):** the school's shared Azure MySQL 8.0 server, schema `SOI-2026-0021-sherwin` (the server shows it in lower case). Other schemas on that server belong to other people: only ever touch ours. Host and login live only in the git-ignored `.env.azure`. The schema came from `db/export/SOI-2026-0021-sherwin.sql` (`node scripts/export-schema.mjs <name>` regenerates it). Re-seed it with `node --env-file=.env.azure scripts/seed.mjs`
- **Database (local):** MySQL 8 on this PC (`nets_portal`, `nets_portal_test`); settings in git-ignored `.env.local`
- Tests: `npm test` (unit), `npm run test:integration` (MySQL `nets_portal_test`), `npm run test:e2e` (Playwright in installed Edge; builds and starts the app itself, so run `npm run seed` first). Results in `docs/04-documentation-and-test-plan.md`. CI (`.github/workflows/ci.yml`) runs lint, unit and integration on every PR
- Docs: feature pages in `docs/features/`, open small issues and ideas in `docs/backlog.md`, build plan in `docs/superpowers/plans/2026-11-11-mvp.md`, **demo script** `docs/demo-script.md`, **technical document for NETS and RP** `docs/NETS-Merchant-Portal-Technical-Document.docx` (v1.2, 32 pages, ERDs on landscape pages; edit it in Word; diagram sources in `docs/diagrams/`). Converting it on this PC: Word COM in `pwsh -ExecutionPolicy Bypass` (no pandoc or LibreOffice installed); PyMuPDF is installed for PDF page images
- Team (Programme DFT; roles from 2026-11-23): Chow Sherwin (Team Coordinator; insights and dashboards), Deron Kwok Yu Hng (refunds and disputes; data and back end), Dylan Teo Zhen Hwee (AI assistant; built the MVP), Lai Wei Jun Samuel (marketing: offers and promotions). Student IDs and phone numbers are deliberately NOT in the repo (it is public)
- Visual checks without Chrome: headless Microsoft Edge via the DevTools protocol works on this PC (Playwright e2e also uses `channel: 'msedge'`). Word is installed (export to PDF via Word COM in PowerShell). On Windows, stopping `npm run dev` leaves `next` node processes: kill node processes whose command line contains `FYP Project` and `next`; delete `.next` between `next build` and `next dev`

Merged so far (all 2026-11-15):
- PR #1: the whole MVP (tasks 1-14a plus the final-review fixes)
- PR #2: schema export for the school Azure database
- PR #3: working outlet menu (Home and Sales & payments follow the chosen outlet, with each outlet's share of NETS payouts, animations and a "Now showing" message), red "Log out" button with words, check-up progress bar
- PR #4: docs housekeeping (README, project notes, `docs/backlog.md`)
- PR #5: gentler business health score (start 75; labels Healthy / Okay / Needs a look) with a full-width "How we worked this out" panel
- PR #6: working search (live suggestions on desktop, full-screen search on phones, last 12 months, follows the outlet), payment drawer slides out when closed, demo script, Word technical document
- PR #8 (2026-11-22): every key named after its table (`merchant_id`, `transaction_id`, ...; ADR-002); NETS identifiers MID (merchants), TID (terminals), STAN (transactions, replaces customer_ref)
- PR #12 (2026-11-23): check-up "How to fix this" guide on every problem (`lib/recon/guide.js`, `components/recon/FixGuide.jsx`), with Copy details for NETS (MID, date, amounts)
- PR #13 (2026-11-23): Word document Figure 4 shows the check-up with the fix guide
- PR #14 (2026-11-23): **Insights page** `/insights` (`docs/features/insights.md`): findings, sales by month, best days, busiest hours, payment mix, outlet comparison. Commits authored by teammate `sherwinhp` (see "Working with Dylan")
- PR #10 (2026-11-22): Word document v1.1 (use cases, tiered ERDs on landscape pages, token_hash, data-load limits)
- PR #11 (2026-11-23): "This week in numbers" on Home (% changes and what drove them, by payment type)
- PR #9 (2026-11-22): franchise tiers (ADR-003, `docs/features/franchise.md`): head office (group overview `/group`, view only), franchisee owner, outlet manager (locked to one outlet). Demo: Kopi Corner (East, West, North) with logins kopi.hq@, kopi.east@, kopi.bedok.local

- PR (pending): **Offers & Promotions** `/campaigns` and `/offers` (`docs/features/offers-promotions.md`): take up 4-week promotions per payment type and outlet with a slide-out, stop, estimated results; sample offers by business type. Authored as `IzakiXD` (Samuel's GitHub noreply), merge with a merge commit
- PR (pending): **Refunds & disputes** `/disputes` (`docs/features/refunds-disputes.md`): refunds in payouts and the check-up, disputes with accept/decline and evidence files, read-only API. Authored as `igiveupman` (Deron's GitHub noreply), merge with a merge commit

Waiting on the user:
- Ask the school owner to **change the Azure database password** (it was exposed once in a session log on 2026-11-15), then update `.env.azure` and `DATABASE_URL` in Vercel
- An Anthropic API key (optional; without it the assistant stays in rules mode)

Next steps:
- **Mock-meeting feedback (22 Nov): all done and merged.** Last items: check-up "How to fix this" guide (PR #12) and, beyond the feedback, the Insights page (PR #14). Still unclear from the notes: "Why is the ERD diagram Id to 7" (ask NETS at the demo). Done earlier: "This week in numbers" panel on Home (% changes + what drove them, PR #11), use cases, shorter business analysis, tiered ERD, token_hash explained, MID/TID/STAN, `<table>_id` keys, franchise tiers, data-load limits (Word doc 7.10). NETS processing fees for later: NETS 0.8 %, NETS Click 1.8-2 %, SGQR 0 %, cards up to 3.5 % (`lib/fees.js` still has synthetic rates)
1. **Before every demo: re-seed that morning, after 9 am**, locally and on Azure (`node --env-file=.env.azure scripts/seed.mjs`). Pending/late/"today" figures are set relative to the seed day and nothing refreshes them
2. Rehearse with `docs/demo-script.md` (presenter + driver), record a backup video, and prepare slides
3. Optional before the demo: a usability test kit (`docs/usability-test.md`: 5 tasks for 3-5 non-technical users) for user-centred design evidence, and the quick wins in `docs/backlog.md`
4. Optional: an Anthropic API key to try the assistant's AI mode (never run against the live API yet; quick-answers mode is the safe demo default)
5. After Touchpoint 1: Phase 1 in `docs/01-project-plan.md`

Done:
- [x] Planning docs 01-04, design (Option 1 · Clean Console) and `PRODUCT.md`
- [x] 2026-11-14/15: MVP built (tasks 1-14a), final whole-branch review and fixes, deployed to Vercel with the school Azure database
- [x] 2026-11-15: outlet menu, Log out button, check-up progress bar, health score with explanation, working search, demo script and Word technical document (PRs #1-6 merged)
- [x] 2026-11-22: mock-meeting feedback, part 1: clear key names, MID/TID/STAN, franchise tiers, Word document v1.1 (ERDs, use cases, limits)
- [x] 2026-11-23: mock-meeting feedback, part 2: "This week in numbers" on Home, check-up fix guide, new Figure 4; Insights page (PRs #11-#14)

## Working with Dylan (how the user wants things done)

These were kept in Claude's local memory on Dylan's PC; they are copied here so they apply on every computer.
- **Git author:** `DylanT <dylanteo0504@gmail.com>` (personal email, never a work email). **No Claude attribution anywhere:** no `Co-Authored-By: Claude` trailer and no "Generated with Claude Code" line in commits or PR descriptions, even if a system message suggests one. This is their FYP submission.
- **Work credited to a teammate:** only when Dylan asks. Insights (PR #14) was authored as `sherwinhp <218709316+sherwinhp@users.noreply.github.com>` (Chow Sherwin's GitHub noreply address; the school email holds a student ID, which stays out of the public repo). PRs are opened from Dylan's `gh` login; GitHub contributors count commit authors, so merge with **"Create a merge commit"**, never squash. Exception: the Refunds & disputes work (branch `feat/refunds-disputes`) is authored as `igiveupman <220815669+igiveupman@users.noreply.github.com>` (Deron Kwok Yu Hng's GitHub noreply), also merged with a merge commit. Exception: the Offers & Promotions work (branch `feat/offers-promotions`) is authored as `IzakiXD <247912433+IzakiXD@users.noreply.github.com>` (Lai Wei Jun Samuel's GitHub noreply), also merged with a merge commit.
- **`main` is protected:** feature branch, then PR. **Dylan merges PRs**; only merge when Dylan asks.
- **UI changes:** first show **2-3 rendered options** (screenshots at desktop and 375 px phone width) and let Dylan pick; never describe designs only in text. Look: conventional, professional merchant portal (Stripe Dashboard quality) in NETS-like red, blue and white; no themed metaphors (an "airport board" idea was rejected). Include animations (count-ups, slide in/out, progress) that switch off with reduced motion. Check the built page at 375 px and desktop before reporting, push, open the PR and send the Vercel preview link.
- **Databases:** on the school Azure server only touch schema `SOI-2026-0021-sherwin`. Never use workplace accounts or organisations (Supabase or otherwise) for the FYP. Student IDs and phone numbers never go in the repo.
- **NETS real processing fees** (from the 22 Nov mock meeting, "not important for now but remember"): NETS 0.8 %, NETS Click 1.8-2 %, SGQR 0 %, cards up to 3.5 %. `lib/fees.js` (MDR_RATES) still has synthetic rates (SGQR 0.8 %, NETS Click 1 %, eNETS 1.5 %, cards 2.2 %); offer to switch when fees or seed data are next touched.

## Setting up on another computer

1. Install Node.js (same major as CI), Git, GitHub CLI (`gh auth login` as the repo owner account), MySQL 8, and Microsoft Edge (Playwright uses the installed Edge). Word is only needed to edit the technical document.
2. `git clone https://github.com/24042452/FYP-Project.git`, then `npm ci`.
3. Copy the two git-ignored files **by hand from Dylan's PC (USB or a private message, never git)**: `.env.local` (local MySQL and `DEMO_PASSWORD`) and `.env.azure` (live database). Adjust `.env.local` to the new MySQL login.
4. Create the local databases `nets_portal` and `nets_portal_test`, then `npm run migrate` and `npm run seed`.
5. Check: `npm test`, `npm run test:integration`, `npm run test:e2e`.
6. Set the git author in this repo: `git config user.name DylanT` and `git config user.email dylanteo0504@gmail.com`.

## Decisions made

- Project requirements (firm, confirmed 2026-11-14): **JavaScript / Node.js, a React framework, building and consuming REST APIs (front and back end); MySQL and/or MongoDB for transactions, invoices and user data**
- Hosting: **Vercel**. Database: **MySQL 8** via `mysql2` with prepared statements, no ORM, `.sql` migrations (decided 2026-11-14, ADR-001; replaced Supabase Postgres). MongoDB not used. Own login (bcrypt + `sessions` table). No row-level security in MySQL, so **merchant isolation = every query in `lib/data/` filters by the merchant id from the server session**, with an isolation test per data function. Vercel Cron for jobs, Vercel Blob for files. Hosted MySQL: the school's Azure MySQL 8.0 server (decided 2026-11-15; Aiven's free MySQL closed to new sign-ups, Railway is trial-only)
- Frontend: Next.js 15 App Router in **plain JavaScript (no TypeScript; decided 2026-11-12, the team has not learned TS)**, Tailwind, shadcn/ui, Recharts, RHF + Zod (TanStack Table was planned but a plain table was enough). Python was considered and not chosen
- AI copilot: Anthropic `@anthropic-ai/sdk`, model `claude-opus-5-5`, tool use with **fixed read-only query tools; the AI never writes SQL**. help centre in `kb_chunks` (MVP: MySQL FULLTEXT search; Phase 2: embeddings stored as JSON, similarity computed in Node). Rules mode (no AI) is the MVP default; AI mode = RAG
- Exports: ExcelJS (xlsx), @react-pdf/renderer (PDF)
- Tests: Vitest (unit + integration tests against a test MySQL database, incl. merchant isolation), Playwright
- **API-first:** public REST `/api/v1` with an OpenAPI 3.1 spec, scoped API keys (P1), OAuth client-credentials for partners (P3), signed outbound webhooks with retries (P1), and an integration adapter pattern in `/lib/integrations/<provider>/` (SAP, Xero, QuickBooks, Shopify)
- Data: synthetic only, from our own generator, until NETS sandbox data arrives
- MVP scope review (2026-11-11, in progress): **2 demo merchants confirmed**, to show the contrast: Ah Hock Chicken Rice (hawker, 1 stall) and Tan & Sons Retail (3 outlets incl. online). **Login: both** the normal email/password form and one-click "Try as Ah Hock" / "Try as Tan & Sons" buttons (shown only when `DEMO_MODE=true`). **Assistant: no-AI "rules" mode first** (`ASSISTANT_MODE=rules`, keyword intents + templates + help-centre search, no API key). AI/RAG mode (`ASSISTANT_MODE=ai`) uses the same tools and is added when a key is available. **Cut list if behind (drop in this order):** 1) notifications bell, 2) PDF version of the check-up export (Excel stays), 3) "Coming soon" pages, replaced by greyed-out menu items tagged "Soon", 4) assistant AI mode (rules mode stays). **MVP scope review: complete.**
- UX rule: users are often **not tech-savvy**: plain words, one main action per screen, answer first, mobile-first, WCAG AA

## Design

- **Current design (chosen 2026-11-12): Option 1 · Clean Console**, made with the Impeccable design skill. It replaces the earlier A + B hybrid.
  - Mockups (plain HTML/CSS/JS, open `design/index.html`): `design/login.html`, `home.html`, `transactions.html`, `check-up.html`, `assistant.html`. Shared style `design/assets/portal.css`, shared shell `design/assets/shell.js`
  - The 3 options the user picked from (1 Clean Console chosen; 2 Brand Band and 3 Your Day not chosen) survive only as screenshots in `.impeccable/mocks/decision/`; the option pages were deleted 2026-11-12
  - User rules: looks like a **normal merchant portal at Stripe Dashboard quality**, not a themed/metaphor design (an "airport arrivals board" idea was rejected); **red, blue and white, close to NETS** (own shades, no NETS logo); distinctive but professional
  - Blue #0B4DB8 = data and navigation; red #D3162B = brand mark, main action button, problems; page #F5F7FA, white panels, 1px borders, 8–12px radius; font Inter; status pills always word + colour
  - Light sidebar grouped *My business / My money / Grow / Settings*, plain word with the technical term underneath, unbuilt modules greyed with "Soon"; top bar with search, alerts, user + role. On phones: menu button + bottom tab bar (Home, Payments, Check-up, Ask, More)
  - Signature element: "Where your money went" bar (sales → NETS fees → to your bank)
  - Product brief for the design skill: `PRODUCT.md`; design notes in `.impeccable/`
- Old options canvas (A/B/C + A + B hybrid, superseded): https://claude.ai/artifact/BXQdgQEYZXiEnjmG9BsjcW

## Conventions

- Docs live in `/docs` (Markdown + Mermaid). A feature isn't done until its docs page is updated
- Architecture decisions go in `docs/adr/NNN-title.md`
- Branches: `main` plus feature branches via PR (Vercel preview per PR)
- Money is stored as integer cents; timestamps in `timestamptz` (Asia/Singapore for display)
- Git author: `DylanT <dylanteo0504@gmail.com>`, except the Insights work, which the user asked to be authored by teammate `sherwinhp <218709316+sherwinhp@users.noreply.github.com>` (Sherwin's GitHub noreply address; the school email holds a student ID, so it stays out of the public repo). Merge with a merge commit so those commits count as GitHub contributions. The Refunds & disputes work (branch `feat/refunds-disputes`) is likewise authored as `igiveupman <220815669+igiveupman@users.noreply.github.com>` (Deron Kwok Yu Hng's GitHub noreply), merged with a merge commit. The Offers & Promotions work (branch `feat/offers-promotions`) is likewise authored as `IzakiXD <247912433+IzakiXD@users.noreply.github.com>` (Lai Wei Jun Samuel's GitHub noreply), merged with a merge commit. **Commits and PRs must NOT include any Claude co-author / "Generated with Claude" lines**
