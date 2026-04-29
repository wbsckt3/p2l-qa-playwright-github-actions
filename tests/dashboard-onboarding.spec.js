/**
 * =============================================================================
 * E2E — Panel empresa (onboarding) alineado con CompanyDashboardView.vue
 * =============================================================================
 *
 * Código de referencia (P2L tenant):
 *   src/views/CompanyDashboardView.vue
 *
 * Este spec NO sustituye pruebas de API ni de pago ePayco real; documenta y
 * valida en navegador las reglas de producto y estados de UI que esa vista
 * implementa, para que QA sepa *qué* se está comprobando y *por qué*.
 *
 * -----------------------------------------------------------------------------
 * Mapa: regla de negocio / producto  →  qué mira el test
 * -----------------------------------------------------------------------------
 *
 * 1) Autenticación y contexto de sesión
 *    - La vista asume sesión Google (mismo token que Unidades, ~1 h).
 *    - La cabecera debe mostrar "Empresa · P2L Unidades" y el email de sesión
 *      (bloque .company-dash__session) para que el admin sepa bajo qué identidad
 *      opera.
 *    - "Cerrar sesión" + "Ir a Unidades" son acciones de salida: aquí solo
 *      comprobamos que existen (no hacemos logout en cada corrida).
 *
 * 2) Carga inicial
 *    - Mientras `loading === true` la vista muestra "Cargando…".
 *    - Tras `api.getMyCompany()`, o no hay compañía o se muestra el panel.
 *
 * 3) Sin compañía: alta de empresa (onboarding)
 *    - Título "Crear empresa" y aviso de prueba 5 días (trial) + límites.
 *    - **Regla de planes en el formulario de alta:** el catálogo incluye
 *      Starter/Growth/Business/Enterprise, pero en creación **solo el plan
 *      id 1 (Starter) es seleccionable**; el resto va `disabled` (alineado con
 *      copy "Alta inicial: trial interno (Plan 0) y recarga Starter (Plan 1)").
 *    - Formulario: nombre, teléfono, responsable, correo responsable; envío
 *      "Crear empresa" / estado "Creando…".
 *    - Tras éxito, el backend devuelve `companyKey`; la vista muestra la
 *      **clave de empresa una sola vez** (`.key-box` / `code.company-plain-key`)
 *      para compartir con /unidades y conductores.
 *
 * 4) Con compañía: suscripción (trial / pago)
 *    - Banners posibles: período de prueba (días restantes, tope conductores
 *      trial, viajes/día), o fin de prueba y pago ePayco, o suscripción vencida.
 *    - **Regla de consumo:** textos de "viajes completados hoy (toda la empresa)"
 *      y cupos de plan reflejan límites por plan (vista, datos vienen de API).
 *
 * 5) Con compañía: acordeón "Planes" — wallet y recarga
 *    - "Wallet: recarga tu plan" + tarjeta "Plan actual" (estado, vigencia,
 *      conductores, viajes/día, wallet en COP).
 *    - **Regla id 4 (Enterprise):** en la sección de pago, el botón de tarjeta
 *      no es "Elegir recarga" sino **"Contactar ventas"** y no inicia ePayco
 *      (negocio: enterprise por contacto comercial).
 *    - "Recargar wallet con ePayco" carga el script de checkout (aquí no
 *      finalizamos pago; solo comprobamos presencia de CTA si aplica).
 *
 * 6) Con compañía: acordeón "Datos de empresa"
 *    - Muestra **ID de compañía** (para pegar en /unidades con la clave).
 *    - Edición nombre/tel y "Guardar datos" (PATCH vía API).
 *
 * 7) Con compañía: acordeón "Conductores"
 *    - Añadir miembros por email Google; el admin no se puede "Quitar";
 *      conductores sí. Errores p. ej. suscripción inactiva (no se simula
 *      exhaustivamente; validamos presencia de la sección y del formulario).
 *
 * =============================================================================
 */

const { test, expect } = require('@playwright/test');
const { DashboardPage } = require('../pages/DashboardPage');
const { takeTimestampName } = require('../utils/helpers');

function dashboardOnly() {
  return process.env.PLAYWRIGHT_DASHBOARD_ONLY === '1';
}

/**
 * Local o CI: sesión cargada desde PLAYWRIGHT_STORAGE_STATE (+ .env PLAYWRIGHT_SKIP_GOOGLE_UI=1)
 * sin abrir loginWithGoogle — debe coincidir con cómo cargó playwright.config el storageState.
 */
