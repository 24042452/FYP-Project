import { test, expect } from '@playwright/test'
import { loginWithForm } from './helpers.js'

test('TC-DASH-01: Home shows a headline and no NaN anywhere', async ({ page }) => {
  await loginWithForm(page, 'hawker@demo.local')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  for (const period of ['', '?period=week', '?period=month']) {
    await page.goto(`/${period}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const text = await page.locator('body').innerText()
    expect(text).not.toMatch(/NaN|Infinity|undefined/)
  }
})

test('TC-MOB-01: no sideways scrolling at 375px on Home, Payments, Check-up and Assistant', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await loginWithForm(page, 'retail@demo.local')
  for (const path of ['/', '/transactions', '/reconciliation', '/assistant']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(scrollWidth, `${path} scrollWidth`).toBeLessThanOrEqual(375)
    expect(scrollWidth, `${path} vs viewport`).toBeLessThanOrEqual(innerWidth)
  }
})

test('TC-DASH-02: the health tag opens "How we worked this out" with 3 rows, and Escape closes it', async ({ page }) => {
  await loginWithForm(page, 'hawker@demo.local')
  const tag = page.getByRole('button', { name: /Business health: \d+ · / })
  await expect(tag).toBeVisible()
  await expect(tag).toHaveAttribute('aria-expanded', 'false')
  await tag.click()
  await expect(tag).toHaveAttribute('aria-expanded', 'true')
  const panel = page.getByTestId('health-panel')
  await expect(panel.getByRole('heading', { name: 'How we worked this out' })).toBeVisible()
  await expect(panel.locator('[data-factor]')).toHaveCount(3)
  await expect(panel.getByTestId('health-box')).toHaveCount(5)
  await expect(panel).toBeFocused()
  const vp = page.viewportSize()
  if (vp && vp.width >= 1280) {
    const tiles = await page.getByRole('region', { name: 'Summary' }).boundingBox()
    const box = await panel.boundingBox()
    expect(Math.abs(box.width - tiles.width)).toBeLessThanOrEqual(2)
    expect(Math.abs(box.x - tiles.x)).toBeLessThanOrEqual(2)
  }
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  expect(sw[0]).toBeLessThanOrEqual(sw[1])
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(tag).toHaveAttribute('aria-expanded', 'false')
  await expect(tag).toBeFocused()
})

test('TC-DASH-03: the health panel fits at 375px and the close button works', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await loginWithForm(page, 'retail@demo.local')
  const tag = page.getByRole('button', { name: /Business health: \d+ · / })
  await tag.click()
  const panel = page.getByTestId('health-panel')
  await expect(panel.locator('[data-factor]')).toHaveCount(3)
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth])
  expect(sw[0]).toBeLessThanOrEqual(sw[1])
  await panel.getByRole('button', { name: 'Close' }).click()
  await expect(panel).toBeHidden()
})

test('TC-DASH-04: "in numbers" shows four key numbers and what drove the change, and follows the period', async ({ page }) => {
  await loginWithForm(page, 'hawker@demo.local')
  await page.goto('/?period=month')
  const panel = page.getByTestId('numbers-panel')
  await expect(panel.getByRole('heading', { name: 'This month in numbers' })).toBeVisible()
  for (const label of ['Sales', 'Payments', 'Average sale', 'Didn’t go through']) {
    await expect(panel.getByText(label, { exact: true })).toBeVisible()
  }
  // The month so far always has sales in the demo data, so there is a summary and a bar per payment type.
  await expect(page.getByTestId('numbers-summary')).toContainText(/Sales (rose|fell) \d+\.\d%|Sales are the same/)
  await expect(panel.getByRole('list', { name: 'Change in sales by payment type' }).getByRole('listitem')).not.toHaveCount(0)
  expect(await panel.innerText()).not.toMatch(/NaN|Infinity|100\.0%/)

  await page.goto('/?period=today')
  await expect(panel.getByRole('heading', { name: 'Today in numbers' })).toBeVisible()
})
