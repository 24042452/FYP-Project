import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

// Secrets (database URLs, demo password) come from .env.local and are never printed.
if (fs.existsSync(path.join(root, '.env.local'))) process.loadEnvFile(path.join(root, '.env.local'))

const iphone = devices['iPhone 13']

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // The tests share the one seeded database.
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    // Uses the Microsoft Edge that is already installed; no browser download.
    channel: 'msedge',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    {
      name: 'iPhone 13',
      use: {
        // Phone size, touch and user agent from the iPhone 13 preset, but run in Edge (Chromium).
        viewport: iphone.viewport,
        userAgent: iphone.userAgent,
        deviceScaleFactor: iphone.deviceScaleFactor,
        isMobile: iphone.isMobile,
        hasTouch: iphone.hasTouch,
        defaultBrowserType: 'chromium',
        channel: 'msedge',
      },
    },
  ],
  webServer: {
    // A stale .next breaks a fresh build, so start clean. Then run the production build.
    command: `node -e "require('node:fs').rmSync('.next',{recursive:true,force:true})" && npm run build && npm start`,
    url: 'http://localhost:3000/login',
    reuseExistingServer: false,
    timeout: 360_000,
  },
})
