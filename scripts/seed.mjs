// Loads the two demo merchants (synthetic data) into the database. Usage: npm run seed
// Idempotent: each merchant is deleted (cascade) and re-inserted in one transaction.
import mysql from 'mysql2/promise'
import { sslOptions } from '../lib/db-ssl.js'
import { generateDataset } from '../lib/synthetic/generate.js'
import { trimFuture } from '../lib/synthetic/trim.js'
import { hashPassword } from '../lib/auth/password.js'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { addDays, periodRange, sgtDate, sgtToIso } from '../lib/dates.js'
import { offerEndsOn } from '../lib/offers/rules.js'
import { outletSuits } from '../lib/promotions/catalogue.js'
import { offerByKey, offerSuits } from '../lib/offers/catalogue.js'
import { buildNudges } from '../lib/nudges/build.js'
import { effectiveInvoiceStatus } from '../lib/invoices/status.js'
import { loadFaq } from '../lib/assistant/kb.js'

const START = '2026-05-01'
const BATCH = 1000

/** 1x1 PNG used as a stand-in for evidence files. */
const PLACEHOLDER_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

/** The franchise group and its head-office owner. */
const KOPI_GROUP = {
  groupId: '33333333-3333-4333-8333-333333333333',
  name: 'Kopi Corner',
  hq: { userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'kopi.hq@demo.local', name: 'Ms Lim' },
}

