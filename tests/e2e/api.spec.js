import { test, expect } from '@playwright/test'
import { loginWithForm } from './helpers.js'

test('TC-API-01: /api/v1 answers 401 JSON without a session (never a redirect)', async ({ request }) => {
  for (const path of ['/api/v1/summary?period=week', '/api/v1/transactions', '/api/v1/settlements']) {
    const res = await request.get(path, { maxRedirects: 0 })
    expect(res.status(), path).toBe(401)
    expect((await res.json()).error.code).toBe('signed_out')
    expect(res.headers()['cache-control']).toBe('private, no-store')
  }
})

test('TC-API-02: a signed-in merchant gets their own data, and "Show more" uses the API', async ({ page }) => {
  await loginWithForm(page, 'retail@demo.local')
  const res = await page.request.get('/api/v1/summary?period=week')
  expect(res.status()).toBe(200)
  const s = await res.json()
  expect(Number.isInteger(s.gross_cents)).toBe(true)
  expect((await page.request.get('/api/v1/transactions?limit=0')).status()).toBe(400)

  await page.goto('/transactions?from=2026-05-01&to=2026-11-14')
  const more = page.getByRole('button', { name: 'Show more' })
  await expect(more).toBeVisible()
  const [apiCall] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/v1/transactions') && r.url().includes('cursor=')),
    more.click(),
  ])
  expect(apiCall.status()).toBe(200)
  await expect(page.getByText(/Showing 1\d\d payments/)).toBeVisible()
})
