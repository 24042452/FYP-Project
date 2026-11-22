import mysql from 'mysql2/promise'
import { randomUUID } from 'node:crypto'

// Children first, so DELETE respects foreign keys.
const TABLES = [
  'recon_exceptions', 'recon_runs', 'notifications', 'invoice_lines', 'invoices',
  'transactions', 'settlements', 'terminals', 'outlets',
  'merchant_users', 'group_users', 'sessions', 'users', 'merchants', 'merchant_groups',
]

async function adminConn() {
  const url = process.env.TEST_DATABASE_ADMIN_URL
  if (!url) throw new Error('TEST_DATABASE_ADMIN_URL is not set')
  return mysql.createConnection({ uri: url })
}

/** Empty every app table in the test database (as the admin user). */
export async function resetTestDb() {
  const conn = await adminConn()
  try {
    for (const t of TABLES) await conn.query(`DELETE FROM \`${t}\``)
  } finally {
    await conn.end()
  }
}

/** @param {string | Date} v */
function utc(v) {
  const iso = v instanceof Date ? v.toISOString() : new Date(v).toISOString()
  return iso.replace('T', ' ').replace('Z', '')
}

/**
 * Insert rows into the test database (as the admin user). Missing fields get defaults.
 * `createdAt` accepts an ISO string or Date and is stored as 'YYYY-MM-DD HH:MM:SS.mmm' UTC.
 * @param {{
 *   merchants?: {id: string, tradingName?: string}[],
 *   transactions?: {id?: string, merchantId: string, channel?: string, status?: string,
 *     amountCents: number, feeCents?: number, createdAt: string | Date, failureCode?: string | null}[],
 * }} fixture
 */
export async function insertFixture({ merchants = [], transactions = [] }) {
  const conn = await adminConn()
  try {
    for (const m of merchants) {
      const name = m.tradingName ?? `Merchant ${m.id.slice(0, 8)}`
      await conn.execute(
        'INSERT INTO merchants (merchant_id, legal_name, trading_name, uen, category) VALUES (?, ?, ?, ?, ?)',
        [m.id, name, name, `UEN${m.id.slice(0, 8)}`, 'F&B'],
      )
    }
    for (const t of transactions) {
      await conn.execute(
        `INSERT INTO transactions
           (transaction_id, merchant_id, channel, status, amount_cents, fee_cents, failure_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          t.id ?? randomUUID(), t.merchantId, t.channel ?? 'nets_qr', t.status ?? 'success',
          t.amountCents, t.feeCents ?? 0, t.failureCode ?? null, utc(t.createdAt),
        ],
      )
    }
  } finally {
    await conn.end()
  }
}

/**
 * Run one statement as the admin user (for fixtures the helpers above do not cover).
 * @param {string} sql
 * @param {any[]} [params]
 */
export async function adminExecute(sql, params = []) {
  const conn = await adminConn()
  try {
    await conn.execute(sql, params)
  } finally {
    await conn.end()
  }
}
