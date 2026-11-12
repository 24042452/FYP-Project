# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two primary audiences, designed for equally:

- **Small merchants (e.g. a hawker with one stall):** often not tech-savvy, often older, frequently on a phone at the stall between customers. Job: "Did I get paid, how is business, is anything wrong?"
- **Multi-outlet merchants and their accountants (e.g. a 3-outlet retailer with an online shop):** usually on desktop. Job: find and filter payments, check settlements against sales and the monthly invoice, export for the books.

Secondary audience: NETS and RP evaluators at the Touchpoint demos, who judge the prototype against NETS's brief.

## Product Purpose

An enhanced NETS Merchant Portal prototype (Final Year Project with industry partner NETS, Singapore payments). Today most merchants open the portal once a month to check an invoice. The goal is a portal they *want* to open: understand and grow the business (insights), less admin work (operations), and engagement through an assistant and nudges. Success = merchants can answer their money questions without help, and NETS sees a credible direction.

## Positioning

One place for every NETS payment channel (NETS QR, cards, SGQR, NETS Click, eNETS) that explains the business in plain English and automatically checks payments against bank deposits and the NETS bill (the "check-up"), with an assistant that answers from the merchant's own data and can never change anything.

## Operating Context

- Demo merchants: Ah Hock Chicken Rice (hawker, 1 stall) and Tan & Sons Retail (3 outlets incl. online). Data is synthetic until NETS sandbox data arrives.
- Login: email/password plus one-click "Try as…" demo buttons when `DEMO_MODE=true`.
- Assistant: no-AI "rules" mode first (keyword intents + templates + help-centre search); AI mode added later with the same read-only tools.
- Reports are downloaded for an accountant (Excel; PDF later).

## Capabilities and Constraints

- Next.js web app on Vercel, Supabase (Postgres) backend. MVP deadline: Touchpoint 1 demo, about 2026-11-25.
- MVP modules: Home, Transactions, Settlements ("Money to my bank"), Invoices ("Bills & charges"), Check-up (Reconciliation), Reports, NETS Assistant. Other modules show as "Soon".
- Terminology: plain words first, the technical term underneath (Check-up / *Reconciliation*, Money to my bank / *Settlements*).
- English only for the MVP; multi-language (中文, Melayu, தமிழ்) is a Phase 2 idea, so layouts should tolerate longer text.

## Brand Commitments

- Not using official NETS branding: a neutral "Merchant Portal" mark with the team's own look. NETS assets can be added later if provided.
- 2026-11-11: the user chose the "A + B hybrid" on the design canvas (https://claude.ai/artifact/BXQdgQEYZXiEnjmG9BsjcW). 2026-11-12: the user asked for a **new design** of the whole portal (Home included) through Impeccable; the hybrid is now evidence, not authority.
- **Standing preference (2026-11-12): it must look like a conventional merchant portal**, at the quality bar of the **Stripe Dashboard**, not a themed or metaphorical world (an airport-board direction was rejected). Keep the team's own colours and mark; don't copy Stripe's branding.
- **Colours (2026-11-12): close to NETS: red, blue and white.** Use our own shades and mark, not the NETS logo. The user wants the look more distinctive than a stock dashboard while staying professional.
- "Admin" means the merchant's own staff roles (Owner, Manager, Cashier, Accountant) inside one merchant account; there is no NETS-side admin console in scope.

## Evidence on Hand

- Docs: `docs/01-project-plan.md` to `docs/04-documentation-and-test-plan.md`.
- No real merchants, testimonials, usage numbers or NETS statistics. Don't invent them; all figures in mockups are sample data and labelled as such.

## Product Principles

1. **Simple enough for a hawker uncle:** plain words, technical terms only as a subtitle.
2. **Answer first, details after:** each screen opens with a one-sentence summary.
3. **One main action per screen**, as a big obvious button.
4. **Help is one tap away:** "Ask NETS Assistant" on every page.
5. **Trust through honesty:** say what's wrong and what to do; the assistant only reads data.

## Accessibility & Inclusion

WCAG 2.1 AA; large text, high contrast, touch targets ≥ 44px; meaning never carried by colour alone; mobile-first.
