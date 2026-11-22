# Insights (Analytics)

## What it is for
Shows the patterns in a merchant's sales that Home does not: which days and hours bring in the most money, the trend over 6 months, how customers pay, and (for a business with several outlets) how the outlets compare. Three plain-English findings sit on top, so an owner gets the answer without reading the charts. Layout option A ("findings, then the charts"), picked 23 Nov 2026.

## Where it lives
- Page: `/insights` (`app/(portal)/insights/page.jsx`), `?range=4w|3m|6m` (default `3m`)
- Model: `lib/insights/model.js` (`buildInsightsModel`, `insightDates`, `parseRange`; pure, no database or clock)
- Chart: `components/insights/InsightBars.jsx` (Recharts); payment mix reuses `components/dashboard/ChannelBars.jsx`
- Menu: "Insights · Analytics" under My business (`lib/nav.js`), no longer "Soon"

## Data used
`getDailySales` (6-month trend and the chosen range), `getHeatmap` (hours), `getOutletSales` (new: sales per outlet, every outlet listed with 0 if it sold nothing), all in `lib/data/sales.js` and filtered by the session merchant.

## Rules and edge cases
- **Ranges are whole weeks ending yesterday** (28, 91 or 182 days), so every weekday counts the same number of times and today's half-finished day does not pull averages down.
- **Sales by month** always shows the last 6 full months plus this month so far (striped). The sentence compares the last two full months.
- **Best days:** average sales per weekday. Two days are named together when the second is within 5% of the best ("Fridays and Saturdays are your best days"), with how much more they bring than the other days.
- **Rush hours:** the busiest 3-hour stretch inside the open hours (hours with at least 0.5% of sales), then a second one that does not overlap if it brings at least 15%. A stretch starting 6-8 am, 10 am-12 pm or 4-6 pm is called Breakfast, Lunch or Dinner.
- **Quiet time (a tip):** the slowest 2 hours between the first and last open hour, not counting rush hours, shown only when it brings less than half of an average 2 hours. It suggests a deal to fill it.
- **How customers pay:** each payment type's share of sales in the range, biggest first.
- **Sales by outlet:** only for a business with 2 or more outlets, when "All outlets" is chosen.
- Follows the outlet menu. An outlet manager can open Insights and sees only their outlet. Head office sees the chosen franchisee (read-only, nothing to change here).
- No sales in the range: "Not enough sales yet".
- Charts: one shade of blue, highlighted bars darker; hover or tap shows each bar's value; screen readers get the values as a list. Findings fade up one after another, bars grow in; both are off with reduced motion.

## Tests
- Unit: `tests/unit/insights-model.test.js` (findings, weekday averages, hours, trend, mix, outlets, empty)
- Integration: `tests/integration/isolation.test.js` (`getOutletSales`)
- End-to-end: `tests/e2e/insights.spec.js` (TC-INS-01 findings, charts and range switch; TC-INS-02 outlet comparison; TC-INS-03 outlet manager)
