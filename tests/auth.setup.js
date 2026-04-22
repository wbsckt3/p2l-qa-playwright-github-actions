/**
 * En CI: un solo login real en el runner, guarda storageState bajo `playwright/.auth/ci-generated.json`.
 * El proyecto `chrome` depende de `auth` y reutiliza ese archivo (mismo IP/entorno que el resto de tests).
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { DashboardPage } = require('../pages/DashboardPage');

const OUT = path.join(__dirname, '..', 'playwright', '.auth', 'ci-generated.json');

test('generar storageState (login en el runner CI)', async ({ page }) => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  expect(email, 'Definir secret ADMIN_EMAIL en el repo (Actions)').toBeTruthy();
  expect(password, 'Definir secret ADMIN_PASSWORD en el repo (Actions)').toBeTruthy();

  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const dash = new DashboardPage(page);
  await dash.open();
  await dash.loginWithGoogle(email, password, { forceFullLogin: true });
  await page.context().storageState({ path: OUT });
});
