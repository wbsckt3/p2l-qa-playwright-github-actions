// @ts-check
require('dotenv').config();

const { devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const storageEnv = process.env.PLAYWRIGHT_STORAGE_STATE;
let storageStateFromEnv;
if (storageEnv) {
  const resolved = path.resolve(process.cwd(), storageEnv);
  if (fs.existsSync(resolved)) {
    storageStateFromEnv = resolved;
  } else {
    console.warn(
      '[playwright] PLAYWRIGHT_STORAGE_STATE apuntado pero archivo no encontrado, se ignora: ' + resolved
    );
  }
}

const isCI = !!process.env.CI;
const useBundledChromium = process.env.PLAYWRIGHT_USE_CHROMIUM === '1';

const baseUse = {
  baseURL: 'https://www.refactorii.com',
  headless: isCI,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure',
  actionTimeout: 15_000,
  navigationTimeout: 45_000,
  ...(storageStateFromEnv ? { storageState: storageStateFromEnv } : {}),
};

const chromeOrChromium = useBundledChromium
  ? { browserName: 'chromium' }
  : {
      ...devices['Desktop Chrome'],
      channel: 'chrome',
      launchOptions: {
        args: ['--disable-blink-features=AutomationControlled'],
        ignoreDefaultArgs: ['--enable-automation'],
      },
    };

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests',
  timeout: isCI ? 180_000 : 90_000,
  expect: { timeout: 15_000 },
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: baseUse,
  projects: [
    {
      name: useBundledChromium ? 'chromium' : 'chrome',
      use: { ...baseUse, ...chromeOrChromium },
    },
  ],
};
