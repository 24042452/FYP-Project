import 'server-only'
import mysql from 'mysql2/promise'
import { sslOptions } from './db-ssl.js'

/** @type {import('mysql2/promise').Pool | undefined} */
let pool

/**
 * Connections per server instance: DB_CONNECTION_LIMIT, else 3 in production (many small serverless
 * instances share one database) and 10 elsewhere.
 * @returns {number}
 */
function poolSize() {
  const n = Number(process.env.DB_CONNECTION_LIMIT)
  if (Number.isInteger(n) && n >= 1) return n
  return process.env.NODE_ENV === 'production' ? 3 : 10
}

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
      connectionLimit: poolSize(),
      // Serverless: each instance keeps few connections and lets idle ones go.
      maxIdle: process.env.NODE_ENV === 'production' ? 1 : poolSize(),
      idleTimeout: 60000,
      timezone: 'Z', // DATETIME(3) values are UTC
      decimalNumbers: true, // SUM() returns numbers, not strings
      supportBigNumbers: true,
      dateStrings: ['DATE'], // DATE columns come back as 'YYYY-MM-DD' strings
      ssl: sslOptions(),
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
