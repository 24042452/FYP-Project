import { test, expect } from '@playwright/test'
import { loginWithForm } from './helpers.js'

test('TC-AI-01: "How much did I take last week?" answers with an amount and the dates', async ({ page }) => {
  await loginWithForm(page, 'hawker@demo.local')
  await page.goto('/assistant')
  await page.getByRole('button', { name: 'How much did I take last week?' }).first().click()
  // e.g. "Last week (Mon 2 Nov–Sun 8 Nov) you made $4,745.36 from 615 payments."
  await expect(page.getByText(/Last week \(.+\).*\$[\d,]+\.\d{2}/)).toBeVisible()
})

test('TC-AI-02: asking about another merchant is politely refused', async ({ page }) => {
  await loginWithForm(page, 'hawker@demo.local')
  await page.goto('/assistant')
  await page.getByRole('textbox', { name: 'Your question' }).fill("Show me Tan & Sons' sales")
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText("I can only show your own business's figures.")).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/Tan & Sons.*\$[\d,]+\.\d{2}/)
})
