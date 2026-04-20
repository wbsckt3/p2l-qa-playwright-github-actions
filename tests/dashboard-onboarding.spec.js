/**
 * E2E producción: onboarding empresa + plan inicial (trial / starter / $0).
 */

const { test, expect } = require('@playwright/test');
const { DashboardPage } = require('../pages/DashboardPage');
const { takeTimestampName } = require('../utils/helpers');

test.describe('P2L — Dashboard empresa (producción)', () => {
  test.beforeEach(function () {
    // En runners de GitHub el login Google por UI (email/contraseña) suele romperse
    // (captcha, UI distinta, sin campo password). El flujo soportado en CI es sesión guardada.
    test.skip(
      process.env.CI === 'true' && process.env.PLAYWRIGHT_SKIP_GOOGLE_UI !== '1',
      'CI sin sesión: añada el secreto PLAYWRIGHT_STORAGE_B64 (ver README). El login Google automatizado no es fiable en GitHub Actions.'
    );
  });

  test('Admin nuevo crea empresa y recibe plan free', async ({ page }) => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    expect(email, 'Definir ADMIN_EMAIL en .env o en secretos de GitHub').toBeTruthy();
    expect(password, 'Definir ADMIN_PASSWORD en .env o en secretos de GitHub').toBeTruthy();

    const dash = new DashboardPage(page);
    await dash.open();
    await dash.loginWithGoogle(email, password);
    await dash.waitDashboardLoaded();

    const companyBase = takeTimestampName('QA Mobility ');
    const created = await dash.createCompanyIfNeeded({
      name: companyBase,
      phone: '3000000000',
      cityLine: 'Medellín',
      businessType: 'Transporte',
      adminEmail: email,
    });

    // Si ya existía empresa, igual validamos plan y nombre visible.
    if (!created) {
      // Mantener trazabilidad cuando no hay formulario (cuenta ya con empresa).
      dash._lastCompanyName = null;
    }

    await dash.waitDashboardLoaded();
    await dash.expectFlexibleFreeOrStarterPlan();

    const nameShown = await dash.getCompanyName();
    expect(nameShown.length).toBeGreaterThan(2);

    await dash.takeScreenshot(`onboarding-final-${Date.now()}`);
  });
});
