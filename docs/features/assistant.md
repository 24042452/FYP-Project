# NETS Assistant

## What it is for
Answers a merchant's questions in plain words ("How much did I take last week?", "When will I get paid?") from their own data and the help centre. It can only read data.

## Where it lives
- Page: `/assistant` (`app/(portal)/assistant/page.jsx`, `components/assistant/Chat.jsx`), `?q=` prefills a question
- API: `POST /api/assistant` (`app/api/assistant/route.js`); 401 JSON when signed out
- Logic: `lib/assistant/` (`rules.js`, `tools.js`, `ai.js`, `kb.js`)

Full design, tool list, guardrails and evaluation questions: [docs/assistant/README.md](../assistant/README.md).

## Data used
Nine read-only tools over the `lib/data/` functions, plus `searchKb` (`lib/data/kb.js`) over the help-centre table.

## Rules and edge cases
- `ASSISTANT_MODE=rules` (default) uses keywords, templates and help-centre search, with no AI key. `ai` mode uses Claude with the same tools.
- The merchant id is closed over from the session and is in no tool schema. A question about another business gets "I can only show your own business's figures."
- Every answer repeats its date range. If no tool can answer, it says so and does not invent numbers.
- Limits: 20 messages, 1000 characters each. The help content is sample text, not official NETS policy.
- Phone layout: the page scrolls naturally and the suggestion chips are one scrolling row.

## Tests
- Unit: `tests/unit/assistant-rules.test.js`, `assistant-tools.test.js`, `assistant-ai.test.js`
- Integration: `tests/integration/kb.test.js`
- End-to-end: `tests/e2e/assistant.spec.js` (TC-AI-01, TC-AI-02)
