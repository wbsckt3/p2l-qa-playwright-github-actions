/**
 * Genera storageState de Playwright autenticando contra Google + dashboard P2L.
 * Uso en CI:
 *   node scripts/generateStorageState.js
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { DashboardPage } = require('../pages/DashboardPage');

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const outPath = process.env.STORAGE_STATE_OUTPUT || 'storageState.json';

  if (!email || !password) {
    throw new Error('Faltan ADMIN_EMAIL y/o ADMIN_PASSWORD para generar storageState.');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const dash = new DashboardPage(page);
    await dash.open();
    await dash.loginWithGoogle(email, password);
    await dash.waitDashboardLoaded();

    const resolved = path.resolve(process.cwd(), outPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    await context.storageState({ path: resolved });
    console.log(`storageState generado en: ${resolved}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