export const DEMOS = [
  {
    profile: 'hawker',
    seed: 1001,
    merchantId: '11111111-1111-4111-8111-111111111111',
    mid: '110000000010001',
    tidPrefix: '1101',
    users: [{ userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'hawker@demo.local', name: 'Ah Hock', role: 'owner' }],
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
    users: [{ userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'retail@demo.local', name: 'Mr Tan', role: 'owner' },
      { userId: 'ffffffff-ffff-4fff-8fff-ffffffffffff', email: 'retail.accounts@demo.local', name: 'Ms Chen', role: 'accountant' },
    ],
    legal_name: 'Tan & Sons Retail Pte Ltd',
    trading_name: 'Tan & Sons Retail',
    uen: '202612345K',
    category: 'Retail',
    gst: 1,
    serialPrefix: 'TS',
  },
  // Kopi Corner: a franchise (3 tiers). Head office sees all three franchisees; East has an owner and an outlet manager.
  {
    profile: 'cafe',
    seed: 3003,
    merchantId: '44444444-4444-4444-8444-444444444444',
    mid: '110000000030003',
    tidPrefix: '1103',
    groupId: KOPI_GROUP.groupId,
    outlets: [
      { name: 'Tampines Hub #01-12', address: '1 Tampines Walk, Singapore 528523' },
      { name: 'Bedok North #01-30', address: '210 Bedok North St 1, Singapore 460210' },
    ],
    recentDelay: false,
    users: [
      { userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', email: 'kopi.east@demo.local', name: 'Mr Wong', role: 'owner' },
      { userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', email: 'kopi.bedok@demo.local', name: 'Priya', role: 'outlet_manager', outletIndex: 1 },
    ],
    legal_name: 'KC East Pte Ltd',
    trading_name: 'Kopi Corner East',
    uen: '202633301E',
    category: 'F&B',
    gst: 1,
    serialPrefix: 'KE',
  },
  {
    profile: 'cafe',
    seed: 4004,
    merchantId: '55555555-5555-4555-8555-555555555555',
    mid: '110000000040004',
    tidPrefix: '1104',
    groupId: KOPI_GROUP.groupId,
    outlets: [{ name: 'Jurong Point #02-08', address: '1 Jurong West Central 2, Singapore 648886' }],
    recentDelay: true,
    users: [],
    legal_name: 'KC West Pte Ltd',
    trading_name: 'Kopi Corner West',
    uen: '202633302W',
    category: 'F&B',
    gst: 0,
    serialPrefix: 'KW',
  },
  {
    profile: 'cafe',
    seed: 5005,
    merchantId: '66666666-6666-4666-8666-666666666666',
    mid: '110000000050005',
    tidPrefix: '1105',
    groupId: KOPI_GROUP.groupId,
    outlets: [{ name: 'Woodlands Civic #01-05', address: '900 South Woodlands Dr, Singapore 730900' }],
    recentDelay: false,
    anomalies: false,
    users: [],
    legal_name: 'KC North Pte Ltd',
    trading_name: 'Kopi Corner North',
    uen: '202633303N',
    category: 'F&B',
    gst: 0,
    serialPrefix: 'KN',
  },
]

/** ISO UTC -> 'YYYY-MM-DD HH:MM:SS.mmm' */
const dt = (iso) => iso.replace('T', ' ').replace('Z', '')

async function bulk(conn, table, columns, rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await conn.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES ?`, [rows.slice(i, i + BATCH)])
  }
}

/**
 * Create or refresh one demo login, and log out any old sessions it had.
 * @param {import('mysql2/promise').Connection} conn
 * @param {{userId: string, email: string, name: string}} u
 * @param {string} passwordHash
 */
async function upsertUser(conn, u, passwordHash) {
  await conn.query('DELETE FROM sessions WHERE user_id = ?', [u.userId])
  await conn.query(
    `INSERT INTO users (user_id, email, password_hash, name) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name)`,
    [u.userId, u.email, passwordHash, u.name],
  )
}

/**
 * The franchise group and its head-office login (group_users). Run before its merchants are seeded.
 * Deleting the group unlinks its merchants (ON DELETE SET NULL) and removes its head-office links.
 */
async function seedGroup(conn, group, password) {
  await conn.query('DELETE FROM merchant_groups WHERE group_id = ?', [group.groupId])
  await conn.query('INSERT INTO merchant_groups (group_id, name) VALUES (?, ?)', [group.groupId, group.name])
  await upsertUser(conn, group.hq, await hashPassword(password))
  await conn.query("INSERT INTO group_users (group_id, user_id, role) VALUES (?, ?, 'hq_owner')", [group.groupId, group.hq.userId])
}

/**
 * The promotions and offer each demo business starts with: its 2 finished promotions (from the dataset),
 * one running NETS QR promotion (started 6 days ago, 4 weeks long; Tan & Sons at Tampines Mall only so its
 * picker shows a busy, an unsuitable and a free outlet), and the QR fee-cut offer taken up 10 days ago at the
 * outlets that suit it (it is in-store only, so not at an online store).
 */
export function planPromotionsAndOffer(demo, data, today) {
  const physical = data.outlets.filter((o) => outletSuits('nets_qr', o))
  const runOutlets = demo.profile === 'retail' ? physical.filter((o) => o.name === 'Tampines Mall #02-15') : physical
  const startsOn = addDays(today, -6)
  const offerStart = addDays(today, -10)
  const offer = offerByKey('qr_fee_cut')
  return {
    runs: [
      ...data.pastPromotions.map((r) => ({ key: r.key, channel: r.channel, outletIds: r.outletIds, starts_on: r.starts_on, ends_on: r.ends_on, running: false })),
      { key: 'qr_tuesday', channel: 'nets_qr', outletIds: runOutlets.map((o) => o.id), starts_on: startsOn, ends_on: addDays(startsOn, 27), running: true },
    ],
    offer: { key: offer.key, starts_on: offerStart, ends_on: offerEndsOn(offerStart, offer.months), outletIds: data.outlets.filter((o) => offerSuits(offer, o)).map((o) => o.id) },
  }
}

async function seedMerchant(conn, demo, password, nowIso, today) {
  const data = trimFuture(
    generateDataset({ profile: demo.profile, seed: demo.seed, start: START, end: today, today, outlets: demo.outlets, recentDelay: demo.recentDelay, anomalies: demo.anomalies }),
    nowIso,
  )
  const m = demo.merchantId
  const passwordHash = await hashPassword(password)

  await conn.beginTransaction()
  try {
    await conn.query('DELETE FROM merchants WHERE merchant_id = ?', [m])
    for (const u of demo.users) await upsertUser(conn, u, passwordHash)
    await conn.query(
      `INSERT INTO merchants (merchant_id, mid, group_id, legal_name, trading_name, uen, category, gst_registered) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [m, demo.mid, demo.groupId ?? null, demo.legal_name, demo.trading_name, demo.uen, demo.category, demo.gst],
    )

    await bulk(conn, 'outlets', ['outlet_id', 'merchant_id', 'name', 'address', 'is_online'],
      data.outlets.map((o) => [o.id, m, o.name, o.address, o.online ? 1 : 0]))
    for (const u of demo.users) {
      const outletId = u.outletIndex === undefined ? null : data.outlets[u.outletIndex].id
      await conn.query('INSERT INTO merchant_users (merchant_id, user_id, role, outlet_id) VALUES (?, ?, ?, ?)', [m, u.userId, u.role, outletId])
    }
    await bulk(conn, 'terminals', ['terminal_id', 'tid', 'merchant_id', 'outlet_id', 'serial_no', 'model', 'status'],
      data.terminals.map((t, i) => [t.id, `${demo.tidPrefix}${String(i + 1).padStart(4, '0')}`, m, t.outlet_id, `${demo.serialPrefix}-${String(i + 1).padStart(4, '0')}`, 'NETS Smart Terminal', 'active']))
    await bulk(conn, 'settlements',
      ['settlement_id', 'merchant_id', 'business_date', 'channel', 'gross_cents', 'fee_cents', 'net_cents', 'status', 'expected_date', 'paid_date', 'bank_ref', 'refund_cents'],
      data.settlements.map((s) => [s.id, m, s.business_date, s.channel, s.gross_cents, s.fee_cents, s.net_cents, s.status,
        s.expected_date, s.paid_date, s.paid_date ? `BANK-${s.paid_date.replace(/-/g, '')}-${s.id.slice(0, 6).toUpperCase()}` : null, s.refund_cents ?? 0]))
    await bulk(conn, 'transactions',
      ['transaction_id', 'merchant_id', 'outlet_id', 'terminal_id', 'stan', 'channel', 'status', 'amount_cents', 'fee_cents', 'failure_code', 'settlement_id', 'created_at'],
      data.transactions.map((t) => [t.id, m, t.outlet_id, t.terminal_id, t.stan, t.channel, t.status, t.amount_cents, t.fee_cents,
        t.failure_code, t.settlement_id, dt(t.created_at)]))
    await bulk(conn, 'refunds',
      ['refund_id', 'merchant_id', 'transaction_id', 'amount_cents', 'reason', 'refunded_at', 'settlement_id'],
      data.refunds.map((r) => [r.id, m, r.transaction_id, r.amount_cents, r.reason, dt(r.refunded_at), r.settlement_id]))
    const answeredBy = demo.users.find((u) => u.role === 'owner')?.userId ?? null
    await bulk(conn, 'disputes',
      ['dispute_id', 'merchant_id', 'transaction_id', 'amount_cents', 'reason', 'opened_at', 'respond_by', 'status', 'answered_at', 'answered_by',
        'decline_reason', 'evidence', 'note', 'decide_by', 'decided_at'],
      data.disputes.map((d) => [d.id, m, d.transaction_id, d.amount_cents, d.reason, dt(d.opened_at), d.respond_by, d.status,
        d.answered_at ? dt(d.answered_at) : null, d.answered_at ? answeredBy : null, d.decline_reason ?? null,
        d.evidence ? JSON.stringify(d.evidence) : null, d.note ?? null, d.decide_by ?? null, d.decided_at ? dt(d.decided_at) : null]))
    const fileRows = []
    for (const d of data.disputes) {
      for (let i = 1; i <= (d.files ?? 0); i++) {
        fileRows.push([randomUUID(), d.id, m, `receipt-${i}.png`, 'image/png', PLACEHOLDER_PNG.length, PLACEHOLDER_PNG, dt(d.answered_at ?? d.opened_at)])
      }
    }
    await bulk(conn, 'dispute_files',
      ['dispute_file_id', 'dispute_id', 'merchant_id', 'file_name', 'mime_type', 'size_bytes', 'data', 'uploaded_at'], fileRows)
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
    const plan = planPromotionsAndOffer(demo, data, today)
    const runRows = plan.runs.map((r) => ({ ...r, runId: randomUUID() }))
    await bulk(conn, 'promotion_runs', ['promotion_run_id', 'merchant_id', 'promotion_key', 'channel', 'starts_on', 'ends_on', 'started_by', 'created_at'],
      runRows.map((r) => [r.runId, m, r.key, r.channel, r.starts_on, r.ends_on, answeredBy, dt(sgtToIso(addDays(r.starts_on, -1), 9, 0))]))
    await bulk(conn, 'promotion_run_outlets', ['promotion_run_id', 'merchant_id', 'outlet_id'],
      runRows.flatMap((r) => r.outletIds.map((o) => [r.runId, m, o])))
    const takeupId = randomUUID()
    await conn.query('INSERT INTO offer_takeups (offer_takeup_id, merchant_id, offer_key, starts_on, ends_on, taken_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [takeupId, m, plan.offer.key, plan.offer.starts_on, plan.offer.ends_on, answeredBy, dt(sgtToIso(plan.offer.starts_on, 9, 0))])
    await bulk(conn, 'offer_takeup_outlets', ['offer_takeup_id', 'merchant_id', 'outlet_id'], plan.offer.outletIds.map((o) => [takeupId, m, o]))
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
    refunds: data.refunds.length,
    disputes: data.disputes.length,
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
    await seedGroup(conn, KOPI_GROUP, password)
    console.log(`${KOPI_GROUP.name} group: head office login ${KOPI_GROUP.hq.email}`)
    for (const demo of DEMOS) {
      const c = await seedMerchant(conn, demo, password, nowIso, today)
      const nudgeCount = await seedNudges(conn, demo.merchantId, nowIso, today)
      console.log(
        `${demo.legal_name} (${demo.users.map((u) => u.email).join(', ') || 'no login'}): ${c.outlets} outlets, ${c.terminals} terminals, ` +
          `${c.transactions} transactions, ${c.settlements} settlements, ${c.invoices} invoices, ${c.refunds} refunds, ${c.disputes} disputes, ${nudgeCount} alerts`,
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`Seed failed: ${err.message}`)
    process.exit(1)
  })
}
