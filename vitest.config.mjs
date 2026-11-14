import { defineConfig } from 'vitest/config'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

// Local runs read .env.local; in CI the variables come from the environment.
if (fs.existsSync(path.join(root, '.env.local'))) process.loadEnvFile(path.join(root, '.env.local'))

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL)

const resolve = {
  alias: {
    '@': root,
    // 'server-only' throws outside Next.js; tests run outside Next.js.
    'server-only': path.join(root, 'tests/empty-module.js'),
  },
}

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        resolve,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.js'],
          environment: 'node',
        },
      },
      {
        resolve,
        test: {
          name: 'integration',
          // Skipped cleanly when there is no test database.
          include: hasTestDb ? ['tests/integration/**/*.test.js'] : [],
          environment: 'node',
          globalSetup: ['tests/integration/global-setup.js'],
          setupFiles: ['tests/integration/setup.js'],
          // All files share one database.
          fileParallelism: false,
        },
      },
    ],
  },
})
