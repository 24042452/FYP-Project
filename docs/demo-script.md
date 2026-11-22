# Demo script: Touchpoint 1 (NETS & RP)

A 7-minute walkthrough of the MVP, then questions. One person **presents** (talks to the audience), one person **drives** (clicks). Rehearse it at least twice with the same roles.

- **Live site:** https://fyp-project-taupe.vercel.app
- **Story in one line:** "Today merchants open the portal once a month to check a bill. We built one they'd open every day: it tells them how business is going, checks their money for them, and answers questions in plain English."
- Figures below are examples. The real ones depend on the day the data was loaded, so **read the numbers off the screen**, don't memorise them.

---

## Before the demo

**The morning of the demo**
- [ ] Re-load the demo data on the live database, so "today" and "this week" have numbers:
  `node --env-file=.env.azure scripts/seed.mjs` (about 1 minute; run it after 9 am so today has sales)
- [ ] Open the live site and log in once as each merchant to check it works
- [ ] Check the Check-up page for **October 2026** shows no old run, or re-run it once so you know how it looks

**30 minutes before**
- [ ] Laptop charged, on the venue Wi-Fi, notifications off, browser zoom 110 %, only the demo tabs open
- [ ] Tab 1: the login page. Tab 2 (for the "under the hood" part): `https://fyp-project-taupe.vercel.app/api/v1/summary?period=week` (opens after logging in)
- [ ] A phone with the site open, for the phone part (or use the browser's phone view: F12 → device toolbar → iPhone)
- [ ] The **backup video** on the laptop desktop (see "If something goes wrong")
- [ ] Local copy ready as a fallback: MySQL running, `npm run seed`, `npm run dev` → http://localhost:3000

---

## The script (about 7 minutes)

### 1. The problem (30 s)
**Say:** "NETS merchants are mostly small businesses: hawkers, shops, a few outlets. Today the portal is a place they visit once a month to look at an invoice. NETS asked us: how do we make it something they *want* to open? We focused on three things: understand the business, save them work, and answer their questions. And everything is in plain English, because our users are not accountants."

### 2. Logging in (20 s)
**Do:** on the login page, click **"Try as Ah Hock Chicken Rice"**.
**Say:** "There's a normal email and password login. For today we've added one-click demo buttons. Ah Hock runs one chicken rice stall."

### 3. Home: the answer first (60 s)
**Do:** point at the headline.
**Say:** "The first thing Ah Hock sees is the answer, not a chart: *'Business is slower this week. You made $4,321.69, which is $423.67 less than last week.'* We compare like for like: if it's Wednesday, we compare Monday to Wednesday with Monday to Wednesday last week, so a half-finished week never looks like a bad week."

**Do:** click the **"Business health: … · Okay"** tag.
**Say:** "If he wants to know why, one tap shows the working: start at 75, minus a bit for slower sales, minus a bit for failed payments, minus a bit for late money. No black box."

**Do:** close it, scroll to **"Where your money went this week"**.
**Say:** "This bar is our signature: of what he sold, this much went to NETS fees, and this is what lands in his bank."

**Do:** point at **"Needs your attention"** and the **alerts bell** (top right).
**Say:** "Anything that needs action is here, in words: payments that didn't go through, money that's late."

**Do:** scroll to **This week in numbers**.
**Say:** "You asked for numbers. Here are the four that matter, each with its change against the same days last week, and on the right, what drove it: for Ah Hock, most of the drop came from QR payments, so the advice is simple: check the QR stand. Switch to This month and it updates."

### 4. Check-up: the portal does the checking (75 s)
**Do:** click **Check-up** in the menu. Choose **October 2026**, press **Run check-up** (or "Check again").
**Say:** "Normally a merchant or their accountant has to tick off every sale against the bank and the bill. Our check-up does it for them." *(The progress bar shows the steps: adding up sales, matching with the bank, checking the bill.)*

**Do:** when it finishes, read the headline: *"We checked 160 items. 3 need a look."*
**Say:** "It found three real problems in October:"
- "**Money is short:** NETS paid $42.10 less than the card sales on 18 October."
- "**Money is late:** the NETS QR payout for 29 October hasn't arrived."
- "**Fees look wrong:** the October bill charges $3.60 more card fees than the payments add up to."

"Each one shows what we expected, what actually happened, and the difference. The 45 payments that simply didn't go through are kept to one line so they don't bury the real problems."

**Do:** on **Money is short**, tap **How to fix this**. Point at step 3, then tap **Copy details**.
**Say:** "You asked for a guide to reconciling. Every problem now has step-by-step help in plain words: why it usually happens, what to check first (with a link straight to those payments), and, if it's still wrong, the exact details NETS needs: the merchant ID, the date and the amounts. One tap copies them, so the merchant doesn't have to call and read numbers out. That should mean fewer support calls for NETS."

**Do:** click **Download Excel**. Open the file briefly.
**Say:** "And the accountant gets the whole thing as a spreadsheet."

### 5. Finding a payment (45 s)
**Do:** click the **search box** at the top, type an amount you can see on screen (for example `12.50`). Wait for the suggestions, press ↓ then Enter.
**Say:** "A customer says 'I paid twelve fifty yesterday'. He types the amount: matching payments appear as he types, and one press opens the details."

**Do:** in **Sales & payments**, click the **Failed** filter and open a failed payment.
**Say:** "If a payment failed, it says why in plain words, *'The customer's bank declined it (not enough funds)'*, and what to do next."

### 6. Ask the assistant (45 s)
**Do:** click **Ask** / **Ask NETS Assistant**, tap the suggestion **"How much did I take last week?"**.
**Say:** "Merchants can just ask. The answer comes from his own data, with the dates it covers."

**Do:** type **"Show me Tan & Sons' sales"**.
**Say:** "And it can never see another business's data. It can only read through a fixed set of safe questions; it never writes database queries itself. Today it runs without AI; when we plug in an AI key, it uses exactly the same safe tools."

### 7. A bigger business: outlets (45 s)
**Do:** click **Log out** (top right), then **"Try as Tan & Sons Retail"**.
**Say:** "Tan & Sons has three outlets, including an online store."

**Do:** in the menu, change **Showing** to **Tampines Mall #02-15**.
**Say:** "Pick an outlet and the whole page switches: the headline now talks about Tampines Mall, the numbers count to that outlet's figures, and even the money coming to the bank shows this outlet's share of each NETS payout."

### 7b. A franchise: three levels of access (60 s)
**Do:** **Log out**, then **"Kopi Corner head office"** (under "A franchise, three levels of access").
**Say:** "You told us some merchants are franchises. Head office lands on the group overview: the whole group's sales this week against the same days last week, each franchisee's share, and who needs a look. Kopi Corner North is healthy; West has late payouts."

**Do:** click **Open Kopi Corner West**, then open **Check-up**.
**Say:** "Head office can open any franchisee in its own group, but only to look: there is no Run check-up button here. The franchisee runs their own."

**Do:** **Log out**, then **"Bedok outlet manager"**.
**Say:** "The third level is one outlet. The manager of Bedok only sees Bedok's sales and payments; money to the bank, bills and the check-up belong to the whole business, so they are not in the menu, and the API refuses them too."

**Say (IDs):** "We also now use NETS' own identifiers: every merchant has a MID, every terminal a TID, and every payment a STAN. Open any payment and you see its TID and trace number."

### 8. On a phone (30 s, optional)
**Do:** show the same page on the phone: the bottom tabs (Home, Payments, Check-up, Ask, More), tap the search icon.
**Say:** "Most hawkers will use this on their phone, so every screen is designed for a phone first."

### 9. Under the hood (45 s, mainly for RP)
**Do:** switch to Tab 2 (`/api/v1/summary?period=week`): it shows JSON.
**Say:**
- "It's a **React** app (Next.js) with a **Node.js** back end, and a **REST API**: this is the same data as JSON. Our own pages use this API too, for example 'Show more' and the search suggestions."
- "The data is in **MySQL**, on the school's Azure server. Every query is locked to the logged-in merchant, and we have automated tests that prove one merchant can never see another's data."
- "About 400 automated tests run on every change: unit tests, database tests and browser tests on desktop and phone, with GitHub running them on every pull request."
- "All data is made up by our own generator. No real merchants or customers."

### 10. What's next (30 s)
**Say:** "Next we'd add automatic nightly check-ups and alerts by email, refunds and disputes, reports for accountants, staff roles, and API keys so systems like Xero can connect. We'd love NETS' input on which matters most to your merchants, and real sandbox data when it's available."

**Then:** "Thank you, happy to take questions."

---

## Likely questions

| Question | Short answer |
|---|---|
| Is this real NETS data? | No. Everything is synthetic, from our own generator, shaped like real payments. We'd swap in NETS sandbox data through an import script. |
| How do you stop one merchant seeing another's data? | Every database query filters by the merchant from the login session, never from the page address or the AI. The database also refuses records filed under the wrong merchant, and tests check every data function. |
| Does the assistant use AI? | Today it uses rules (no AI needed). AI mode uses Claude with the same read-only tools, so it can't change anything or see other merchants. It needs an API key. |
| How accurate is the check-up? | It compares every daily payout with the payments behind it, and every monthly fee line with the payments' fees. A difference of more than 1 cent is flagged. |
| Why MySQL? | It was a project requirement. Transactions, payouts and invoices are related tables, which suits a relational database. |
| Can it handle more outlets or merchants? | Yes. Every query is indexed by merchant and date, and the outlet menu works for any number of outlets. |
| What about security of logins? | Passwords are hashed (bcrypt), sessions are stored as hashes, cookies are HTTP-only, and failed logins are rate-limited. |
| How do franchises work? | Three tiers: head office (group), franchisee (merchant, has the MID) and outlet. Head office sees every franchisee in its group, view only; it can never pick a franchisee from another group. An outlet manager is locked to one outlet. See `docs/features/franchise.md`. |
| Why is a payment identified by TID + STAN? | The STAN is a 6-digit counter each terminal gives its payments, so it repeats across terminals and restarts after 999999. TID + STAN + date is unique. |
| What would you build next? | See section 10, and `docs/01-project-plan.md` (Phase 1). |

---

## If something goes wrong

| Problem | What to do |
|---|---|
| Venue Wi-Fi is down | Use a phone hotspot. If that fails, switch to the **local copy** (`npm run dev`, http://localhost:3000) or play the **backup video**. |
| The live site shows a database error | The school's Azure server may be down or blocking the venue. Switch to the local copy. |
| "Money in today" is $0.00 | The data was loaded before today's sales. Say "it's early in the day for Ah Hock" and move on; re-seed next time. |
| The check-up takes long | The progress bar shows it's working; keep talking through what it checks. |
| A login fails | Use the other demo button, or the local copy. |

**Backup video:** record the whole script once (Windows: **Win + G** → Record, or **Win + Alt + R**) after a re-seed, and keep it on the laptop desktop.
