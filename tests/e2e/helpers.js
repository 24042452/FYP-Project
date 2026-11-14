import mysql from 'mysql2/promise'

export const DEMO_PASSWORD = () => {
  const pw = process.env.DEMO_PASSWORD
  if (!pw) throw new Error('DEMO_PASSWORD is not set (it comes from .env.local)')
  return pw
}

/**
 * Log in through the real form.
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 */
export async function loginWithForm(page, email) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(DEMO_PASSWORD())
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/')
}

/**
 * One transaction id that belongs to Tan & Sons Retail (read with the admin database user).
 * @returns {Promise<string>}
 */
export async function retailTransactionId() {
  const url = process.env.DATABASE_ADMIN_URL
  if (!url) throw new Error('DATABASE_ADMIN_URL is not set (it comes from .env.local)')
  const conn = await mysql.createConnection(url)
  try {
    const [rows] = await conn.query(
      `SELECT t.id FROM transactions t JOIN merchants m ON m.id = t.merchant_id
       WHERE m.trading_name LIKE 'Tan & Sons%' LIMIT 1`,
    )
    if (!rows[0]) throw new Error('No Tan & Sons transaction found. Run npm run seed first.')
    return rows[0].id
  } finally {
    await conn.end()
  }
}
