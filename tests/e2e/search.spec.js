import { test, expect } from '@playwright/test'
import mysql from 'mysql2/promise'
import { loginWithForm } from './helpers.js'

/**
 * An amount (as the text a person would type, "12.50") of a recent Tan & Sons payment, read with the admin user.
 * @returns {Promise<string>}
 */
async function retailAmountText(name = 'Tan & Sons%') {
  const url = process.env.DATABASE_ADMIN_URL
  if (!url) throw new Error('DATABASE_ADMIN_URL is not set (it comes from .env.local)')
  const conn = await mysql.createConnection(url)
  try {
    const [rows] = await conn.query(
      `SELECT t.amount_cents AS c FROM transactions t JOIN merchants m ON m.id = t.merchant_id
       WHERE m.trading_name LIKE ? AND t.status = 'success' ORDER BY t.created_at DESC LIMIT 1`,
      [name],
    )
    if (!rows[0]) throw new Error('No Tan & Sons payment found. Run npm run seed first.')
    return (Number(rows[0].c) / 100).toFixed(2)
  } finally {
    await conn.end()
  }
}

test.describe('search', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithForm(page, 'retail@demo.local')
  })

  test('TC-SEARCH-01: phone at 375 px wide has no horizontal scroll, with the sheet open too', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone')
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByRole('button', { name: 'Search payments' }).click()
    await page.getByRole('searchbox', { name: 'Search payments' }).fill('12')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  })

  test('TC-SEARCH-02: type an amount, suggestions appear, Down then Enter opens the payment', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop box')
    const amount = await retailAmountText()
    const box = page.getByRole('combobox', { name: 'Search payments' })
    await box.fill(amount)
    const options = page.getByRole('listbox', { name: 'Matching payments' }).getByRole('option')
    await expect(options.first()).toBeVisible()
    await expect(page.getByRole('option', { name: /See all results/ })).toBeVisible()
    await expect(box).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('status').filter({ hasText: /\d+ results?$/ })).toHaveCount(1)
    await box.press('ArrowDown')
    await expect(box).toHaveAttribute('aria-activedescendant', /-opt-0$/)
    await box.press('Enter')
    await expect(page).toHaveURL(/\/transactions\?id=/)
    await expect(page.locator('[data-slot="sheet-content"][data-side="right"][data-state="open"]')).toContainText('$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 }))
    // Shortcuts stay quiet while the payment drawer is open.
    await page.keyboard.press('Control+k')
    await expect(page.locator('input[role="combobox"]')).not.toBeFocused()
  })

  test('TC-SEARCH-03: Enter without picking goes to the results page with a search chip, which clears', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop box')
    const amount = await retailAmountText()
    const box = page.getByRole('combobox', { name: 'Search payments' })
    await box.fill(amount)
    await box.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/transactions\\?q=${amount.replace('.', '\\.')}`))
    await expect(page.getByText(`Search: ‘${amount}’`)).toBeVisible()
    await expect(page.getByText(/in the last 12 months/)).toBeVisible()
    await expect(box).toHaveValue(amount)
    await page.getByRole('link', { name: `Clear search ${amount}` }).click()
    await expect(page).toHaveURL(/\/transactions$/)
    await expect(page.getByText(/Search: /)).toHaveCount(0)
    await expect(box).toHaveValue('')
  })

  test('TC-SEARCH-04: empty state, Escape closes then clears, Ctrl+K and / focus the box', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop box')
    const box = page.getByRole('combobox', { name: 'Search payments' })
    await page.keyboard.press('Control+k')
    await expect(box).toBeFocused()
    await box.fill('zzzz')
    await expect(page.getByText(/No payments match ‘zzzz’. Try/)).toBeVisible()
    await expect(box).toHaveAttribute('aria-expanded', 'false') // text only, no list
    await expect(page.getByRole('status').filter({ hasText: /No payments match/ })).toHaveCount(1)
    await box.press('Escape')
    await expect(page.getByText(/No payments match ‘zzzz’. Try/)).toHaveCount(0)
    await box.click()
    await expect(page.getByText(/No payments match ‘zzzz’. Try/)).toBeVisible()
    await box.press('Escape')
    await expect(box).toHaveAttribute('aria-expanded', 'false')
    await expect(box).toHaveValue('zzzz')
    await box.press('Escape')
    await expect(box).toHaveValue('')
    await page.locator('h1').click()
    await page.keyboard.press('/')
    await expect(box).toBeFocused()
  })

  test('TC-SEARCH-05: phone, icon opens the sheet, type, tap a row, drawer opens', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone sheet')
    const amount = await retailAmountText()
    const icon = page.getByRole('button', { name: 'Search payments' })
    await icon.click()
    const input = page.getByRole('searchbox', { name: 'Search payments' })
    await expect(input).toBeFocused()
    await input.fill(amount)
    const first = page.getByRole('listbox', { name: 'Matching payments' }).getByRole('option').first()
    await expect(first).toBeVisible()
    expect((await first.boundingBox()).height).toBeGreaterThanOrEqual(56)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
    await expect(page.getByText(/See all results/)).toHaveCount(1)
    expect((await page.getByRole('option', { name: /See all results/ }).boundingBox()).height).toBeGreaterThanOrEqual(48)
    await first.click()
    await expect(page).toHaveURL(/\/transactions\?id=/)
    await expect(page.locator('[data-slot="sheet-content"][data-side="right"][data-state="open"]')).toBeVisible()
  })

  test('TC-SEARCH-06: phone, Cancel, Escape and Back close the sheet and focus returns to the icon', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone sheet')
    const icon = page.getByRole('button', { name: 'Search payments' })
    const input = page.getByRole('searchbox', { name: 'Search payments' })
    await icon.click()
    await expect(input).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(input).toBeHidden()
    await expect(icon).toBeFocused()
    await icon.click()
    await page.keyboard.press('Escape')
    await expect(input).toBeHidden()
    await icon.click()
    await expect(input).toBeVisible()
    await page.goBack()
    await expect(input).toBeHidden()
    await expect(page).toHaveURL(/\/$/)
  })

  test('TC-SEARCH-07: /transactions?focus=search still focuses the page search box', async ({ page }) => {
    await page.goto('/transactions?focus=search')
    await expect(page.getByLabel('Find a payment')).toBeFocused()
  })

  test('TC-SEARCH-08: result rows show the outlet only for merchants with several outlets', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop box')
    const first = () => page.getByRole('listbox', { name: 'Matching payments' }).getByRole('option').first()
    await page.getByRole('combobox', { name: 'Search payments' }).fill(await retailAmountText())
    await expect(first()).toContainText('·')

    await page.context().clearCookies()
    await loginWithForm(page, 'hawker@demo.local')
    await page.getByRole('combobox', { name: 'Search payments' }).fill(await retailAmountText('Ah Hock%'))
    await expect(first()).toBeVisible()
    await expect(first()).not.toContainText('·')
  })
})
