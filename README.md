# NETS Merchant Portal (FYP prototype)

An enhanced merchant portal prototype: an insights dashboard, reconciliation and reports, and an AI assistant.
Start with `CLAUDE.md` (current status) and `docs/` (plan, technical design, features, test plan).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values (see docs/02-technical-design.md)
npm run seed                 # creates the two demo merchants and their synthetic data
npm run dev                  # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest) |
| `npm run build` | Production build |
| `npm run seed` | (Re)generate the demo data in Supabase |

Demo logins (after seeding): `hawker@demo.local` and `retail@demo.local`, with the password from `DEMO_PASSWORD`.
