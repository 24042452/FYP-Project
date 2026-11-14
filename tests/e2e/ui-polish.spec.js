import { test, expect } from '@playwright/test'
import { loginWithForm } from './helpers.js'

const isPhone = (page) => (page.viewportSize()?.width ?? 1280) < 768

test('TC-OUT-01: Tan & Sons picks an outlet and Home and Payments follow it', async ({ page }) => {
  test.skip(isPhone(page), 'the outlet menu sits in the phone menu; covered on desktop')
  await loginWithForm(page, 'retail@demo.local')

  const picker = page.getByLabel('Showing')
  await expect(picker).toBeEnabled()
  await expect(picker.locator('option').first()).toHaveText('All outlets')
  expect(await picker.locator('option').allTextContents()).toEqual(
    expect.arrayContaining(['All outlets', 'Online store', 'Tampines Mall #02-15', 'Bedok Mall #B1-30']),
  )

  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const allText = await page.locator('main').innerText()
  expect(allText).not.toContain('Outlet: ')

  await picker.selectOption({ label: 'Online store' })
  await expect(page.getByTestId('home-outlet')).toHaveText('Outlet: Online store')
  expect(await page.locator('main').innerText()).not.toEqual(allText)
  await expect(picker).toHaveValue(/[0-9a-f-]{36}/)

  await page.goto('/transactions?from=2026-01-01&to=2099-12-31')
  const rows = page.locator('tbody tr')
  await expect(rows.first()).toBeVisible()
  const texts = await rows.allInnerTexts()
  expect(texts.length).toBeGreaterThan(0)
  for (const t of texts) expect(t).toContain('Online store')

  // Pages that cannot be split by outlet say so.
  await page.goto('/settlements')
  await expect(page.getByTestId('all-outlets-note')).toContainText('Showing all outlets: NETS pays and bills Tan & Sons')

  // Back to everything: the note goes, the list has other outlets again.
  await page.getByLabel('Showing').selectOption({ label: 'All outlets' })
  await expect(page.getByTestId('all-outlets-note')).toHaveCount(0)
  await page.goto('/transactions?from=2026-01-01&to=2099-12-31')
  const all = (await page.locator('tbody tr').allInnerTexts()).join('\n')
  expect(all).toMatch(/Tampines Mall|Bedok Mall/)
})

test('TC-OUT-04: on a phone the outlet menu is inside the menu sheet and works', async ({ page }) => {
  test.skip(!isPhone(page), 'phone only')
  await loginWithForm(page, 'retail@demo.local')
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('dialog', { name: 'Menu' }).getByLabel('Showing').selectOption({ label: 'Online store' })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('home-outlet')).toHaveText('Outlet: Online store')
})

test('TC-OUT-02: a made-up outlet cookie and the API both refuse outlets that are not yours', async ({ page, context, baseURL }) => {
  await loginWithForm(page, 'hawker@demo.local')
  await context.addCookies([{ name: 'portal_outlet', value: '00000000-0000-4000-8000-000000000000', url: baseURL }])
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByTestId('home-outlet')).toHaveCount(0)
  const res = await page.request.get('/api/v1/transactions?outlet=00000000-0000-4000-8000-000000000000')
  expect(res.status()).toBe(400)
  expect((await res.json()).error.code).toBe('invalid_params')
})

test('TC-OUT-03: a one-outlet merchant sees the outlet name, not a menu', async ({ page }) => {
  test.skip(isPhone(page), 'desktop sidebar')
  await loginWithForm(page, 'hawker@demo.local')
  await expect(page.getByText('Tampines Round Market')).toBeVisible()
  await expect(page.getByLabel('Showing')).toHaveCount(0)
})

test('TC-LOGOUT-01: a red "Log out" button with words, at desktop and phone size', async ({ page }) => {
  await loginWithForm(page, 'retail@demo.local')
  const btn = page.getByRole('button', { name: 'Log out', exact: true })
  await expect(btn).toBeVisible()
  await expect(btn).toContainText('Log out')
  const box = await btn.boundingBox()
  expect(box.height).toBeGreaterThanOrEqual(44)
  const bg = await btn.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).toBe('rgb(211, 22, 43)')
  if (isPhone(page)) {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.reload()
    const b2 = await btn.boundingBox()
    expect(b2.x + b2.width).toBeLessThanOrEqual(375)
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width)
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
    expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
  }
  await btn.click()
  await page.waitForURL((url) => url.pathname === '/login')
})

test('TC-REC-02: the check-up shows a progress bar while it runs, then the results and how long it took', async ({ page }) => {
  await loginWithForm(page, 'retail@demo.local')
  await page.goto('/reconciliation?month=2026-10')
  await page.getByRole('button', { name: /Run check-up|Check again/ }).click()

  const bar = page.getByRole('progressbar', { name: 'Check-up progress' })
  await expect(bar).toBeVisible()
  await expect(bar).toHaveAttribute('aria-valuemin', '0')
  await expect(bar).toHaveAttribute('aria-valuemax', '100')
  const now = Number(await bar.getAttribute('aria-valuenow'))
  expect(now).toBeGreaterThanOrEqual(0)
  expect(now).toBeLessThanOrEqual(100)
  await expect(page.getByText(/Adding up your sales|Saving your results|Checking your NETS bill|Matching sales|Looking at payments|Your check-up is ready/).first()).toBeVisible()

  await expect(page.getByText(/3 need a look/).first()).toBeVisible()
  await expect(page.getByTestId('checked-in')).toContainText(/Checked in/)
  // The bar goes away again once it has said "Done".
  await expect(bar).toHaveCount(0)
  const stored = await page.evaluate(() => window.localStorage.getItem('checkupDurationMs'))
  expect(Number(stored)).toBeGreaterThan(0)
})
