// Applies db/migrations/*.sql in name order. Usage: npm run migrate
import mysql from 'mysql2/promise'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = path.join(here, '..', 'db', 'migrations')

/**
 * Apply every pending migration. MySQL commits DDL implicitly, so a failing file
 * can leave a partial schema; fix the file and drop what it created before re-running.
 * @param {string} [url] admin connection string (defaults to DATABASE_ADMIN_URL)
 * @returns {Promise<string[]>} names applied in this run
 */
export async function migrate(url = process.env.DATABASE_ADMIN_URL) {
  if (!url) throw new Error('DATABASE_ADMIN_URL is not set')
  const conn = await mysql.createConnection({ uri: url, multipleStatements: true })
  /** @type {string[]} */
  const applied = []
  try {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name VARCHAR(200) NOT NULL PRIMARY KEY,
         applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
       ) ENGINE=InnoDB`,
    )
    const [rows] = await conn.query('SELECT name FROM schema_migrations')
    const done = new Set(rows.map((r) => r.name))
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
    for (const file of files) {
      if (done.has(file)) continue
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      await conn.query(sql)
      await conn.execute('INSERT INTO schema_migrations (name) VALUES (?)', [file])
      applied.push(file)
    }
  } finally {
    await conn.end()
  }
  return applied
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate()
    .then((applied) => {
      if (applied.length === 0) console.log('No new migrations.')
      else for (const f of applied) console.log(`Applied ${f}`)
    })
    .catch((err) => {
      console.error(`Migration failed: ${err.message}`)
      process.exit(1)
    })
}
