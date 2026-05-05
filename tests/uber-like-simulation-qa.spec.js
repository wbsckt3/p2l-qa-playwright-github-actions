const { test, expect } = require('@playwright/test');
const { SIMULATION_ROUTES } = require('../utils/testData');

/**
 * Conductor en lab: usuario mock (`simulation-lab`), sin Google.
 *
 * Este spec solo local: solicitud sintética desde el mismo front (RideFlowSimulator).
 * Para pasajero **real** desde móvil + mismo mock conductor esperando socket, véase
 * `uber-like-lab-await-passenger.spec.js` + `P2L_LAB_AWAIT_REAL_PASSENGER=1`.
 *
 * Flujo del lab: `btn-accept` → opcional `btn-sim-pickup-leg` (animación + modal «Llegaste al origen») →
 * `btn-arrived` → `btn-start` …; `window.qaRide.startPickupLeg()` equivale al botón pickup en utilidades QA.
 */

/** Origen SPA usado por config (grantPermissions debe coincidir). */
const PROD_ORIGIN = 'https://www.refactorii.com';

/**
 * Quita overlays previos al mapa QA: modal push global de App.vue si siguiera apareciendo fuera del lab.
 */
async function dismissOptionalPushModal(page) {
  const dismiss = page.getByTestId('btn-push-dismiss');
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
}

/** Si el panel quedó colapsado (test previo), el cuerpo con los botones tiene `display:none` y el click no dispara la sim. */
async function ensureQaPanelExpanded(page) {
  const pickupBtn = page.getByTestId('btn-sim-pickup-leg');
  if (await pickupBtn.isVisible().catch(() => false)) return;
  const toggle = page.getByTestId('qa-panel-toggle');
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await expect(pickupBtn).toBeVisible({ timeout: 15_000 });
  }
}

async function openSimulationQa(page) {
  const wait = { waitUntil: 'load' };

  async function tryHit(path) {
    await page.goto(path, wait);
    await dismissOptionalPushModal(page);
    try {
      await page.waitForSelector('[data-testid="qa-panel"]', { state: 'visible', timeout: 20000 });
      return true;
    } catch {
      return false;
    }
  }

  for (const route of SIMULATION_ROUTES) {
    const rq = route.startsWith('/') ? route : `/${route}`;
    if (await tryHit(rq)) {
      await expect
        .poll(async () => {
          return page.evaluate(() => !!window.qaRide?.getState);
        }, { timeout: 15000 })
        .toBe(true);
      return;
    }
  }
}

