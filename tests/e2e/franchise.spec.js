import { test, expect } from '@playwright/test'
import { DEMO_PASSWORD, loginWithForm } from './helpers.js'

const isPhone = (page) => (page.viewportSize()?.width ?? 1280) < 768

/** Head office lands on the group overview, not Home. */
async function loginAsHq(page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('kopi.hq@demo.local')
  await page.getByLabel('Password').fill(DEMO_PASSWORD())
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/group')
}

test('TC-FR-01: head office sees every franchisee, opens one, and can only look', async ({ page }) => {
  await loginAsHq(page)
  await expect(page.getByTestId('group-headline')).toContainText('Kopi Corner made $')
  const list = page.getByTestId('franchisee-list')
  for (const name of ['Kopi Corner East', 'Kopi Corner West', 'Kopi Corner North']) {
    await expect(list.getByText(name, { exact: true })).toBeVisible()
  }
  await expect(list.getByText('Healthy')).toBeVisible() // North has no problems

  await page.getByRole('button', { name: 'Open Kopi Corner West' }).click()
  await page.waitForURL((url) => url.pathname === '/')
  await expect(page.getByTestId('view-only-banner')).toContainText('Kopi Corner West')

  await page.goto('/reconciliation')
  await expect(page.getByTestId('view-only')).toBeVisible()
  await expect(page.getByRole('button', { name: /Run check-up|Check again/ })).toHaveCount(0)
})

test('TC-FR-02: head office switches franchisee from the menu', async ({ page }) => {
  test.skip(isPhone(page), 'the franchisee menu sits in the phone menu; covered on desktop')
  await loginAsHq(page)
  const menu = page.getByLabel('Kopi Corner · Franchisee')
  await expect(menu).toHaveValue('overview')
  await menu.selectOption({ label: 'Kopi Corner North' })
  await page.waitForURL((url) => url.pathname === '/')
  await expect(page.getByTestId('view-only-banner')).toContainText('Kopi Corner North')
  await menu.selectOption({ label: 'Whole group (overview)' })
  await page.waitForURL((url) => url.pathname === '/group')
})

test('TC-FR-03: a franchisee owner sees only their business, and no group overview', async ({ page }) => {
  await loginWithForm(page, 'kopi.east@demo.local')
  await expect(page.getByTestId('view-only-banner')).toHaveCount(0)
  await page.goto('/group')
  await page.waitForURL((url) => url.pathname === '/')
  await page.goto('/reconciliation')
  await expect(page.getByRole('button', { name: /Run check-up|Check again/ })).toBeVisible()
})

test('TC-FR-04: an outlet manager is locked to one outlet and cannot open whole-business pages', async ({ page }) => {
  await loginWithForm(page, 'kopi.bedok@demo.local')
  await expect(page.getByTestId('home-outlet')).toHaveText('Outlet: Bedok North #01-30')
  for (const path of ['/settlements', '/reconciliation', '/invoices', '/reports', '/assistant', '/group']) {
    await page.goto(path)
    await page.waitForURL((url) => url.pathname === '/')
  }
  const api = await page.request.get('/api/v1/settlements')
  expect(api.status()).toBe(403)
  const txns = await page.request.get('/api/v1/transactions')
  const outlets = new Set((await txns.json()).data.map((t) => t.outlet))
  expect([...outlets]).toEqual(['Bedok North #01-30'])
})
