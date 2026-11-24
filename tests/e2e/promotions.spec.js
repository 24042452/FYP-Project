import { test, expect } from '@playwright/test'
import { loginWithForm, resetPromotions } from './helpers.js'

test.beforeEach(async () => {
  for (const email of ['retail@demo.local', 'kopi.east@demo.local']) await resetPromotions(email)
})

const isPhone = (page) => (page.viewportSize()?.width ?? 1280) < 640

async function closePanel(page) {
  if (isPhone(page)) await page.getByRole('button', { name: /Close/ }).click()
  else await page.mouse.click(10, 300)
}

test('TC-PRO-01: owner takes up a promotion at all outlets', async ({ page }) => {
  await loginWithForm(page, 'retail@demo.local')
  await page.goto('/campaigns')
  await page.getByRole('button', { name: 'Take up 10% off weekends with Cards' }).click()
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()
  await panel.getByLabel('Select all outlets that can run it').check()
  await panel.getByRole('button', { name: /^Start at \d+ outlets?$/ }).click()
  await expect(panel).toBeHidden()
  const card = page.getByTestId('running-card').filter({ hasText: '10% off weekends with Cards' })
  await expect(card).toBeVisible()
  await expect(card.getByText('Starts tomorrow')).toBeVisible()
})

test('TC-PRO-02: busy and unsuitable outlets are disabled; clicking outside starts nothing', async ({ page }) => {
  await loginWithForm(page, 'retail@demo.local')
  await page.goto('/campaigns')
  const before = await page.getByTestId('running-card').count()
  await page.getByRole('button', { name: 'Take up 10% off on Tuesdays' }).click()
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()
  const tampines = panel.getByTestId('outlet-choice').filter({ hasText: 'Tampines Mall' })
  await expect(tampines.getByRole('checkbox')).toBeDisabled()
  await expect(tampines).toContainText(/Already running "10% off on Tuesdays" \(NETS QR\) until .+/)
  const online = panel.getByTestId('outlet-choice').filter({ hasText: 'Online only' })
  await expect(online.getByRole('checkbox')).toBeDisabled()
  const bedok = panel.getByTestId('outlet-choice').filter({ hasText: 'Bedok Mall' })
  await expect(bedok.getByRole('checkbox')).toBeChecked()
  await closePanel(page)
  await expect(panel).toBeHidden()
  await expect(page.getByTestId('running-card')).toHaveCount(before)
})

test('TC-PRO-03: stopping a running promotion removes it from Running now; a scheduled one too', async ({ page }) => {
  await loginWithForm(page, 'retail@demo.local')
  await page.goto('/campaigns')
  const tuesday = page.getByTestId('running-card').filter({ hasText: '10% off on Tuesdays' })
  await tuesday.getByRole('button', { name: 'Stop', exact: true }).click()
  await expect(tuesday.getByText(/Stop this promotion\?/)).toBeVisible()
  await tuesday.getByRole('button', { name: 'Yes, stop' }).click()
  await expect(page.getByTestId('promotions-status')).toContainText(/stop/i)
  await expect(page.getByTestId('running-card').filter({ hasText: '10% off on Tuesdays' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('running-card').filter({ hasText: '10% off on Tuesdays' })).toHaveCount(0)
  const resultRow = page
    .getByRole('region', { name: /Results/ })
    .locator('tr, li')
    .filter({ hasText: '10% off on Tuesdays' })
    .filter({ hasText: 'Too short to compare' })
    .locator('visible=true')
  await expect(resultRow).toHaveCount(1)

  // A scheduled promotion: take it up, then stop it.
  await page.getByRole('button', { name: 'Take up 10% off weekends with Cards' }).click()
  const panel = page.getByRole('dialog')
  await panel.getByLabel('Select all outlets that can run it').check()
  await panel.getByRole('button', { name: /^Start at \d+ outlets?$/ }).click()
  const weekend = page.getByTestId('running-card').filter({ hasText: '10% off weekends with Cards' })
  await expect(weekend.getByText('Starts tomorrow')).toBeVisible()
  await weekend.getByRole('button', { name: 'Stop', exact: true }).click()
  await weekend.getByRole('button', { name: 'Yes, stop' }).click()
  await expect(page.getByTestId('running-card').filter({ hasText: '10% off weekends with Cards' })).toHaveCount(0)
})

test('TC-PRO-04: outlet manager sees only their outlet and no outlet list', async ({ page }) => {
  await loginWithForm(page, 'kopi.bedok@demo.local')
  await page.goto('/campaigns')
  await page.getByRole('button', { name: /^Take up / }).first().click()
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('at your outlet')
  await expect(panel.getByTestId('outlet-choice')).toHaveCount(0)
  await expect(panel.getByText('Which outlets?')).toHaveCount(0)
  await expect(panel.getByRole('button', { name: 'Start promotion' })).toBeVisible()
  await closePanel(page)
  await expect(panel).toBeHidden()
  // The page itself is scoped to Bedok, and each running card speaks of "this outlet".
  await expect(page.getByRole('main')).toContainText('Bedok')
  for (const card of await page.getByTestId('running-card').all()) {
    await expect(card).toContainText('This outlet')
  }
})

test('TC-PRO-05: accountant can look but not start or stop', async ({ page }) => {
  await loginWithForm(page, 'retail.accounts@demo.local')
  await page.goto('/campaigns')
  await expect(page.getByTestId('view-only-note')).toContainText('You can look but not start promotions')
  await expect(page.getByRole('button', { name: /^Take up / })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0)
})

test('TC-OFF-01: owner takes up an offer', async ({ page }) => {
  await loginWithForm(page, 'retail@demo.local')
  await page.goto('/offers')
  await page.getByRole('button', { name: 'Take up Free NETS QR standee' }).click()
  const panel = page.getByRole('dialog')
  await expect(panel).toBeVisible()
  await panel.getByLabel('Select all outlets that can take it').check()
  await panel.getByRole('button', { name: /^Take up at \d+ outlets?$/ }).click()
  await expect(panel).toBeHidden()
  const mine = page.getByTestId('your-offer').filter({ hasText: 'Free NETS QR standee' })
  await expect(mine).toBeVisible()
  await expect(mine).toContainText(/Active until/)
  await expect(page.getByTestId('offers-status')).toContainText(/until/)
})

test('TC-PRO-06: no sideways scroll with the panel open (phone)', async ({ page }) => {
  test.skip(!isPhone(page), 'phone only')
  await loginWithForm(page, 'retail@demo.local')
  await page.goto('/campaigns')
  await page.getByRole('button', { name: 'Take up 10% off on Tuesdays' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(wide).toBe(false)
  const panelWide = await page.getByRole('dialog').evaluate((el) => el.scrollWidth > el.clientWidth)
  expect(panelWide).toBe(false)
})
