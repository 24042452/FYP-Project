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
      `SELECT t.transaction_id AS id FROM transactions t JOIN merchants m ON m.merchant_id = t.merchant_id
       WHERE m.trading_name LIKE 'Tan & Sons%' LIMIT 1`,
    )
    if (!rows[0]) throw new Error('No Tan & Sons transaction found. Run npm run seed first.')
    return rows[0].id
  } finally {
    await conn.end()
  }
}

/**
 * Put a demo merchant's seeded open dispute (the one with the latest respond-by date) back to `open`,
 * with no answer and no files, so each test starts clean (read and written with the admin database user).
 * @param {string} email a demo login of that merchant
 */
export async function reopenOpenDispute(email) {
  const url = process.env.DATABASE_ADMIN_URL
  if (!url) throw new Error('DATABASE_ADMIN_URL is not set (it comes from .env.local)')
  const conn = await mysql.createConnection(url)
  try {
    const [rows] = await conn.query(
      `SELECT d.dispute_id AS id FROM disputes d JOIN merchant_users mu ON mu.merchant_id = d.merchant_id JOIN users u ON u.user_id = mu.user_id
       WHERE u.email = ? ORDER BY d.respond_by DESC, d.opened_at DESC LIMIT 1`,
      [email],
    )
    if (!rows[0]) throw new Error(`No dispute found for ${email}. Run npm run seed first.`)
    await conn.query('DELETE FROM dispute_files WHERE dispute_id = ?', [rows[0].id])
    await conn.query(
      `UPDATE disputes SET status = 'open', answered_at = NULL, answered_by = NULL, decline_reason = NULL,
         evidence = NULL, note = NULL, decide_by = NULL, decided_at = NULL WHERE dispute_id = ?`,
      [rows[0].id],
    )
  } finally {
    await conn.end()
  }
}
