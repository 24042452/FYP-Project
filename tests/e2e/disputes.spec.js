import { test, expect } from '@playwright/test'
import { loginWithForm, reopenOpenDispute } from './helpers.js'

// 1x1 transparent PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

test.beforeEach(async () => {
  await reopenOpenDispute('hawker@demo.local')
  await reopenOpenDispute('retail@demo.local')
})

async function openDeclineForm(page) {
  await page.goto('/disputes')
  await expect(page.getByText(/1 dispute needs your answer/)).toBeVisible()
  await page.getByRole('button', { name: 'Decline', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tell NETS why the payment was right' })).toBeVisible()
}

test('TC-DSP-01: decline a dispute with proof and a photo', async ({ page }) => {
  await loginWithForm(page, 'hawker@demo.local')
  await openDeclineForm(page)
  await page.getByLabel('The customer paid only once. I can show the one payment.').check()
  await page.getByLabel('Receipt or order slip').check()
  await page.locator('input[type=file]').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByText('receipt.png')).toBeVisible()
  await page.getByRole('button', { name: 'Send my answer to NETS' }).click()
  await expect(page.getByText('Waiting for NETS').first()).toBeVisible()
  await expect(page.getByText('1 file sent')).toBeVisible()
})

test('TC-DSP-02: accept a dispute and refund the customer', async ({ page }) => {
  await loginWithForm(page, 'retail@demo.local')
  await page.goto('/disputes')
  await page.getByRole('button', { name: /^Accept and refund/ }).click()
  await page.getByRole('button', { name: 'Yes, accept' }).click()
  await expect(page.getByText('Accepted, refunded').first()).toBeVisible()
})

test('TC-DSP-03: an accountant can look but not answer', async ({ page }) => {
  await loginWithForm(page, 'retail.accounts@demo.local')
  await page.goto('/disputes')
  await expect(page.getByText(/You can look but not answer\./)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Decline', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Accept and refund/ })).toHaveCount(0)
})

test('TC-DSP-04: a file over 2 MB is refused and nothing is sent', async ({ page }) => {
  await loginWithForm(page, 'hawker@demo.local')
  await openDeclineForm(page)
  await page.getByLabel('The customer paid only once. I can show the one payment.').check()
  await page.getByLabel('Receipt or order slip').check()
  const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(3 * 1024 * 1024, 0x20)])
  await page.locator('input[type=file]').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: big })
  await page.getByRole('button', { name: 'Send my answer to NETS' }).click()
  await expect(page.getByText(/Files can be up to 2 MB\./)).toBeVisible()
  await expect(page.locator('[data-testid=dispute-case][data-status=open]')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Send my answer to NETS' })).toBeVisible()
})

test('TC-DSP-05: the open form does not scroll sideways on a phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iPhone 13', 'phone only')
  await loginWithForm(page, 'hawker@demo.local')
  await openDeclineForm(page)
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(390)
})
