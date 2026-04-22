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
  }
}

const isCI = !!process.env.CI;
const useBundledChromium = process.env.PLAYWRIGHT_USE_CHROMIUM === '1';
/** Misma ruta que escribe `tests/auth.setup.js` (sesión generada en el job de GitHub). */
const CI_GENERATED_STATE = path.join(__dirname, 'playwright', '.auth', 'ci-generated.json');

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

/** Nunca inyectar storage externo al proyecto `auth` (debe ser login limpio en el runner). */
const baseUseAuth = { ...baseUse };
if (Object.prototype.hasOwnProperty.call(baseUseAuth, 'storageState')) {
  delete baseUseAuth.storageState;
}

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

const projects = [];

if (isCI) {
  projects.push({
    name: 'auth',
    testMatch: '**/auth.setup.js',
    retries: 0,
    use: { ...baseUseAuth, ...chromeOrChromium },
  });
  projects.push({
    name: 'chrome',
    testMatch: '**/*.spec.js',
    testIgnore: '**/auth.setup.js',
    dependencies: ['auth'],
    use: { ...baseUse, ...chromeOrChromium, storageState: CI_GENERATED_STATE },
  });
} else {
  projects.push({
    name: useBundledChromium ? 'chromium' : 'chrome',
    testMatch: '**/*.spec.js',
    testIgnore: '**/auth.setup.js',
    use: { ...baseUse, ...chromeOrChromium },
  });
}

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests',
  timeout: isCI ? 180_000 : 90_000,
  expect: { timeout: 15_000 },
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: baseUse,
  projects,
};
