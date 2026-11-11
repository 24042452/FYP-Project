# Documentation & Test Plan

## 1. Documentation set (all in `/docs`, Markdown, versioned in git)

| Document | Audience | Owner | Contents | When |
|---|---|---|---|---|
| `01-project-plan.md` | Team, RP, NETS | D | Goals, methodology, phases, milestones, risks | Now, updated each sprint |
| `02-technical-design.md` | Developers, assessors | B + C | Stack, architecture, data model, recon logic, AI design, security | Now, updated with every architecture change |
| `03-feature-catalogue.md` | Everyone | D | Modules, phases, improvement ideas | Now |
| `api/` (per route) | Developers | Feature owner | Endpoint, inputs, outputs, errors | With each feature PR |
| `database/` | Developers | B | Table dictionary, RLS policies, migrations log | With each migration |
| `assistant/` | Developers | C | System prompt, tool definitions, evaluation questions and results | With each copilot change |
| `adr/` | Developers, assessors | Anyone | Architecture Decision Records (e.g. "ADR-001: Supabase Postgres over MySQL") | When a decision is made |
| `user-guide/` | **Merchants** (non-technical) | A + D | Screenshot-led how-tos in plain words, one page per task | From P1, final in P4 |
| `test-plan.md` + `test-cases/` | Assessors, team | D | Strategy (below) and case table | From P0 |
| `sprint-log/` | RP | Scrum Master | Sprint goals, burndown, retro notes, as evidence of the methodology | Weekly |
| `final-report.md` | RP, NETS | All | Compiled at the end from the above | P4 |
| `README.md` (repo root) | Developers | D | Setup: clone, env vars, `supabase start`, seed, `npm run dev` | P0 |

**Rule:** a feature PR is not "Done" until its docs page is updated (this is in the Definition of Done).

## 2. Test strategy

| Level | Tool | What | Target |
|---|---|---|---|
| Unit | Vitest | Recon matching, formatting, summary-text templates, export builders | Recon logic ≥ 90% coverage |
| Database | pgTAP | RLS isolation (merchant A ≠ B), constraints, recon SQL | Every table has an RLS test |
| End-to-end | Playwright | Key journeys on desktop and mobile viewport | All P0 journeys |
| AI evaluation | Scripted question set | ~30 questions with known answers from seed data; check numbers and refusals | ≥ 90% correct; 0 invented numbers |
| Accessibility | axe + manual keyboard check | WCAG 2.1 AA | 0 critical issues |
| Usability | 3–5 non-technical users per round | Task success, time-on-task, quotes | Each P0 task completed unaided by ≥ 80% |
| UAT | NETS mentor at touchpoints | Demo against agreed features | Sign-off notes |

## 3. Test case template

| ID | Feature | Precondition | Steps | Expected result | Actual | Pass/Fail |
|---|---|---|---|---|---|---|
| TC-AUTH-01 | Login | Demo merchant exists | Enter valid email/password → Login | Lands on dashboard showing merchant's name | | |
| TC-AUTH-02 | Data isolation | Logged in as Merchant A | Request Merchant B's transaction via URL/API | Not found / no data returned | | |
| TC-DASH-01 | Dashboard KPIs | Seed data loaded | Open dashboard, select "This month" | Total equals sum of successful transactions this month in DB | | |
| TC-REC-01 | Reconciliation | Seed contains 3 known mismatches for Oct | Run reconciliation for Oct | Exactly 3 exceptions listed with correct types | | |
| TC-EXP-01 | Excel export | Recon run exists | Click Export → Excel | .xlsx downloads; totals match on-screen figures | | |
| TC-INV-01 | Invoice PDF | Invoice exists | Click Download | PDF opens with correct lines and total | | |
| TC-AI-01 | Copilot sales question | Seed data | Ask "How much did I take last week?" | Correct amount and date range stated | | |
| TC-AI-02 | Copilot refuses unknown | — | Ask about another merchant | Politely declines; no data leaked | | |
| TC-MOB-01 | Mobile | 375px viewport | Complete TC-DASH-01 and TC-INV-01 | Fully usable, no horizontal scroll | | |
