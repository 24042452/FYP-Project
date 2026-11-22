import { test, expect } from '@playwright/test'
import { loginWithForm } from './helpers.js'

test('TC-INS-01: Insights shows findings and the four charts, and the range can be changed', async ({ page }) => {
  await loginWithForm(page, 'hawker@demo.local')
  await page.goto('/insights')
  await expect(page.getByRole('heading', { name: 'Insights', level: 1 })).toBeVisible()

  const findings = page.getByTestId('insight-findings')
  await expect(findings.getByText(/best days?$/).first()).toBeVisible()
  await expect(findings.getByText(/is your rush/)).toBeVisible()
  for (const id of ['chart-months', 'chart-days', 'chart-hours']) await expect(page.getByTestId(id).locator('svg').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: /How customers pay/ })).toBeVisible()
  // One stall: no outlet comparison.
  await expect(page.getByRole('heading', { name: /Sales by outlet/ })).toHaveCount(0)

  const range = page.getByRole('navigation', { name: 'Time range' })
  await range.getByRole('link', { name: /4 weeks/ }).click()
  await page.waitForURL('**/insights?range=4w')
  await expect(range.getByRole('link', { name: /4 weeks/ })).toHaveAttribute('aria-current', 'true')
})

test('TC-INS-02: a business with several outlets sees them compared', async ({ page }) => {
  await loginWithForm(page, 'retail@demo.local')
  await page.goto('/insights')
  await expect(page.getByRole('heading', { name: /Sales by outlet/ })).toBeVisible()
  await expect(page.getByTestId('outlet-bars').getByRole('listitem')).toHaveCount(3)
})

test('TC-INS-03: an outlet manager sees Insights for their own outlet only', async ({ page }) => {
  await loginWithForm(page, 'kopi.bedok@demo.local')
  await page.goto('/insights')
  await expect(page.getByText(/patterns in your sales at Bedok North #01-30/)).toBeVisible()
  await expect(page.getByRole('heading', { name: /Sales by outlet/ })).toHaveCount(0)
})
