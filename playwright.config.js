// @ts-check
require('dotenv').config();

const { devices } = require('@playwright/test');
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

const isCI = !!process.env.CI;
/** Forzar Chromium empaquetado (sin Chrome en la máquina, o alinear storage con el runner mínimo). */
const useBundledChromium = process.env.PLAYWRIGHT_USE_CHROMIUM === '1';

const sharedUse = {
  baseURL: 'https://www.refactorii.com',
  headless: isCI,
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure',
  actionTimeout: 15_000,
  navigationTimeout: 45_000,
  ...(storageState ? { storageState } : {}),
};

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests',
  timeout: isCI ? 180_000 : 90_000,
  expect: { timeout: 15_000 },
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: sharedUse,
  projects: useBundledChromium
    ? [
        {
          name: 'chromium',
          use: { browserName: 'chromium' },
        },
      ]
    : [
        {
          name: 'chrome',
          use: {
            ...devices['Desktop Chrome'],
            channel: 'chrome',
            launchOptions: {
              args: ['--disable-blink-features=AutomationControlled'],
              ignoreDefaultArgs: ['--enable-automation'],
            },
          },
        },
      ],
};
