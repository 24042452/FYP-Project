# REST API (`/api/v1`)

Read-only JSON endpoints for the merchant's own data. They use the same data layer as the portal pages, and the portal itself uses them: the "Show more" button on **Sales & payments** calls `GET /api/v1/transactions`.

This is the first slice of the public API planned in [docs/02-technical-design.md](../02-technical-design.md) section 7.1. API keys and the OpenAPI file come in Phase 1.

## Auth
- Uses the portal **session cookie** (`portal_session`). The merchant always comes from the session, never from the URL or a parameter.
- No cookie, or an expired session: `401` with JSON, never a redirect to the login page:

```json
{ "error": { "code": "signed_out", "message": "Please log in first. This API uses your portal session." } }
```

- Every response has `Cache-Control: private, no-store`.
- Errors always look like `{ "error": { "code", "message" } }`. Bad parameters give `400` with `code: "invalid_params"`. A server problem gives `500` with `code: "server_error"`.

## Conventions
Amounts are integer cents. Instants are ISO 8601 UTC (`2026-11-12T04:00:00.000Z`). Dates are `YYYY-MM-DD` in Singapore time. Field names are `snake_case`.

## `GET /api/v1/transactions`
Payments, newest first.

| Parameter | Meaning |
|---|---|
| `from`, `to` | Singapore dates, inclusive. Send both or neither. Default: the last 7 days |
| `channel` | `nets_qr`, `nets_click`, `enets`, `card`, `sgqr` |
| `status` | `success`, `failed`, `refunded` |
| `q` | Search: an amount like `12.50`, or the start of a payment id or customer reference |
| `limit` | 1 to 100 (default 50) |
| `cursor` | The `next_cursor` from the previous page |

```
GET /api/v1/transactions?status=failed&limit=2
```
```json
{
  "data": [
    {
      "id": "6f0c1e52-...", "created_at": "2026-11-12T04:00:00.000Z",
      "amount_cents": 2000, "fee_cents": 40, "channel": "card", "status": "failed",
      "failure_code": "51", "customer_ref": "VISA4821", "outlet": "Tampines Mall",
      "terminal_serial": "AH-01", "settlement_date": null
    }
  ],
  "next_cursor": "eyJjcmVhdGVkQXQiOi4uLn0"
}
```
`next_cursor` is `null` on the last page. Pages use keyset pagination, so rows do not repeat or skip while new payments arrive.

## `GET /api/v1/settlements`
Money paid to the bank, one row per settlement, newest first.

| Parameter | Meaning |
|---|---|
| `month` | `YYYY-MM` (default: this month) |
| `status` | `paid`, `on_the_way`, `late` |

```json
{
  "month": "2026-11",
  "data": [
    {
      "id": "...", "business_date": "2026-11-10", "channel": "nets_qr",
      "gross_cents": 1000, "fee_cents": 0, "net_cents": 1000,
      "status": "paid", "expected_date": "2026-11-12", "paid_date": "2026-11-12"
    }
  ]
}
```
`status` is `late` when the money was delayed or is still pending past its expected date.

## `GET /api/v1/summary`
Sales so far for a period, compared like for like with the same stretch of the previous period (for example Monday to Thursday this week against Monday to Thursday last week).

| Parameter | Meaning |
|---|---|
| `period` | `today`, `week` (default), `month` |

```json
{
  "period": "week", "from": "2026-11-09", "to": "2026-11-12",
  "compared_with": { "from": "2026-11-02", "to": "2026-11-05" },
  "gross_cents": 70000, "txn_count": 3, "failed_count": 1, "fee_cents": 700,
  "change_pct": -30
}
```
`gross_cents` and `txn_count` count successful payments only. `change_pct` is `null` when the earlier period had no sales.

## Try it
Log in, then in the browser's address bar open `/api/v1/summary?period=week`. From a terminal: `curl http://localhost:3000/api/v1/summary` returns the 401 JSON.

## Code and tests
- Routes: `app/api/v1/*/route.js` (thin); logic in `lib/api/v1.js`; JSON shape in `lib/transactions/api.js`; strict parameter check `validateTxnQuery` in `lib/transactions/params.js`
- Unit: `tests/unit/api-v1.test.js` (401, validation, JSON shape)
- Integration: `tests/integration/api.test.js` (merchant isolation, cursor paging, 400s, summary maths)
- End-to-end: `tests/e2e/api.spec.js` (TC-API-01 401 JSON, TC-API-02 signed-in data and "Show more")
