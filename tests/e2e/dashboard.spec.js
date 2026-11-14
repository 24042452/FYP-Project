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
  await expect(panel.getByTestId('health-factor')).toHaveCount(3)
  await expect(panel).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(tag).toHaveAttribute('aria-expanded', 'false')
  await expect(tag).toBeFocused()
})
