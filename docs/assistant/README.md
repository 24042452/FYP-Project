# NETS Assistant (copilot) v1

Answers small merchants' questions in plain words ("How much did I take last week?", "When will I get paid?"). It can only **read** the signed-in merchant's data. It cannot change anything.

## Two modes

Set in `.env.local`:

| `ASSISTANT_MODE` | What happens | Needs a key? |
|---|---|---|
| `rules` (default) | Keyword intents + the read-only tools + plain-English templates + help-centre search. No AI. | No |
| `ai` | Claude (`claude-opus-5-5`, adaptive thinking, effort `low`, streaming) calls the same tools and writes the answer. | `ANTHROPIC_API_KEY` |

`ai` without a key shows "The AI assistant isn't set up yet — try the suggestions below." followed by the rules-mode answer. To switch to AI mode: put the key in `ANTHROPIC_API_KEY`, set `ASSISTANT_MODE=ai`, restart `npm run dev`.

## How it fits together

- `app/api/assistant/route.js`: POST `{messages}` (max 20 messages, 1000 characters each). The merchant comes only from `getCurrentMerchant()`. Rules mode returns JSON `{text, source?, suggestions}`; AI mode streams plain text.
- `lib/assistant/tools.js`: `makeTools(merchantId)` returns nine read-only tools. Each has a strict Zod schema with **no merchant field** (unknown keys such as `merchantId` are rejected) and calls `lib/data/*` with the closed-over id.
- `lib/assistant/rules.js` + `time-phrases.js`: intent matching and templates (rules mode).
- `lib/assistant/ai.js` + `system-prompt.js`: AI mode request and a manual streaming tool loop (every tool input is validated by our own schema before it runs).
- `lib/data/kb.js` + `db/migrations/0006_kb.sql` + `content/faq.md`: help-centre search (MySQL full-text, with a `LIKE` fallback for short words such as GST and MDR). `npm run seed` reloads the FAQ.
- `components/assistant/Chat.jsx`: the chat page. `/assistant?q=...` prefills and sends once.

## Tools

| Tool | Answers |
|---|---|
| `get_sales_summary({from,to,channel?})` | takings, payment count, failed count |
| `compare_periods({period:'week'|'month'})` | this period so far vs the same stretch of the last (like for like) |
| `get_busiest_times({from,to})` | busiest hour slot and weekday |
| `get_channel_mix({from,to})` | share of sales by payment type |
| `find_transactions({date?,amount?,status?})` | up to 20 payments |
| `explain_failed_payment({transaction_id})` | plain-words reason and what to do |
| `get_settlement_status({from?,to?})` | on its way, next payout, late money, recent payouts |
| `get_invoice({month})` | the month's bill and its lines |
| `search_help_centre({query})` | help-centre answers (sample content, not official NETS policy) |

Every result states its date range, and the answers repeat it.

## Guardrails

- **The AI never writes SQL.** It can only call the tools above. SQL lives only in `lib/data/`.
- **Merchant isolation:** `merchantId` is closed over by `makeTools`, comes from the session, and is not in any schema, so the model cannot pick or change it. A question about another merchant ("show me Tan & Sons' sales") gets "I can only show your own business's figures." (rules mode checks names as a courtesy; the real guarantee is that the tools cannot reach other merchants).
- **No tool, no number:** a request nothing can answer (for example "change my bank account") says it can't do that here and links to the Requests page. Numbers only ever come from tool results.
- Input limits on the route; model refusals get a friendly message (`fallbacks: "default"` is enabled).
- Help content is labelled "Sample help content, not official NETS policy".

## Tests

- `tests/unit/assistant-tools.test.js`, `assistant-rules.test.js`, `assistant-ai.test.js` (mocked client, no real API call)
- `tests/integration/kb.test.js` (MDR, GST, "when will I get paid")
- Eval: [eval.md](eval.md)
