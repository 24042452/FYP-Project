# Alerts (notifications bell)

## What it is for
A bell in the top bar with a red count and a short list of plain-English nudges ("Your sales are up 12% this week", "A payment to your bank is late"). Click one to mark it read and go to the page that explains it.

## Where it lives
- Component: `components/layout/NotificationBell.jsx`; actions: `components/layout/notification-actions.js`
- Rules: `lib/nudges/build.js` (`buildNudges`, pure), time text: `lib/nudges/time.js` (`timeAgo`)
- Loaded in the portal layout: `app/(portal)/layout.jsx`

## Data used
`listNotifications`, `countUnread`, `markRead`, `markAllRead`, `insertNotifications` (`lib/data/notifications.js`), table `notifications`.

## Rules and edge cases
- Nudge kinds: `sales_up` (this week so far at least 10% above the same days last week), `sales_down` (at least 15% below), `failed_payments` (1 or more failed today), `settlement_delay` (any late settlement, using the shared late rule), `invoice_ready` (latest invoice unpaid).
- Sales nudges are like-for-like and need a previous period above zero.
- Bad or missing numbers count as zero, so no nudge shows "NaN".
- Reading is per merchant: `markRead(merchantId, id)` cannot touch another merchant's alert.
- Seeded demo merchants start with 3 alerts each.

## Tests
- Unit: `tests/unit/nudges.test.js`, `nudge-time.test.js`
- Integration: `tests/integration/isolation.test.js` (notification functions)
