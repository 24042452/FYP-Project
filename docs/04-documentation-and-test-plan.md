# Documentation & Test Plan

## 1. Documentation set (all in `/docs`, Markdown, versioned in git)

| Document | Audience | Owner | Contents | When |
|---|---|---|---|---|
| `01-project-plan.md` | Team, RP, NETS | D | Goals, methodology, phases, milestones, risks | Now, updated each sprint |
| `02-technical-design.md` | Developers, assessors | B + C | Stack, architecture, data model, recon logic, AI design, security | Now, updated with every architecture change |
| `03-feature-catalogue.md` | Everyone | D | Modules, phases, improvement ideas | Now |
| `api/` (per route) | Developers | Feature owner | Endpoint, inputs, outputs, errors | With each feature PR |
| `database/` | Developers | B | MySQL setup guide, table dictionary, merchant-isolation rule, migrations log | With each migration |
| `assistant/` | Developers | C | System prompt, tool definitions, evaluation questions and results | With each copilot change |
| `adr/` | Developers, assessors | Anyone | Architecture Decision Records (e.g. "ADR-001: MySQL as the database") | When a decision is made |
| `user-guide/` | **Merchants** (non-technical) | A + D | Screenshot-led how-tos in plain words, one page per task | From P1, final in P4 |
| `test-plan.md` + `test-cases/` | Assessors, team | D | Strategy (below) and case table | From P0 |
| `sprint-log/` | RP | Scrum Master | Sprint goals, burndown, retro notes, as evidence of the methodology | Weekly |
| `final-report.md` | RP, NETS | All | Compiled at the end from the above | P4 |
| `README.md` (repo root) | Developers | D | Setup: clone, local MySQL 8, env vars, `npm run migrate`, `npm run seed`, `npm run dev` | P0 |

**Rule:** a feature PR is not "Done" until its docs page is updated (this is in the Definition of Done).

## 2. Test strategy

| Level | Tool | What | Target |
|---|---|---|---|
| Unit | Vitest | Recon matching, formatting, summary-text templates, export builders | Recon logic ≥ 90% coverage |
| Integration (database) | Vitest + test MySQL database (local and GitHub Actions `mysql:8`) | Merchant isolation (merchant A never sees B), SGT day boundaries, constraints, migrations re-run safely, login and sessions | Every `lib/data/` function has an isolation test |
| End-to-end | Playwright | Key journeys on desktop and mobile viewport | All P0 journeys |
| AI evaluation | Scripted question set | ~30 questions with known answers from seed data; check numbers and refusals | ≥ 90% correct; 0 invented numbers |
| Accessibility | axe + manual keyboard check | WCAG 2.1 AA | 0 critical issues |
| Usability | 3–5 non-technical users per round | Task success, time-on-task, quotes | Each P0 task completed unaided by ≥ 80% |
| UAT | NETS mentor at touchpoints | Demo against agreed features | Sign-off notes |

## 3. Test case template

| ID | Feature | Precondition | Steps | Expected result | Actual | Pass/Fail |
|---|---|---|---|---|---|---|
| TC-AUTH-01 | Login | Demo merchant exists | Enter valid email/password → Login | Lands on dashboard showing merchant's name | e2e `auth.spec.js` (desktop + iPhone 13): lands on Home, greeting "Good …, Ah Hock" and merchant name shown. Wrong password shows the plain error and stays on `/login` (TC-AUTH-01b). | Pass |
| TC-AUTH-02 | Data isolation | Logged in as Merchant A | Request Merchant B's transaction via URL/API | Not found / no data returned | e2e: signed in as Ah Hock, a Tan & Sons payment id (read from the database) shows "We couldn't find that payment". Integration `isolation.test.js` covers every data function. | Pass |
| TC-DASH-01 | Dashboard KPIs | Seed data loaded | Open dashboard, select "This month" | Total equals sum of successful transactions this month in DB | e2e: headline visible and no NaN/Infinity/undefined on today, week and month views. The "total equals the sum of successful transactions" part is checked by integration `sales.test.js` and unit `home-model.test.js`, not by e2e. | Pass |
| TC-REC-01 | Reconciliation | Seed contains 3 known mismatches for Oct | Run reconciliation for Oct | Exactly 3 exceptions listed with correct types | e2e: October 2026 run in the UI shows "3 need a look" (3 money problems; the 45 failed payments are one collapsed summary row). Exception types checked in unit `reconcile.test.js`. | Pass |
| TC-EXP-01 | Excel export | Recon run exists | Click Export → Excel | .xlsx downloads; totals match on-screen figures | e2e: check-up "Download Excel" gives `check-up-2026-10.xlsx`; Reports payments Excel gives `payments-….xlsx`. Totals vs on-screen figures are checked in unit `recon-export.test.js`. | Pass |
| TC-INV-01 | Invoice PDF | Invoice exists | Click Download | PDF opens with correct lines and total | Unit `invoice-pdf.test.js` builds the PDF and checks lines and total. Not covered by e2e. | Pass (unit only) |
| TC-AI-01 | Copilot sales question | Seed data | Ask "How much did I take last week?" | Correct amount and date range stated | e2e (rules mode): chip answers "Last week (…) … $x,xxx.xx …" with the date range. Numbers checked in unit/eval tests. | Pass |
| TC-AI-02 | Copilot refuses unknown | — | Ask about another merchant | Politely declines; no data leaked | e2e (rules mode): "Show me Tan & Sons' sales" gives "I can only show your own business's figures." and no figures. | Pass |
| TC-MOB-01 | Mobile | 375px viewport | Complete TC-DASH-01 and TC-INV-01 | Fully usable, no horizontal scroll | e2e at 375x812 (and iPhone 13, 390 wide): `scrollWidth` is at most 375 on Home, Payments, Check-up and Assistant. Invoice PDF not part of the e2e run. | Pass |

Extra e2e rows: TC-AUTH-01b (wrong password, Pass), TC-AUTH-03 (the "Try as Tan & Sons" demo button signs in as Tan & Sons Retail, Pass), TC-EXP-01b (Reports payments Excel, Pass), plus "signed-out visitors are sent to /login" (Pass).

**TC-AUTH-03 with DEMO_MODE off:** the e2e server's environment is fixed for a run, so e2e only tests the DEMO_MODE=true path. The off branch (no demo buttons, demo login refused) is covered by unit `tests/unit/login-form.test.jsx` and integration `tests/integration/demo-login.test.js`.

## 4. Results (2026-11-14)

| Suite | Command | Result |
|---|---|---|
| Unit (Vitest) | `npm test` | 22 files, 209 tests passed |
| Integration (Vitest + MySQL 8, `nets_portal_test`) | `npm run test:integration` | 10 files, 80 tests passed |
| End-to-end (Playwright, Microsoft Edge, desktop 1280x800 and iPhone 13) | `npm run test:e2e` | 22 tests passed (11 per project), against `npm run build && npm start` |
| Lint | `npm run lint` | no problems |

Not yet done: AI evaluation set against a live model, accessibility scan (axe), usability sessions, UAT. GitHub Actions (`.github/workflows/ci.yml`) runs lint, unit and integration tests; e2e is run locally only because it needs a seeded database and a browser.