test.describe('Uber-like Simulation QA Lab', () => {
  /**
   * Un solo contexto + una pestaña para todo el archivo: evita que Chrome se abra y se cierre
   * entre cada test (comportamiento del fixture `page` por defecto).
   *
   * Timeout por test del grupo: el pickup animado + modal puede superar 90s (ruta real / red);
   * sin esto, el timeout global del proyecto corta antes que `expect(..., { timeout: 120_000 })`.
   */
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  const LAB_GEO = { latitude: 6.247638, longitude: -75.56583 };
  const LAB_BASE = process.env.PLAYWRIGHT_FORCE_BASE_URL || 'https://www.refactorii.com';

  /** @type {import('@playwright/test').BrowserContext | undefined} */
  let labContext;
  /** @type {import('@playwright/test').Page | undefined} */
  let labPage;

  test.beforeAll(async ({ browser }) => {
    labContext = await browser.newContext({
      baseURL: LAB_BASE,
      geolocation: LAB_GEO,
      permissions: ['geolocation', 'notifications'],
    });
    await labContext.grantPermissions(['geolocation', 'notifications'], { origin: PROD_ORIGIN });
    labPage = await labContext.newPage();
  });

  test.afterAll(async () => {
    /** Cierre esperado: Playwright destruye el contexto al terminar el archivo; no indica fallo del producto. */
    await labContext?.close();
  });

  test('transiciones requested -> accepted -> arrived -> in_progress -> completed', async () => {
    await openSimulationQa(labPage);
    await expect(labPage.getByTestId('qa-panel')).toBeVisible();
    await labPage.getByTestId('btn-reset-flow').click();
    await expect(labPage.getByTestId('ride-status')).toHaveText(/requested/i);

    await labPage.getByTestId('btn-accept').click();
    await expect(labPage.getByTestId('ride-status')).toHaveText(/accepted/i);

    await labPage.getByTestId('btn-arrived').click();
    await expect(labPage.getByTestId('ride-status')).toHaveText(/arrived/i);

    await labPage.getByTestId('btn-start').click();
    await expect(labPage.getByTestId('ride-status')).toHaveText(/in_progress/i);

    // Verificar movimiento real por API global; evita flakes de visibilidad del marker DOM
    let baseline = null;
    await expect
      .poll(
        async () => {
          const coords = await labPage.evaluate(() => window.qaRide?.getCoords?.()?.driver ?? null);
          if (!coords) return 'waiting_coords';
          if (!baseline) {
            baseline = { lat: Number(coords.lat), lng: Number(coords.lng) };
            return 'baseline_set';
          }
          const moved =
            Number(coords.lat) !== Number(baseline.lat) ||
            Number(coords.lng) !== Number(baseline.lng);
          return moved ? 'moved' : 'still';
        },
        { timeout: 45_000 }
      )
      .toBe('moved');

    await labPage.getByTestId('btn-complete').click();
    await expect(labPage.getByTestId('ride-status')).toHaveText(/completed/i);
  });

  test('contrato público window.qaRide + guía QA visibles tras abrir lab', async () => {
    await openSimulationQa(labPage);
    await expect(labPage.getByTestId('qa-panel')).toBeVisible();

    const contract = await labPage.evaluate(() => {
      const qr = window.qaRide || {};
      const st = typeof qr.getState === 'function' ? qr.getState() : null;
      return {
        runFullFlow: typeof qr.runFullFlow === 'function',
        reset: typeof qr.reset === 'function',
        startPickupLeg: typeof qr.startPickupLeg === 'function',
        getState: typeof qr.getState === 'function',
        getWallet: typeof qr.getWallet === 'function',
        getCoords: typeof qr.getCoords === 'function',
        getIncomingRideRequestCount: typeof qr.getIncomingRideRequestCount === 'function',
        getRideMapGuide: typeof qr.getRideMapGuide === 'function',
        getSocketDebug: typeof qr.getSocketDebug === 'function',
        stateShape: !!(st && typeof st.status === 'string'),
      };
    });

    expect(contract.getState && contract.stateShape).toBeTruthy();
    expect(contract.reset).toBe(true);
    expect(contract.runFullFlow).toBe(true);
    expect(contract.startPickupLeg).toBe(true);
    expect(contract.getCoords).toBe(true);
    expect(contract.getIncomingRideRequestCount).toBe(true);
    expect(contract.getRideMapGuide).toBe(true);
    expect(contract.getWallet).toBe(true);
    expect(contract.getSocketDebug).toBe(true);

    await expect(labPage.getByTestId('qa-flow-guide')).toBeVisible();
    await expect(labPage.getByTestId('ride-status')).toBeVisible();
  });

  test('panel QA puede minimizar y expandir con qa-panel-toggle', async () => {
    await openSimulationQa(labPage);
    await expect(labPage.getByTestId('btn-accept')).toBeVisible();
    await labPage.getByTestId('qa-panel-toggle').click();
    await expect(labPage.getByTestId('btn-accept')).not.toBeVisible();
    await labPage.getByTestId('qa-panel-toggle').click();
    await expect(labPage.getByTestId('btn-accept')).toBeVisible({ timeout: 10_000 });
  });

  test('pickup animado desde QA: botón btn-sim-pickup-leg abre modal llegada al origen', async () => {
    await openSimulationQa(labPage);
    await expect(labPage.getByTestId('qa-panel')).toBeVisible();
    await ensureQaPanelExpanded(labPage);
    await labPage.getByTestId('btn-reset-flow').click();
    await labPage.getByTestId('btn-accept').click();
    await expect(labPage.getByTestId('ride-status')).toHaveText(/accepted/i);

    await ensureQaPanelExpanded(labPage);
    /** Misma acción que el botón (evita clicks en overlay / panel colapsado). Tras aceptar, dar tiempo a poly + distancia. */
    await new Promise((r) => setTimeout(r, 800));
    await labPage.evaluate(() => {
      if (typeof window.qaRide?.startPickupLeg === 'function') window.qaRide.startPickupLeg();
    });

    /** Producción nueva: intervalo mapa; si aún no está desplegada la API, esperamos solo al modal. */
    const hasSimProbe = await labPage.evaluate(() => typeof window.qaRide?.isMapSimulationRunning === 'function');
    if (hasSimProbe) {
      await expect
        .poll(async () => labPage.evaluate(() => window.qaRide.isMapSimulationRunning()), { timeout: 25_000 })
        .toBeTruthy();
      await expect
        .poll(async () => !(await labPage.evaluate(() => window.qaRide.isMapSimulationRunning())), {
          timeout: 120_000
        })
        .toBeTruthy();
    }

    /** Nombre accesible del `<div role="dialog">` puede no incluir el h3 en todos los navegadores; el `id` del título sí es estable (`UberLikeView.vue`). UI escribe «Mas tarde» sin tilde. */
    await expect(labPage.locator('#driver-pickup-title')).toContainText(/llegaste al origen/i, {
      timeout: 120_000
    });
    await labPage.getByRole('button', { name: /^\s*(más tarde|mas tarde)\s*$/i }).click();
  });

  test('full flow + reset + cancel + API global qaRide', async () => {
    await openSimulationQa(labPage);
    await expect(labPage.getByTestId('qa-panel')).toBeVisible();
    await ensureQaPanelExpanded(labPage);
    await labPage.getByTestId('btn-run-full-flow').click();
    // qaRunFullFlow incluye pausas + movimiento (~20–35 s típico); margen CI sin pisar timeout global del spec
    await expect(labPage.getByTestId('ride-status')).toHaveText(/completed/i, { timeout: 120_000 });
    await expect(labPage.getByTestId('event-log')).toContainText(/completed/i);

    const state = await labPage.evaluate(() => window.qaRide?.getState?.());
    expect(state).toBeTruthy();
    expect(String(state.status)).toMatch(/completed/i);

    await labPage.getByTestId('btn-reset-flow').click();
    await expect(labPage.getByTestId('ride-status')).toHaveText(/requested/i);

    /** Tras reinicio no hay cola ni viaje activo: «Cancelar» sigue bloqueado hasta volver a aceptar (estado cancelable). */
    await labPage.getByTestId('btn-accept').click();
    await expect(labPage.getByTestId('ride-status')).toHaveText(/accepted/i);
    await labPage.getByTestId('btn-cancel').click();
    await expect(labPage.getByTestId('ride-status')).toHaveText(/cancelled/i);
  });
});

