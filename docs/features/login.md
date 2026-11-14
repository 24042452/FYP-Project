# Login

## What it is for
Lets a merchant sign in with their email and password. For demos, one-click "Try as…" buttons sign in as a sample business without typing anything.

## Where it lives
- Page: `/login` (`app/login/page.jsx`, form in `app/login/LoginForm.jsx`)
- Actions: `app/login/actions.js` (`signIn`, `signInAsDemo`, `signOut`)
- Logic: `lib/auth/login.js` (`checkCredentials`, `checkDemo`), `lib/auth/session.js`, `lib/auth/password.js`, `lib/auth/rate-limit.js`
- Gate: `middleware.js` sends signed-out visitors to `/login`; `getCurrentMerchant()` in `lib/data/merchant.js` is the real session check

## Data used
`users`, `sessions`, `merchants` (via `findUserByEmail`, `createSessionRecord`, `findSessionUser`, `findMerchantForUser`).

## Rules and edge cases
- Passwords are bcrypt hashes. The session token is 32 random bytes in an HTTP-only cookie (`portal_session`); only its SHA-256 hash is stored. Sessions last 8 hours.
- Same error text ("That email or password doesn't match") for an unknown email, a wrong password and a rate-limited email. An unknown email still costs one bcrypt check, so timing does not give it away.
- Rate limit: 5 failed logins per email per 15 minutes. The counts live in memory (reset on restart; per instance on Vercel). Documented limitation.
- Demo buttons appear only when `DEMO_MODE=true`, read on the server. `checkDemo` refuses otherwise. The demo password (`DEMO_PASSWORD`) stays on the server, and demo sign-in is not blocked by, or counted in, the form's rate limit.
- Signed-in portal pages are sent with `Cache-Control: private, no-store`, so the back button after sign-out shows nothing.
- The merchant always comes from the session, never from the address.

## Tests
- Unit: `tests/unit/password.test.js`, `rate-limit.test.js`, `login-form.test.jsx` (no demo buttons when demo mode is off)
- Integration: `tests/integration/auth.test.js`, `demo-login.test.js`
- End-to-end: `tests/e2e/auth.spec.js` (TC-AUTH-01, 01b, 02, 03)
