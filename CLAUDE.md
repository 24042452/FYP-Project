# CLAUDE.md — NETS Merchant Portal (FYP)

Final Year Project with industry partner **NETS** (Singapore payments): an enhanced Merchant Portal prototype. 4-person team. Read `docs/` before doing anything.

## Where we left off (update this section at the end of every session)

**Last updated:** 2026-11-11
**Current phase:** Phase 0 (MVP) planning is done. No code has been written yet.
**Next deadline:** Touchpoint 1 MVP demo to NETS & RP, about 2026-11-25.

Done:
- [x] Project plan, phases, methodology (Scrum, 1-week sprints, plus UCD): `docs/01-project-plan.md`
- [x] Tech stack, architecture, data model, recon logic, AI design, open API: `docs/02-technical-design.md`
- [x] Feature catalogue and extra improvement ideas: `docs/03-feature-catalogue.md`
- [x] Documentation set and test plan: `docs/04-documentation-and-test-plan.md`
- [x] UI design options produced for the user to choose from (see "Design" below)

Next steps:
1. ~~User picks a design direction~~ Done: A + B hybrid (see "Design")
2. User/team reviews the docs and confirms the MVP scope
3. Write the implementation plan for the MVP (superpowers:writing-plans)
4. Scaffold: Next.js 15 + TS + Tailwind + shadcn/ui; Supabase project; GitHub repo; Vercel link
5. Schema migrations + RLS, then the synthetic data generator, then the dashboard

## Decisions made

- Hosting: **Vercel**. Database: **Supabase = PostgreSQL** (not MySQL), with RLS, pgvector, pg_cron, Storage, Auth
- Frontend: Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui, Recharts, TanStack Table, RHF + Zod
- AI copilot: Anthropic `@anthropic-ai/sdk`, model `claude-opus-5-5`, tool use with **fixed read-only query tools; the AI never writes SQL**. RAG over `kb_chunks` (pgvector, gte-small embeddings)
- Exports: ExcelJS (xlsx), @react-pdf/renderer (PDF)
- Tests: Vitest, Playwright, pgTAP (RLS isolation)
- **API-first:** public REST `/api/v1` with an OpenAPI 3.1 spec, scoped API keys (P1), OAuth client-credentials for partners (P3), signed outbound webhooks with retries (P1), and an integration adapter pattern in `/lib/integrations/<provider>/` (SAP, Xero, QuickBooks, Shopify)
- Data: synthetic only, from our own generator, until NETS sandbox data arrives
- UX rule: users are often **not tech-savvy**: plain words, one main action per screen, answer first, mobile-first, WCAG AA

## Design

- Options canvas: https://claude.ai/artifact/BXQdgQEYZXiEnjmG9BsjcW (private, owner only)
  - A, Friendly & Simple: huge numbers, plain-English headline, pill nav, big action buttons (hawkers / small merchants)
  - B, Pro Console: dark sidebar grouped by Insights / Operations / Grow / Manage, dense KPIs, heatmap, recon card (chains / accountants)
  - C, Assistant-first: big "ask a question" box, daily briefing feed of nudges, health score
- **Chosen (2026-11-11): A + B hybrid**, the "Chosen — A + B hybrid" artboard on the canvas:
  - **From B:** dark navy sidebar (#0E1726) grouped as *My business / My money / Grow / Settings*; outlet selector at the top; "Ask NETS Assistant" button pinned at the bottom
  - **From A:** plain-English headline sentence, big-number tiles (Money in today / Coming to your bank / Needs your attention), simple bar chart, channel bars, large action buttons
  - Sidebar labels use **plain words, with the technical term underneath** (e.g. "Money to my bank" / *Settlements*, "Check-up" / *Reconciliation*)
  - Font Inter; accent #1F4FD1; warm grey ground #F6F5F1; cards white with 20px radius; touch targets ≥ 44px
  - On phones the sidebar stacks above the content (later: collapse it into a bottom tab bar or menu button)

## Conventions

- Docs live in `/docs` (Markdown + Mermaid). A feature isn't done until its docs page is updated
- Architecture decisions go in `docs/adr/NNN-title.md`
- Branches: `main` plus feature branches via PR (Vercel preview per PR)
- Money is stored as integer cents; timestamps in `timestamptz` (Asia/Singapore for display)
