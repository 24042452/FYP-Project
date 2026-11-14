# CLAUDE.md — NETS Merchant Portal (FYP)

Final Year Project with industry partner **NETS** (Singapore payments): an enhanced Merchant Portal prototype. 4-person team. Read `docs/` before doing anything.

## Where we left off (update this section at the end of every session)

**Last updated:** 2026-11-15
**Current phase: MVP LIVE, polishing for Touchpoint 1.** The MVP is built, reviewed, merged into `main` and deployed.
**Next deadline:** Touchpoint 1 MVP demo to NETS & RP, about 2026-11-25.

Where things are:
- **Live site:** https://fyp-project-taupe.vercel.app (Vercel Hobby, deploys from `main`; every PR gets a preview link, which needs a Vercel login)
- **Repo:** https://github.com/24042452/FYP-Project (moved from `Rampy2122/FYP-Project`; the old URL redirects). `main` is protected by a ruleset: changes go in through pull requests, no force pushes or deletion
- **Database (live):** the school's shared Azure MySQL 8.0 server, schema `SOI-2026-0021-sherwin` (the server shows it in lower case). Other schemas on that server belong to other people: only ever touch ours. Host and login live only in the git-ignored `.env.azure`. The schema came from `db/export/SOI-2026-0021-sherwin.sql` (`node scripts/export-schema.mjs <name>` regenerates it). Re-seed it with `node --env-file=.env.azure scripts/seed.mjs`
- **Database (local):** MySQL 8 on this PC (`nets_portal`, `nets_portal_test`); settings in git-ignored `.env.local`
- Tests: `npm test` (unit), `npm run test:integration` (MySQL `nets_portal_test`), `npm run test:e2e` (Playwright in installed Edge; builds and starts the app itself, so run `npm run seed` first). Results in `docs/04-documentation-and-test-plan.md`. CI (`.github/workflows/ci.yml`) runs lint, unit and integration on every PR
- Docs: feature pages in `docs/features/`, open small issues and ideas in `docs/backlog.md`, build plan in `docs/superpowers/plans/2026-11-11-mvp.md`

Merged so far:
- PR #1 (2026-11-15): the whole MVP (tasks 1-14a plus the final-review fixes)
- PR #2: schema export for the school Azure database
- PR #3: working outlet menu (Home and Sales & payments follow the chosen outlet, with each outlet's share of NETS payouts, animations and a "Now showing" message), red "Log out" button with words, check-up progress bar

Waiting on the user:
- Ask the school owner to **change the Azure database password** (it was exposed once in a session log on 2026-11-15), then update `.env.azure` and `DATABASE_URL` in Vercel
- An Anthropic API key (optional; without it the assistant stays in rules mode)

Next steps:
1. **Before every demo: re-seed that morning**, locally and on Azure (`node --env-file=.env.azure scripts/seed.mjs`). Pending/late/"today" figures are set relative to the seed day and nothing refreshes them
2. Decide on the health-score wording (it shows a low red score next to "Business is good"); see `docs/backlog.md`
3. Full run-through on a phone and a laptop, a backup screen recording, and the demo script and slides
4. Quick usability test with 3-5 non-technical users (user-centred design evidence)
5. After Touchpoint 1: Phase 1 in `docs/01-project-plan.md`

Done:
- [x] Planning docs 01-04, design (Option 1 · Clean Console) and `PRODUCT.md`
- [x] 2026-11-14/15: MVP built (tasks 1-14a), final whole-branch review and fixes, deployed to Vercel with the school Azure database, PRs #1-3 merged

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
- Git author: `DylanT <dylanteo0504@gmail.com>`. **Commits and PRs must NOT include any Claude co-author / "Generated with Claude" lines**
