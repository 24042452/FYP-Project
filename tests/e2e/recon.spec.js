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
