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

const isCI = !!process.env.CI;
/** Forzar Chromium empaquetado (p. ej. si no hay Chrome instalado). */
const useBundledChromium = process.env.PLAYWRIGHT_USE_CHROMIUM === '1';

/**
 * En local, Google suele bloquear el login en el Chromium de Playwright ("browser may not be secure").
 * Mejor usar el Google Chrome instalado (channel: 'chrome') y suavizar flags de automatización.
 */
const localChrome = {
  channel: 'chrome',
  launchOptions: {
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  },
};

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests',
  // Test largo: dashboard + reload + 2 reintentos de job; el nav global es 45s (SPA puede compensar vía expect en POM)
  timeout: isCI ? 180_000 : 90_000,
  expect: { timeout: 15_000 },
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'https://www.refactorii.com',
    headless: isCI,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    ...(storageState ? { storageState } : {}),
  },
  projects: [
    {
      name: isCI || useBundledChromium ? 'chromium' : 'chrome',
      use:
        isCI || useBundledChromium
          ? { browserName: 'chromium' }
          : localChrome,
    },
  ],
};
