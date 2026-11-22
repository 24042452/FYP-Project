# ADR-003: Three tiers of access for franchises

- **Status:** Accepted
- **Date:** 2026-11-22
- **Deciders:** Project team, after NETS feedback at the first mock meeting

## Context

NETS pointed out that some merchants are franchises, so owners need three tiers: head office (group), franchisee (merchant) and outlet. Until now a user belonged to merchants through `merchant_users` and saw one whole merchant. Merchant isolation relies on every data function filtering by one merchant id from the session.

## Decision

1. Add `merchant_groups` and a nullable `merchants.group_id` (independent merchants have none).
2. Head office access is a separate link table, `group_users (group_id, user_id, role='hq_owner')`, not extra rows in `merchant_users`. A franchise that adds a franchisee does not have to grant every HQ user again.
3. Outlet managers are a `merchant_users` row with `role='outlet_manager'` and an `outlet_id`. The composite foreign key `(outlet_id, merchant_id) -> outlets` makes sure the outlet belongs to that merchant.
4. **Isolation stays per merchant.** Head office does not get "group" queries across merchants. Instead the session resolves to one franchisee at a time (chosen in a menu, checked against the HQ user's own group on every request), and the group overview calls the normal per-merchant data functions once per franchisee. No new SQL reads more than one merchant.
5. Head office is view only in the MVP: the check-up actions refuse to run.
6. Outlet managers only open pages that follow the outlet (Home, Sales & payments). Whole-business pages redirect to Home, and the API answers 403 or filters to their outlet.

## Consequences

- One rule set (`lib/access/rules.js`) decides the tier, the menu (`navFor`) and page access (`canOpen`), so the menu and the guards cannot drift apart.
- The group overview runs about six small queries per franchisee. That is fine for the demo (3 franchisees). A large franchise would need a group-level summary table or a cached job (Phase 2).
- Later: HQ write access (with maker-checker), more than one group per user, and outlet-level users for non-franchise merchants all fit this model.
