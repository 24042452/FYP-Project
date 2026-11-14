# CLAUDE.md — NETS Merchant Portal (FYP)

Final Year Project with industry partner **NETS** (Singapore payments): an enhanced Merchant Portal prototype. 4-person team. Read `docs/` before doing anything.

## Where we left off (update this section at the end of every session)

**Last updated:** 2026-11-14
**Current phase: BUILDING.** The user approved building (database switched to MySQL 8 on 2026-11-14, see ADR-001). MVP feature tasks 1-13 are done and task 14a (Playwright e2e tests, GitHub Actions CI, README, feature docs, test-plan results) is done, all on branch `mvp`. The deployment part, 14b (hosted MySQL, `git push`, Vercel), is **waiting on the user's OK**: do not create hosted databases, push or deploy until they say so.
**Next deadline:** Touchpoint 1 MVP demo to NETS & RP, about 2026-11-25.

Where things are:
- Branch `mvp` (local; GitHub has `main` and an older `mvp`). Execution ledger: `.superpowers/sdd/2026-11-11-mvp/progress.md`. Build plan: `docs/superpowers/plans/2026-11-11-mvp.md`
- Tests: `npm test` (unit), `npm run test:integration` (MySQL `nets_portal_test`), `npm run test:e2e` (Playwright in installed Edge; builds and starts the app itself, so run `npm run seed` first). Results in `docs/04-documentation-and-test-plan.md`
- CI: `.github/workflows/ci.yml` (lint, unit, integration with a `mysql:8` service; e2e is local only)
- Feature docs: `docs/features/`
- Local setup: `.env.local` (git-ignored) has the MySQL URLs, `DEMO_MODE=true`, `DEMO_PASSWORD`, `ASSISTANT_MODE=rules`. The old Supabase keys in it are unused

Waiting on the user:
- OK for 14b: hosted MySQL 8 provider, push to GitHub, Vercel project and env vars
- An Anthropic API key (optional; without it the assistant stays in rules mode)

Next steps:
1. 14b deploy (after the user's OK): hosted MySQL 8 with app and admin users, `npm run migrate` and `npm run seed` against it, push, Vercel, smoke-test both demo logins
2. Final whole-branch review of `mvp`
3. Open a PR from `mvp` to `main`
4. Cut list if behind is in "Decisions made"
5. **Before every demo: run `npm run seed` that morning** (and against the hosted DB). Pending/late/today figures are set relative to the seed day and nothing refreshes them

Done:
- [x] Planning docs 01-04, design (Option 1 · Clean Console) and `PRODUCT.md`, GitHub repo https://github.com/Rampy2122/FYP-Project
- [x] 2026-11-14: MVP feature tasks 1-13 and 14a built on `mvp`

## Decisions made

- Project requirements (firm, confirmed 2026-11-14): **JavaScript / Node.js, a React framework, building and consuming REST APIs (front and back end); MySQL and/or MongoDB for transactions, invoices and user data**
- Hosting: **Vercel**. Database: **MySQL 8** via `mysql2` with prepared statements, no ORM, `.sql` migrations (decided 2026-11-14, ADR-001; replaced Supabase Postgres). MongoDB not used. Own login (bcrypt + `sessions` table). No row-level security in MySQL, so **merchant isolation = every query in `lib/data/` filters by the merchant id from the server session**, with an isolation test per data function. Vercel Cron for jobs, Vercel Blob for files. Hosted MySQL provider to be picked in Sprint 1
- Frontend: Next.js 15 App Router in **plain JavaScript (no TypeScript; decided 2026-11-12, the team has not learned TS)**, Tailwind, shadcn/ui, Recharts, TanStack Table, RHF + Zod. Python was considered and not chosen
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
