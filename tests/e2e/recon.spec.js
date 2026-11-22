import { test, expect } from '@playwright/test'
import { loginWithForm } from './helpers.js'

test('TC-REC-01 and TC-EXP-01: run the October check-up, then download it as Excel', async ({ page }) => {
  await loginWithForm(page, 'retail@demo.local')
  await page.goto('/reconciliation?month=2026-10')

  // First run says "Run check-up"; later runs say "Check again". Both start a new run.
  await page.getByRole('button', { name: /Run check-up|Check again/ }).click()
  await expect(page.getByText(/3 need a look/).first()).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download Excel' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
})

test('TC-EXP-01b: the Reports page offers a payments Excel file', async ({ page }) => {
  await loginWithForm(page, 'hawker@demo.local')
  await page.goto('/reports')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Payments (Excel)' }).first().click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^payments-.*\.xlsx$/)
})

test('TC-REC-03: a problem opens step-by-step help with the details NETS needs', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await loginWithForm(page, 'retail@demo.local')
  await page.goto('/reconciliation?month=2026-10')
  await page.getByRole('button', { name: /Run check-up|Check again/ }).click()
  // Wait for the new run's result page, so the cards are not swapped while we use them.
  await page.waitForURL(/run=/)
  await expect(page.getByText(/3 need a look/).first()).toBeVisible()

  const guide = page.getByTestId('fix-guide').first()
  const bar = guide.getByRole('button', { name: 'How to fix this' })
  await expect(bar).toHaveAttribute('aria-expanded', 'false')
  await bar.click()
  await expect(bar).toHaveAttribute('aria-expanded', 'true')
  await expect(guide.getByText('Why this happens:')).toBeVisible()
  await expect(guide.getByText('Still short? Contact NETS')).toBeVisible()
  await expect(guide.getByText('110000000020002')).toBeVisible()

  await guide.getByRole('button', { name: 'Copy details' }).click()
  await expect(guide.getByRole('button', { name: 'Copied ✓' })).toBeVisible()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain('Merchant ID (MID): 110000000020002')
  expect(copied).toContain('Difference: −$')
})
