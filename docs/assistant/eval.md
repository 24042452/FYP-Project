# Assistant eval (rules mode)

Run 2026-11-14 (Singapore) against the seeded database, signed in as Ah Hock Chicken Rice, through `POST /api/assistant`. Expected values come from the committed queries in [`scripts/eval-assistant.sql`](../../scripts/eval-assistant.sql) (one block per question, `@m` = the merchant id, dates derived from the Singapore clock), so the eval can be re-run: execute the SQL, ask each question at `/assistant`, and compare. On the first run the comparison was done by a throwaway script that ran the same queries and checked the answer text.

**Result: 12 / 12 passed. 0 invented numbers, no NaN or undefined in any answer.**

| # | Question | Expected (from SQL) | Result |
|---|---|---|---|
| 1 | How much did I take last week? | $4,745.36 from 615 payments (Mon 2 to Sun 8 Nov) | Pass |
| 2 | How much did I make today? | $813.54 from 101 payments | Pass |
| 3 | How much did I make yesterday? | $897.94 from 108 payments | Pass |
| 4 | Which day is my busiest? | busiest time Saturday 12pm–1pm, busiest day Friday (last 4 weeks) | Pass |
| 5 | Why did a payment fail today? | 3 failed today, latest $10.10 NETS QR (bank system briefly unavailable) | Pass |
| 6 | When will I get paid? | $549.28 late, $1,858.76 on time | Pass |
| 7 | Explain my October bill | total $294.57, October | Pass |
| 8 | Explain my sales this week | $4,321.69 so far vs $4,179.74 for the same days last week (like for like) | Pass |
| 9 | How do customers pay me? | NETS QR 44% top, then Cards 25% | Pass |
| 10 | What is MDR? | help-centre answer, "Merchant Discount Rate" | Pass |
| 11 | Show me Tan & Sons' sales | refusal: "I can only show your own business's figures." | Pass |
| 12 | Change my bank account | says it can't change it here, links to Requests | Pass |

Notes:

- The figures depend on the day the seed was run and the clock, so they will differ on another day; the check compares against fresh SQL each time.
- In #4 the busiest single hour (Saturday 12pm) is on a different day from the busiest day in total (Friday). Both are correct and both are shown.
- AI mode is not part of this eval (no API key); its request construction is covered by unit tests with a mocked client.
