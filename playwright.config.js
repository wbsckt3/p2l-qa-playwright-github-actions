// @ts-check
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const storageEnv = process.env.PLAYWRIGHT_STORAGE_STATE;
let storageState;
if (storageEnv) {
  const resolved = path.resolve(process.cwd(), storageEnv);
  if (fs.existsSync(resolved)) {
    storageState = resolved;
  }
}

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 1,
  // Un solo worker en CI evita dos logins Google concurrentes y ruido en artifacts.
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'https://www.refactorii.com',
    headless: !!process.env.CI,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 25_000,
    navigationTimeout: 60_000,
    ...(storageState ? { storageState } : {}),
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
};
