# CLAUDE.md — NETS Merchant Portal (FYP)

Final Year Project with industry partner **NETS** (Singapore payments): an enhanced Merchant Portal prototype. 4-person team. Read `docs/` before doing anything.

## Where we left off (update this section at the end of every session)

**Last updated:** 2026-11-12
**Current phase: PLANNING ONLY.** The user said: "make sure it is only in the planning phase, we will start the building phase after we have planned finish." **Do not write product code, run builds or touch databases until the user explicitly says planning is finished and building can start.**
**Next deadline:** Touchpoint 1 MVP demo to NETS & RP, about 2026-11-25.

Build work started before the pause (kept, not deleted; don't continue it until building is approved):
- Branch `mvp`, commit 1: Next.js scaffold, tooling, `lib/money.ts`, `lib/channels.ts` + tests (Plan Task 1 done)
- Uncommitted, partial Plan Task 3 (data generator): `lib/dates.ts`, `lib/fees.ts`, `lib/failure-codes.ts`, `lib/synthetic/{prng,profiles}.ts`, `tests/unit/generate.test.ts`. `lib/synthetic/generate.ts` is not written yet, so these tests fail on purpose
- Execution ledger: `.superpowers/sdd/2026-11-11-mvp/progress.md`
- MVP build plan (draft, still open to planning changes): `docs/superpowers/plans/2026-11-11-mvp.md`

Waiting on the user:
- An Anthropic API key (optional; without it the assistant shows "not set up yet")

Set up 2026-11-12: `.env.local` created (git-ignored); the user filled in the 3 Supabase keys from their own project. `ASSISTANT_MODE=rules`, `DEMO_MODE=true`, `DEMO_PASSWORD` generated

Done:
- [x] Project plan, phases, methodology (Scrum, 1-week sprints, plus UCD): `docs/01-project-plan.md`
- [x] Tech stack, architecture, data model, recon logic, AI design, open API: `docs/02-technical-design.md`
- [x] Feature catalogue and extra improvement ideas: `docs/03-feature-catalogue.md`
- [x] Documentation set and test plan: `docs/04-documentation-and-test-plan.md`
- [x] UI design options produced for the user to choose from (see "Design" below)
- [x] 2026-11-12: new design chosen (Option 1 · Clean Console) and 5 screens mocked up in `design/` (see "Design")
- [x] `PRODUCT.md` (product brief used by the Impeccable design skill)
- [x] 2026-11-12: pushed to GitHub https://github.com/Rampy2122/FYP-Project (`main` and `mvp` both at the same commit), with a README covering the project, design and progress. From now on: feature branches + PRs into `main`

Next steps:
1. ~~User picks a design direction~~ Done 2026-11-12: Option 1 · Clean Console (see "Design")
2. ~~Update the build plan to plain JavaScript~~ Done 2026-11-12: the plan now uses `.js`/`.jsx` with JSDoc, and new **Task 1b** converts the existing TypeScript files first when building starts
3. Finish planning with the user/team: review docs 01–04 and the MVP build plan, and confirm the MVP scope
4. Only after the user approves building: start with Task 1b (convert to JS), then continue from Task 3 (see the ledger)

## Decisions made

- Hosting: **Vercel**. Database: **Supabase = PostgreSQL** (not MySQL), with RLS, pgvector, pg_cron, Storage, Auth
- Frontend: Next.js 15 App Router in **plain JavaScript (no TypeScript; decided 2026-11-12, the team has not learned TS)**, Tailwind, shadcn/ui, Recharts, TanStack Table, RHF + Zod. Python was considered and not chosen
- AI copilot: Anthropic `@anthropic-ai/sdk`, model `claude-opus-5-5`, tool use with **fixed read-only query tools; the AI never writes SQL**. help centre in `kb_chunks` (MVP: Postgres full-text search; Phase 2: pgvector gte-small embeddings). Rules mode (no AI) is the MVP default; AI mode = RAG
- Exports: ExcelJS (xlsx), @react-pdf/renderer (PDF)
- Tests: Vitest, Playwright, pgTAP (RLS isolation)
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
