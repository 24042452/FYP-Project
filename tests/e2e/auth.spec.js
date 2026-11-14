import { test, expect } from '@playwright/test'
import { loginWithForm, retailTransactionId } from './helpers.js'

// The "DEMO_MODE off" branch of TC-AUTH-03 cannot be tested here (the server's environment is fixed
// for the run). It is covered by tests/integration/demo-login.test.js and tests/unit/login-form.test.jsx.

test('TC-AUTH-01: log in with email and password lands on Home with the merchant name', async ({ page }) => {
  await loginWithForm(page, 'hawker@demo.local')
  await expect(page.getByText(/Good (morning|afternoon|evening), Ah Hock/)).toBeVisible()
  await expect(page.locator('body')).toContainText('Ah Hock Chicken Rice')
})

test('TC-AUTH-01b: a wrong password shows the plain error and stays on the login page', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('hawker@demo.local')
  await page.getByLabel('Password').fill('definitely-not-the-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: /match/ })).toContainText("That email or password doesn't match")
  await expect(page).toHaveURL(/\/login/)
})

test('TC-AUTH-02: another merchant\'s payment is "not found"', async ({ page }) => {
  const id = await retailTransactionId()
  await loginWithForm(page, 'hawker@demo.local')
  await page.goto(`/transactions?id=${id}`)
  await expect(page.getByText("We couldn't find that payment")).toBeVisible()
})

test('TC-AUTH-03: "Try as Tan & Sons" signs in as Tan & Sons Retail (DEMO_MODE on)', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button', { name: /Try as Ah Hock Chicken Rice/ })).toBeVisible()
  await page.getByRole('button', { name: /Try as Tan & Sons Retail/ }).click()
  await page.waitForURL((url) => url.pathname === '/')
  await expect(page.locator('body')).toContainText('Tan & Sons Retail')
})

test('signed-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/transactions')
  await expect(page).toHaveURL(/\/login/)
})
