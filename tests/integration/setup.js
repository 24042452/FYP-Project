import { afterAll } from 'vitest'

// Data functions read DATABASE_URL; point it at the test database (as the app user).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
process.env.DATABASE_SSL = 'false'

afterAll(async () => {
  const { closePool } = await import('../../lib/db.js')
  await closePool()
})
