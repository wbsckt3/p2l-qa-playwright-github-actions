// @ts-check
require('dotenv').config();

const { devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { resolveChromeLaunch } = require('./utils/chromeExecutable');

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

/** Fuera de CI no forzar `--no-sandbox`: Chrome muestra banner de seguridad innecesario en escritorio. */
const playwrightIgnoreSandbox = isCI ? [] : ['--no-sandbox'];

/**
 * Por defecto NO se pasa `--disable-blink-features=AutomationControlled`: en Chrome gestionado
 * (directivas de empresa) ese flag genera banner y puede bloquearse. Activar solo si hace falta:
 * PLAYWRIGHT_USE_AUTOMATION_STEALTH=1
 */
const useAutomationStealth = process.env.PLAYWRIGHT_USE_AUTOMATION_STEALTH === '1';

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

/**
 * Google Chrome instalado (`chrome.exe`), no Chromium del bundle salvo PLAYWRIGHT_USE_CHROMIUM=1.
 * En Windows se intenta ubicar Chrome en rutas habituales; si no: channel: 'chrome'.
 */
const chromeOrChromium = useBundledChromium
  ? {
      browserName: 'chromium',
      launchOptions: {
        ignoreDefaultArgs: ['--enable-automation', ...playwrightIgnoreSandbox],
      },
    }
  : (() => {
      const pick = resolveChromeLaunch();
      const use = {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: useAutomationStealth ? ['--disable-blink-features=AutomationControlled'] : [],
          ignoreDefaultArgs: ['--enable-automation', ...playwrightIgnoreSandbox],
        },
      };
      if (pick.mode === 'executable') {
        use.launchOptions.executablePath = pick.path;
        if (!isCI) {
          console.log(`[playwright] Chrome: ${pick.path} (${pick.hint})`);
        }
      } else {
        use.channel = 'chrome';
        if (!isCI) {
          console.log(
            '[playwright] Chrome vía canal del sistema (`channel: chrome`). Si no ves Chrome instalado este mensaje ayuda Playwright.'
          );
        }
      }
      return use;
    })();

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: './tests',
  timeout: isCI ? 180_000 : 90_000,
  expect: { timeout: 15_000 },
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: baseUse,
  projects: [
    {
      name: useBundledChromium ? 'chromium' : 'chrome',
      use: { ...baseUse, ...chromeOrChromium },
    },
  ],
};
