import { migrate } from '../../scripts/migrate.mjs'

export default async function setup() {
  const url = process.env.TEST_DATABASE_ADMIN_URL
  if (!process.env.TEST_DATABASE_URL || !url) return
  await migrate(url)
}
