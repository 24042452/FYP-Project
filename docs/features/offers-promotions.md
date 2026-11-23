# Offers & Promotions

## What it is for
Two pages in the "Grow" part of the menu. **Promotions** (`/campaigns`, sub-label "Marketing campaigns") are ready-made deals NETS shows to the merchant's customers when they pay. **Offers** (`/offers`) are deals from NETS and its partners for the business (lower fees, equipment, partner discounts). The merchant takes one up, stops a promotion, and sees what a finished promotion did, all without leaving the page. Layout option A (cards with filter chips), picked 24 Nov 2026. Built by Lai Wei Jun Samuel.

## Where it lives
- Pages: `app/(portal)/campaigns/page.jsx` and `app/(portal)/offers/page.jsx`; server actions in `actions.js` next to each (`startPromotionAction`, `stopPromotionAction`, `takeUpOfferAction`)
- Components: `components/promotions/` (`PromotionsBoard`, `PromotionCards`, `RunningCard`, `ResultsTable`, `FilterChips`, `TakeUpPanel`, `SidePanel`, `OutletPicker`) and `components/offers/` (`OffersBoard`, `OfferCards`, `OfferPanel`)
- Rules and sample content: `lib/promotions/` and `lib/offers/` (`catalogue.js`, `rules.js`, `view.js`)
- Data: `lib/data/promotions.js` and `lib/data/offers.js` (every query filters by the session merchant, and by outlet for an outlet manager)

## How it works
- **Take up** opens a slide-out panel from the right. Clicking outside, Esc or × closes it and nothing is started. The panel shows the dates, a short note, and the outlets.
- **Outlet picker.** "Select all outlets that can run it" plus one tick box per outlet; outlets that can run it start ticked. A busy outlet is greyed out with the reason, for example `Already running "10% off on Tuesdays" (NETS QR) until Mon 15 Dec`. An online outlet on an in-store promotion shows "Online only". A physical outlet on an online promotion shows "Not an online outlet". The picker is hidden for a business with one outlet and for an outlet manager (the panel says "at your outlet").
- The panel's main button says "Start at 2 outlets", "Start at 1 outlet" or "Start promotion", and is off with "Pick at least one outlet." when none are ticked.

### Promotions
- A promotion runs **4 weeks, starting tomorrow**.
- **One running or scheduled promotion per payment type per outlet.** This is enforced on the server in a locked transaction, so two quick requests cannot both get in.
- **Stop** asks inline first. A scheduled promotion is removed. A running one stops today and moves to Results.
- **Results** compare the average sales per promotion day (for the promotion's payment type, days and hours, at its outlets) with the same weekdays in the 28 days before. Within plus or minus 2% it says "About the same". A promotion that ran under 7 days, or has no earlier days to compare with, says "Too short to compare". Results are labelled as an estimate.

### Offers
- A catalogue grouped by kind (lower fees, equipment, partner deals), picked for the business category (F&B or Retail). Every offer carries a "Sample offer" tag.
- Several offers can be active at once. The same offer cannot be taken up twice at one outlet while it is active. Dates far ahead show the year.

## Who can do what
- **Owner and outlet manager** can take up and stop. An outlet manager can act only for their own outlet, and can stop a promotion only if it runs at their outlet alone. For a shared one the page says "Only the owner can stop a promotion that runs at more than one outlet."
- **Accountant, manager, cashier and head office** can look only. There are no buttons and a short note says why.
- All of this is checked on the server, not just hidden in the page.

## Data model
Migration `0010`: `promotion_runs`, `promotion_run_outlets`, `offer_takeups`, `offer_takeup_outlets`, and `outlets.is_online`. Composite keys (id, merchant_id) keep every row inside one merchant. Seed adds, per business, 2 finished promotions (with a small sales lift on their days so results look believable), 1 running promotion ("10% off on Tuesdays"; Tan & Sons at Tampines Mall only, so its outlet list shows a busy, an unsuitable and a free outlet) and 1 offer taken up ("0.5% off NETS QR fees"). The extra lift payments do not change the October check-up (still 3 problems).

## Known simplifications
- Taking up an offer does not change fees or bills.
- A discount does not change recorded payment amounts.
- Nothing is delivered to real customers (NETS app or terminal screen).
- No bell alerts for offers or promotions.
- Offers cannot be stopped; they end on their own date.

## Assumptions to confirm with NETS
- **4 weeks** as the fixed length of a promotion.
- How NETS would actually show a promotion to customers when they pay.
- The real terms of offers (rates, length, who qualifies). The offers here are sample content with no real partner names.

## Tests
- Unit and integration: catalogues, status and eligibility rules, answer sentences, results maths, isolation for every data function, outlet manager scope, overlap refused (including a race), stop rules, results use only the run's outlets, payment type, days and hours
- End-to-end `tests/e2e/promotions.spec.js`: TC-PRO-01 owner takes up a promotion at all outlets; TC-PRO-02 busy and unsuitable outlets disabled, clicking outside starts nothing; TC-PRO-03 stop a running and a scheduled promotion; TC-PRO-04 outlet manager sees only their outlet; TC-PRO-05 accountant looks only; TC-OFF-01 owner takes up an offer; TC-PRO-06 no sideways scroll with the panel open (phone)
