/**
 * E2E producción: onboarding empresa + plan inicial (trial / starter / $0).
 */

const { test, expect } = require('@playwright/test');
const { DashboardPage } = require('../pages/DashboardPage');
const { takeTimestampName } = require('../utils/helpers');

function dashboardOnly() {
  return process.env.PLAYWRIGHT_DASHBOARD_ONLY === '1';
}

/** CI con B64/PLAYWRIGHT_STORAGE_STATE: no usar loginWithGoogle, solo abrir y esperar panel (misma intención que DASHBOARD_ONLY). */
function sessionFromCISecret() {
  return process.env.CI === 'true' && process.env.PLAYWRIGHT_SKIP_GOOGLE_UI === '1';
}

test.describe('P2L — Dashboard empresa (producción)', () => {
  test.beforeEach(function () {
    // En CI no se abre el flujo Google: hace falta storage (PLAYWRIGHT_STORAGE_B64 en el workflow).
    test.skip(
      process.env.CI === 'true' && process.env.PLAYWRIGHT_SKIP_GOOGLE_UI !== '1',
      'En CI el workflow no inicia sesión con Google. Suba PLAYWRIGHT_STORAGE_B64 o omita el E2E (ver README).'
    );
  });

  test('Admin nuevo crea empresa y recibe plan free', async ({ page }) => {
    const onlyDash = dashboardOnly();
    const fromSecret = sessionFromCISecret();
    const useStoragePath = onlyDash || fromSecret;
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    expect(
      email,
      'Definir ADMIN_EMAIL en .env o en secretos (necesario para el formulario de empresa).'
    ).toBeTruthy();
    if (!useStoragePath) {
      expect(
        password,
        'Definir ADMIN_PASSWORD para login Google (o CI con B64 + PLAYWRIGHT_SKIP_GOOGLE_UI, ver README).'
      ).toBeTruthy();
    }

    const dash = new DashboardPage(page);

    await test.step(
      useStoragePath
        ? 'Abrir y panel (sesión desde storage; sin flujo Google en CI con B64)'
        : 'Abrir y autenticar (Google o sesión local)',
      async () => {
        await dash.open();
        if (useStoragePath) {
          await dash.waitDashboardLoaded();
        } else {
          await dash.loginWithGoogle(email, password);
        }
      }
    );

    const companyBase = takeTimestampName('QA Mobility ');

    let created;
    await test.step('Crear empresa si no existe', async () => {
      created = await dash.createCompanyIfNeeded({
        name: companyBase,
        phone: '3000000000',
        cityLine: 'Medellín',
        businessType: 'Transporte',
        adminEmail: email,
      });
    });

    if (!created) {
      dash._lastCompanyName = null;
    }

    await test.step('Validar plan y nombre de empresa en panel', async () => {
      await dash.waitDashboardLoaded();
      await dash.expectFlexibleFreeOrStarterPlan();
      const nameShown = await dash.getCompanyName();
      expect(nameShown.length).toBeGreaterThan(2);
    });

    await test.step('Captura final de evidencia', async () => {
      await dash.takeScreenshot(`onboarding-final-${Date.now()}`);
    });
  });
});
