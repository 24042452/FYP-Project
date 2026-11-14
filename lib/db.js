import 'server-only'
import mysql from 'mysql2/promise'

/** @type {import('mysql2/promise').Pool | undefined} */
let pool

/**
 * The one shared connection pool (app user, from DATABASE_URL).
 * @returns {import('mysql2/promise').Pool}
 */
export function getPool() {
  if (!pool) {
    const uri = process.env.DATABASE_URL
    if (!uri) throw new Error('DATABASE_URL is not set')
    pool = mysql.createPool({
      uri,
      connectionLimit: 10,
      timezone: 'Z', // DATETIME(3) values are UTC
      decimalNumbers: true, // SUM() returns numbers, not strings
      supportBigNumbers: true,
      dateStrings: ['DATE'], // DATE columns come back as 'YYYY-MM-DD' strings
      ssl: process.env.DATABASE_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
    })
  }
  return pool
}

/**
 * Run a prepared statement and return its rows. Always use `?` placeholders.
 * @param {string} sql
 * @param {any[]} [params]
 * @returns {Promise<any[]>}
 */
export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params)
  return /** @type {any[]} */ (rows)
}

/**
 * Run `fn` inside one database transaction: commit if it resolves, roll back if it throws.
 * `fn` gets a connection-bound `exec(sql, params)` (prepared statements only).
 * @template T
 * @param {(exec: (sql: string, params?: any[]) => Promise<any>) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(fn) {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const out = await fn(async (sql, params = []) => (await conn.execute(sql, params))[0])
    await conn.commit()
    return out
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/** Close the pool (tests and scripts). */
export async function closePool() {
  if (pool) {
    const p = pool
    pool = undefined
    await p.end()
  }
}
