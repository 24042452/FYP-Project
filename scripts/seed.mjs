// Loads the two demo merchants (synthetic data) into the database. Usage: npm run seed
// Idempotent: each merchant is deleted (cascade) and re-inserted in one transaction.
import mysql from 'mysql2/promise'
import { generateDataset } from '../lib/synthetic/generate.js'
import { trimFuture } from '../lib/synthetic/trim.js'
import { hashPassword } from '../lib/auth/password.js'
import { sgtDate } from '../lib/dates.js'

const START = '2026-05-01'
const BATCH = 1000

const DEMOS = [
  {
    profile: 'hawker',
    seed: 1001,
    merchantId: '11111111-1111-4111-8111-111111111111',
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'hawker@demo.local',
    userName: 'Ah Hock',
    legal_name: 'Ah Hock Chicken Rice',
    trading_name: 'Ah Hock Chicken Rice',
    uen: 'T26LL0001A',
    category: 'F&B',
    gst: 0,
    serialPrefix: 'AH',
  },
  {
    profile: 'retail',
    seed: 2002,
    merchantId: '22222222-2222-4222-8222-222222222222',
    userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    email: 'retail@demo.local',
    userName: 'Mr Tan',
    legal_name: 'Tan & Sons Retail Pte Ltd',
    trading_name: 'Tan & Sons Retail',
    uen: '202612345K',
    category: 'Retail',
    gst: 1,
    serialPrefix: 'TS',
  },
]

/** ISO UTC -> 'YYYY-MM-DD HH:MM:SS.mmm' */
const dt = (iso) => iso.replace('T', ' ').replace('Z', '')

async function bulk(conn, table, columns, rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await conn.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ?`, [rows.slice(i, i + BATCH)])
  }
}

async function seedMerchant(conn, demo, password, nowIso, today) {
  const data = trimFuture(
    generateDataset({ profile: demo.profile, seed: demo.seed, start: START, end: today, today }),
    nowIso,
  )
  const m = demo.merchantId
  const passwordHash = await hashPassword(password)

  await conn.beginTransaction()
  try {
    await conn.query('DELETE FROM merchants WHERE id = ?', [m])
    await conn.query('DELETE FROM sessions WHERE user_id = ?', [demo.userId])
    await conn.query(
      `INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name)`,
      [demo.userId, demo.email, passwordHash, demo.userName],
    )
    await conn.query(
      `INSERT INTO merchants (id, legal_name, trading_name, uen, category, gst_registered) VALUES (?, ?, ?, ?, ?, ?)`,
      [m, demo.legal_name, demo.trading_name, demo.uen, demo.category, demo.gst],
    )
    await conn.query(`INSERT INTO merchant_users (merchant_id, user_id, role) VALUES (?, ?, 'owner')`, [m, demo.userId])

    await bulk(conn, 'outlets', ['id', 'merchant_id', 'name', 'address'],
      data.outlets.map((o) => [o.id, m, o.name, o.address]))
    await bulk(conn, 'terminals', ['id', 'merchant_id', 'outlet_id', 'serial_no', 'model', 'status'],
      data.terminals.map((t, i) => [t.id, m, t.outlet_id, `${demo.serialPrefix}-${String(i + 1).padStart(4, '0')}`, 'NETS Smart Terminal', 'active']))
    await bulk(conn, 'settlements',
      ['id', 'merchant_id', 'business_date', 'channel', 'gross_cents', 'fee_cents', 'net_cents', 'status', 'expected_date', 'paid_date', 'bank_ref'],
      data.settlements.map((s) => [s.id, m, s.business_date, s.channel, s.gross_cents, s.fee_cents, s.net_cents, s.status,
        s.expected_date, s.paid_date, s.paid_date ? `BANK-${s.paid_date.replace(/-/g, '')}-${s.id.slice(0, 6).toUpperCase()}` : null]))
    await bulk(conn, 'transactions',
      ['id', 'merchant_id', 'outlet_id', 'terminal_id', 'channel', 'status', 'amount_cents', 'fee_cents', 'customer_ref', 'failure_code', 'settlement_id', 'created_at'],
      data.transactions.map((t) => [t.id, m, t.outlet_id, t.terminal_id, t.channel, t.status, t.amount_cents, t.fee_cents,
        t.customer_ref, t.failure_code, t.settlement_id, dt(t.created_at)]))
    await bulk(conn, 'invoices', ['id', 'merchant_id', 'period', 'total_cents', 'status', 'due_date'],
      data.invoices.map((v) => [v.id, m, v.period, v.total_cents, v.status, v.due_date]))
    await bulk(conn, 'invoice_lines',
      ['id', 'merchant_id', 'invoice_id', 'charge_type', 'description', 'qty', 'unit_price_cents', 'amount_cents'],
      data.invoiceLines.map((l) => {
        const rental = l.description === 'Terminal rental'
        const type = l.channel ? 'mdr' : rental ? 'terminal_rental' : 'portal_fee'
        const qty = rental ? data.terminals.length : 1
        return [l.id, m, l.invoice_id, type, l.description, qty, rental ? l.amount_cents / qty : null, l.amount_cents]
      }))
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  }
  return {
    outlets: data.outlets.length,
    terminals: data.terminals.length,
    transactions: data.transactions.length,
    settlements: data.settlements.length,
    invoices: data.invoices.length,
  }
}

async function main() {
  const url = process.env.DATABASE_ADMIN_URL
  const password = process.env.DEMO_PASSWORD
  if (!url) throw new Error('DATABASE_ADMIN_URL is not set (check .env.local)')
  if (!password) throw new Error('DEMO_PASSWORD is not set (check .env.local)')

  const now = new Date()
  const nowIso = now.toISOString()
  const today = sgtDate(nowIso)
  const conn = await mysql.createConnection({ uri: url })
  try {
    for (const demo of DEMOS) {
      const c = await seedMerchant(conn, demo, password, nowIso, today)
      console.log(
        `${demo.legal_name} (${demo.email}): ${c.outlets} outlets, ${c.terminals} terminals, ` +
          `${c.transactions} transactions, ${c.settlements} settlements, ${c.invoices} invoices`,
      )
    }
    console.log(`Seeded ${START} to ${today} (Singapore time).`)
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error(`Seed failed: ${err.message}`)
  process.exit(1)
})
