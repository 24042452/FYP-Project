// Loads the two demo merchants (synthetic data) into the database. Usage: npm run seed
// Idempotent: each merchant is deleted (cascade) and re-inserted in one transaction.
import mysql from 'mysql2/promise'
import { sslOptions } from '../lib/db-ssl.js'
import { generateDataset } from '../lib/synthetic/generate.js'
import { trimFuture } from '../lib/synthetic/trim.js'
import { hashPassword } from '../lib/auth/password.js'
import { randomUUID } from 'node:crypto'
import { periodRange, sgtDate, sgtToIso } from '../lib/dates.js'
import { buildNudges } from '../lib/nudges/build.js'
import { effectiveInvoiceStatus } from '../lib/invoices/status.js'
import { loadFaq } from '../lib/assistant/kb.js'

const START = '2026-05-01'
const BATCH = 1000

const DEMOS = [
  {
    profile: 'hawker',
    seed: 1001,
    merchantId: '11111111-1111-4111-8111-111111111111',
    mid: '110000000010001',
    tidPrefix: '1101',
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
    mid: '110000000020002',
    tidPrefix: '1102',
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
    await conn.query('DELETE FROM merchants WHERE merchant_id = ?', [m])
    await conn.query('DELETE FROM sessions WHERE user_id = ?', [demo.userId])
    await conn.query(
      `INSERT INTO users (user_id, email, password_hash, name) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name)`,
      [demo.userId, demo.email, passwordHash, demo.userName],
    )
    await conn.query(
      `INSERT INTO merchants (merchant_id, mid, legal_name, trading_name, uen, category, gst_registered) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [m, demo.mid, demo.legal_name, demo.trading_name, demo.uen, demo.category, demo.gst],
    )
    await conn.query(`INSERT INTO merchant_users (merchant_id, user_id, role) VALUES (?, ?, 'owner')`, [m, demo.userId])

    await bulk(conn, 'outlets', ['outlet_id', 'merchant_id', 'name', 'address'],
      data.outlets.map((o) => [o.id, m, o.name, o.address]))
    await bulk(conn, 'terminals', ['terminal_id', 'tid', 'merchant_id', 'outlet_id', 'serial_no', 'model', 'status'],
      data.terminals.map((t, i) => [t.id, `${demo.tidPrefix}${String(i + 1).padStart(4, '0')}`, m, t.outlet_id, `${demo.serialPrefix}-${String(i + 1).padStart(4, '0')}`, 'NETS Smart Terminal', 'active']))
    await bulk(conn, 'settlements',
      ['settlement_id', 'merchant_id', 'business_date', 'channel', 'gross_cents', 'fee_cents', 'net_cents', 'status', 'expected_date', 'paid_date', 'bank_ref'],
      data.settlements.map((s) => [s.id, m, s.business_date, s.channel, s.gross_cents, s.fee_cents, s.net_cents, s.status,
        s.expected_date, s.paid_date, s.paid_date ? `BANK-${s.paid_date.replace(/-/g, '')}-${s.id.slice(0, 6).toUpperCase()}` : null]))
    await bulk(conn, 'transactions',
      ['transaction_id', 'merchant_id', 'outlet_id', 'terminal_id', 'stan', 'channel', 'status', 'amount_cents', 'fee_cents', 'failure_code', 'settlement_id', 'created_at'],
      data.transactions.map((t) => [t.id, m, t.outlet_id, t.terminal_id, t.stan, t.channel, t.status, t.amount_cents, t.fee_cents,
        t.failure_code, t.settlement_id, dt(t.created_at)]))
    await bulk(conn, 'invoices', ['invoice_id', 'merchant_id', 'period', 'total_cents', 'status', 'due_date'],
      data.invoices.map((v) => [v.id, m, v.period, v.total_cents, v.status, v.due_date]))
    await bulk(conn, 'invoice_lines',
      ['invoice_line_id', 'merchant_id', 'invoice_id', 'charge_type', 'channel', 'description', 'qty', 'unit_price_cents', 'amount_cents'],
      data.invoiceLines.map((l) => {
        const rental = l.description === 'Terminal rental'
        const type = l.channel ? 'mdr' : rental ? 'terminal_rental' : 'portal_fee'
        const qty = rental ? data.terminals.length : 1
        return [l.id, m, l.invoice_id, type, l.channel ?? null, l.description, qty, rental ? l.amount_cents / qty : null, l.amount_cents]
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

/**
 * Build the merchant's nudges from what is now in the database and insert them (unread).
 * The inputs are gathered here (admin connection) because lib/data is server-only.
 */
async function seedNudges(conn, merchantId, nowIso, today) {
  const r = periodRange('week', today)
  const gross = async (from, to) => {
    const [rows] = await conn.query(
      `SELECT COALESCE(SUM(amount_cents), 0) AS g FROM transactions
        WHERE merchant_id = ? AND status = 'success' AND created_at >= ? AND created_at < ?`,
      [merchantId, dt(sgtToIso(from, 0, 0)), dt(sgtToIso(addDaysStr(to), 0, 0))],
    )
    return Number(rows[0].g)
  }
  const addDaysStr = (d) => new Date(new Date(`${d}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10)
  const weekCurr = await gross(r.from, r.toDate)
  const weekPrev = await gross(r.prevFrom, r.prevToDate)
  const [failed] = await conn.query(
    `SELECT COUNT(*) AS n FROM transactions
      WHERE merchant_id = ? AND status = 'failed' AND created_at >= ? AND created_at < ?`,
    [merchantId, dt(sgtToIso(today, 0, 0)), dt(sgtToIso(addDaysStr(today), 0, 0))],
  )
  const [late] = await conn.query(
    `SELECT COUNT(DISTINCT business_date) AS n FROM settlements
      WHERE merchant_id = ?
        AND (status = 'delayed' OR (status = 'pending' AND expected_date < ?))`,
    [merchantId, today],
  )
  const [inv] = await conn.query(
    `SELECT DATE_FORMAT(period, '%Y-%m') AS month, total_cents AS totalCents, status, due_date AS dueDate
       FROM invoices WHERE merchant_id = ? ORDER BY period DESC LIMIT 1`,
    [merchantId],
  )
  const nudges = buildNudges({
    weekCurr,
    weekPrev,
    failedToday: Number(failed[0].n),
    delayedSettlements: Number(late[0].n),
    latestInvoice: inv[0] ? { month: inv[0].month, totalCents: Number(inv[0].totalCents), status: effectiveInvoiceStatus(inv[0].status, inv[0].dueDate, today) } : undefined,
  })
  const now = new Date(nowIso).getTime()
  const rows = nudges.map((n, i) => [
    randomUUID(), merchantId, n.kind, n.title, n.body, n.link, dt(new Date(now - (i * 7 + 5) * 60_000).toISOString()),
  ])
  if (rows.length) {
    await conn.query('INSERT INTO notifications (notification_id, merchant_id, kind, title, body, link, created_at) VALUES ?', [rows])
  }
  return nudges.length
}

async function main() {
  const url = process.env.DATABASE_ADMIN_URL
  const password = process.env.DEMO_PASSWORD
  if (!url) throw new Error('DATABASE_ADMIN_URL is not set (check .env.local)')
  if (!password) throw new Error('DEMO_PASSWORD is not set (check .env.local)')

  const now = new Date()
  const nowIso = now.toISOString()
  const today = sgtDate(nowIso)
  const conn = await mysql.createConnection({ uri: url, ssl: sslOptions() })
  try {
    for (const demo of DEMOS) {
      const c = await seedMerchant(conn, demo, password, nowIso, today)
      const nudgeCount = await seedNudges(conn, demo.merchantId, nowIso, today)
      console.log(
        `${demo.legal_name} (${demo.email}): ${c.outlets} outlets, ${c.terminals} terminals, ` +
          `${c.transactions} transactions, ${c.settlements} settlements, ${c.invoices} invoices, ${nudgeCount} alerts`,
      )
    }
    // Help-centre content (shared, not merchant data): delete + insert so re-seeding is idempotent.
    const faq = loadFaq()
    await conn.query('DELETE FROM kb_chunks')
    await conn.query('INSERT INTO kb_chunks (source, heading, content) VALUES ?', [faq.map((c) => [c.source, c.heading, c.content])])
    console.log(`Help centre: ${faq.length} answers loaded.`)
    console.log(`Seeded ${START} to ${today} (Singapore time).`)
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error(`Seed failed: ${err.message}`)
  process.exit(1)
})