function sessionUsesStorageBypass() {
  return process.env.PLAYWRIGHT_SKIP_GOOGLE_UI === '1';
}

test.describe('P2L — CompanyDashboardView (onboarding y reglas de negocio)', () => {
  test.beforeEach(function () {
    test.skip(
      process.env.CI === 'true' && process.env.PLAYWRIGHT_SKIP_GOOGLE_UI !== '1',
      'En CI hace falta storage (PLAYWRIGHT_STORAGE_B64) o PLAYWRIGHT_SKIP_GOOGLE_UI. Ver README del repo de QA.'
    );
  });

  test('RB-001…007: sesión, alta opcional, cabecera, planes, datos, conductores', async ({ page }) => {
    const onlyDash = dashboardOnly();
    const useStoragePath = onlyDash || sessionUsesStorageBypass();
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    expect(email, 'ADMIN_EMAIL en .env o secretos (correo del responsable en formulario "Crear empresa").').toBeTruthy();
    if (!useStoragePath) {
      expect(
        password,
        'ADMIN_PASSWORD para login Google, o storage local/CI: PLAYWRIGHT_STORAGE_STATE + PLAYWRIGHT_SKIP_GOOGLE_UI=1 (ver README).'
      ).toBeTruthy();
    }

    const dash = new DashboardPage(page);

    await test.step('RB-001 — Abrir ruta del panel; autenticar o usar storage (misma intención que el workflow)', async () => {
      await dash.open();
      if (useStoragePath) {
        await dash.waitDashboardLoaded();
      } else {
        await dash.loginWithGoogle(email, password);
      }
    });

    await test.step('RB-001 — Cabecera "Empresa · P2L Unidades" y acciones de salida', async () => {
      await expect(page.getByRole('heading', { name: /Empresa · P2L Unidades/i })).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        page.getByRole('button', { name: /Cerrar sesión/i }),
        'El admin debe poder cerrar sesión y re-autenticarse (token ~1h, misma copia que la vista).'
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Ir a Unidades/i }),
        'Navegación a la app Unidades (router.push /unidades en la vista).'
      ).toBeVisible();
    });

    await test.step('RB-001 — Si hay sesión, el bloque muestra "Sesión:" y el correo (mismo token que Unidades)', async () => {
      const sessionBlock = page.locator('p.company-dash__session');
      if (await sessionBlock.isVisible().catch(() => false)) {
        await expect(sessionBlock).toContainText(/Sesión:/i);
        await expect(sessionBlock).toContainText(String(email).trim());
      }
    });

    const companyNameBase = takeTimestampName('QA Mobility ');

    let didCreate;
    await test.step('RB-002 / RB-003 — Formulario "Crear empresa" solo si aún no hay compañía en API', async () => {
      const createHeading = page.getByRole('heading', { name: 'Crear empresa' });
      if (await createHeading.isVisible().catch(() => false)) {
        // Regla: aviso 5 días trial visible
        await expect(
          page.getByText(/Prueba 5 días|5 días/i),
          'CompanyDashboardView: aviso de trial 5 días y límites de plan en alta.'
        ).toBeVisible();
        // Regla: en alta, 3 tarjetas plan deshabilitadas (Growth/Business/Enterprise) y 1 habilitada (Starter)
        const createCard = page
          .locator('section.company-dash__card')
          .filter({ has: page.getByRole('heading', { name: 'Crear empresa' }) });
        await expect(createCard.locator('button.plan-card[disabled]')).toHaveCount(3);
        await expect(createCard.locator('button.plan-card:not([disabled])')).toHaveCount(1);

        didCreate = await dash.createCompanyIfNeeded({
          name: companyNameBase,
          phone: '3000000000',
          cityLine: 'Medellín',
          businessType: 'Transporte',
          adminEmail: email,
        });
        // Tras creación, la vista puede mostrar clave de empresa (una vez)
        const keyCode = page.locator('code.company-plain-key, .key-box--once code');
        if (await keyCode.isVisible().catch(() => false)) {
          const keyText = (await keyCode.first().innerText()).trim();
          expect(keyText.length, 'Clave de empresa no vacía tras createCompany').toBeGreaterThan(3);
        }
      } else {
        didCreate = false;
        dash._lastCompanyName = null;
      }
    });

    await test.step('RB-001 — Cargando oculto; panel o formulario alcanzable', async () => {
      await page.getByText('Cargando…').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});
      await dash.waitDashboardLoaded();
    });

    await test.step('RB-004 — Con compañía: banner de prueba o de pago o panel sin banner (estados mutuamente excluyentes en la vista)', async () => {
      const trialBanner = page.locator('.banner--trial');
      const payBanner = page.locator('.banner--pay');
      const nTrial = await trialBanner.count();
      const nPay = await payBanner.count();
      if (nTrial + nPay > 0) {
        // Al menos un tipo visible si aplica
        const trialVisible = await trialBanner.first().isVisible().catch(() => false);
        const payVisible = await payBanner.first().isVisible().catch(() => false);
        if (trialVisible) {
          await expect(trialBanner.first()).toContainText(/Período de prueba|prueba|día/i);
        } else if (payVisible) {
          await expect(payBanner.first()).toContainText(/ePayco|pago|vencid/i);
        }
      }
    });

    await test.step('RB-005 — Acordeón Planes: "Wallet: recarga" y resumen "Plan actual" o tarjetas de plan', async () => {
      const plansDetails = page.locator('details.company-accordion__item--plans').first();
      await expect(
        plansDetails,
        'La vista ancla gestión de planes bajo <details> .company-accordion__item--plans'
      ).toBeVisible({ timeout: 30_000 });
      if ((await plansDetails.getAttribute('open')) == null) {
        await plansDetails.locator('summary').first().click();
      }
      await expect(
        page.getByRole('heading', { name: /Wallet: recarga tu plan/i }),
        'Título fijo de la sección de wallet/planes en CompanyDashboardView.'
      ).toBeVisible();

      // RB-006 Enterprise: botón "Contactar ventas" (plan id 4) no es recarga ePayco self-serve
      const contactarVentas = page.getByRole('button', { name: 'Contactar ventas' });
      if (await contactarVentas.isVisible().catch(() => false)) {
        await expect(contactarVentas).toBeDisabled();
      }

      const recargarCta = page.getByRole('button', { name: /Recargar wallet con ePayco/i });
      if (await recargarCta.isVisible().catch(() => false)) {
        await expect(recargarCta).toBeEnabled();
      }
    });

    await test.step('RB-002 — Texto de plan (trial/Starter/actual) coherente con reglas de producto', async () => {
      await dash.expectFlexibleFreeOrStarterPlan();
    });

    await test.step('RB-006 — Datos de empresa: ID visible, nombre, Guardar', async () => {
      const companyBlock = page.locator('details.company-accordion__item--company').first();
      await expect(companyBlock).toBeVisible({ timeout: 30_000 });
      if ((await companyBlock.getAttribute('open')) == null) {
        await companyBlock.locator('summary').first().click();
      }
      const idCode = companyBlock.locator('code.company-id-code').first();
      await expect(idCode, 'ID de compañía para /unidades (requisito en la copia de la vista).').toBeVisible();
      const idText = (await idCode.innerText()).trim();
      expect(idText.length).toBeGreaterThan(5);
      const nameH2 = companyBlock.locator('h2').first();
      const companyLabel = (await nameH2.innerText()).trim();
      expect(companyLabel.length, 'Nombre comercial (h2) no vacío').toBeGreaterThan(1);
      await expect(companyBlock.getByRole('button', { name: /Guardar datos/i })).toBeVisible();
    });

    await test.step('RB-007 — Conductores: sección, input email y añadir (reglas de miembros en vista)', async () => {
      const driversBlock = page.locator('details.company-accordion__item--drivers').first();
      await expect(driversBlock).toBeVisible({ timeout: 30_000 });
      if ((await driversBlock.getAttribute('open')) == null) {
        await driversBlock.locator('summary').first().click();
      }
      await expect(
        page.getByRole('heading', { name: /Conductores \(correos Google\)/i }),
        'Misma sección que define altas de conductores por email.'
      ).toBeVisible();
      await expect(driversBlock.getByPlaceholder(/correo@/i)).toBeVisible();
      await expect(driversBlock.getByRole('button', { name: /^Añadir$/i })).toBeVisible();
    });

    await test.step('Evidencia — captura de pantalla completa', async () => {
      await dash.takeScreenshot(`onboarding-rb-snapshot-${Date.now()}`);
    });
  });
});
