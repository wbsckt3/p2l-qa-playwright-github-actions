const { test, expect } = require('@playwright/test');
const { SIMULATION_ROUTES } = require('../utils/testData');

/**
 * Flujo híbrido (paridad producción en lo que el lab permite):
 *
 * - **Pasajero:** solicitud **manual** desde la app uber-like normal (producción / mismo tenant). No abre la URL del lab.
 * - **Conductor:** misma `UberLikeView` que en producción, con mock de auth vía `/simulacion-lab?role=driver&qa=true`.
 *   Playwright solo automatiza clics en la **interfaz conductor real** (p. ej. `btn-accept`), no reemplaza al backend.
 *   El panel QA es extra; notificaciones y footer/modales dependen del producto + permisos del navegador (Playwright ya pide geo + notifications).
 *
 * El test abre Chromium (headed recomendado), deja la vista lista y espera hasta
 * `getIncomingRideRequestCount() > 0` cuando el pasajero envía la solicitud.
 * Si no está en modo manual, pulsa Accept y comprueba estado `accepted` como vería producción (+ tiempo en vivo para UX).
 *
 * Cerrar un modal NO cierra Chrome: al ver "1 passed" Playwright terminó el test y destruye el navegador.
 *
 * Para demo / operar vos el panel QA (sin auto-Accept y sin cierre instantáneo):
 *   $env:P2L_LAB_MANUAL_MODE='1'
 *   $env:P2L_KEEP_OPEN_MS='3600000'   # ej. 1 h
 *
 * Tras Accept automático, por defecto deja abierto otros 120s (`P2L_KEEP_OPEN_AFTER_AUTO_MS`; `0`=cerrar ya).
 *
 * Requisitos: mismo tenant y geolocalización cercana al móvil.
 *
 *   $env:P2L_LAB_AWAIT_REAL_PASSENGER='1'
 *   npx playwright test tests/uber-like-lab-await-passenger.spec.js --headed --project=chrome --workers=1 --reporter=list
 */

const PROD_ORIGIN = 'https://www.refactorii.com';

async function dismissOptionalPushModal(page) {
  const dismiss = page.getByTestId('btn-push-dismiss');
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
}

async function openSimulationQaLab(page) {
  const wait = { waitUntil: 'load' };

  async function tryHit(path) {
    await page.goto(path, wait);
    await dismissOptionalPushModal(page);
    try {
      await page.waitForSelector('[data-testid="qa-panel"]', { state: 'visible', timeout: 45000 });
      return true;
    } catch {
      return false;
    }
  }

  for (const route of SIMULATION_ROUTES) {
    const rq = route.startsWith('/') ? route : `/${route}`;
    if (await tryHit(rq)) {
      await expect
        .poll(async () => page.evaluate(() => !!window.qaRide?.getIncomingRideRequestCount), { timeout: 20000 })
        .toBe(true);
      return;
    }
  }

  throw new Error(`[await passenger] qa-panel no abrió para rutas: ${SIMULATION_ROUTES.join(', ')}`);
}

const GEO = {
  lat: Number.parseFloat(process.env.P2L_GEO_LAT || '6.247638'),
  lng: Number.parseFloat(process.env.P2L_GEO_LNG || '-75.56583'),
};

const INCOMING_WAIT_MS = Math.min(
  45 * 60 * 1000,
  Number.parseInt(process.env.P2L_INCOMING_WAIT_MS || `${45 * 60 * 1000}`, 10) || 45 * 60 * 1000
);
const MANUAL_MODE = process.env.P2L_LAB_MANUAL_MODE === '1';
const KEEP_OPEN_MS = Math.max(0, Number.parseInt(process.env.P2L_KEEP_OPEN_MS || '0', 10) || 0);
/** Tras hacer Accept desde el propio test (no modo manual): segundos extra antes de que Playwright cierre Chrome. */
const KEEP_OPEN_AFTER_AUTO_MS = Math.max(
  0,
  Number.parseInt(process.env.P2L_KEEP_OPEN_AFTER_AUTO_MS ?? '120000', 10) || 0
);

test.use({ trace: 'off', video: 'off' });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForIncomingRideRequest(page, timeoutMs) {
  const startedAt = Date.now();
  let lastLogAt = 0;
  while (Date.now() - startedAt < timeoutMs) {
    const elapsed = Date.now() - startedAt;
    if (elapsed - lastLogAt >= 30_000) {
      lastLogAt = elapsed;
      try {
        const diag = await page.evaluate(() => {
          const count = window.qaRide?.getIncomingRideRequestCount?.() ?? -1;
          const socket = window.qaRide?.getSocketDebug?.() ?? null;
          return { count, socket };
        });
        console.log(
          `[await passenger] esperando... ${Math.round(elapsed / 1000)}s count=${diag?.count} socket=${JSON.stringify(diag?.socket)}`
        );
      } catch (_) {
        console.log(`[await passenger] esperando... ${Math.round(elapsed / 1000)}s (sin diagnóstico: navegación/cambio de página)`);
      }
    }
    if (page.isClosed()) {
      throw new Error(
        'La ventana de Playwright se cerró durante la espera. Mantén Chrome abierto hasta que llegue la solicitud del móvil.'
      );
    }
    try {
      const count = await page.evaluate(() => window.qaRide?.getIncomingRideRequestCount?.() ?? -1);
      if (Number(count) >= 1) return Number(count);
    } catch (_) {
      // Navegación/recarga transitoria: reintentar en el próximo ciclo.
    }
    await sleep(2000);
  }
  return 0;
}

test.describe('Lab mock conductor · esperar pasajero real (producción)', () => {
  test.beforeEach(async ({ context }) => {
    test.skip(
      process.env.P2L_LAB_AWAIT_REAL_PASSENGER !== '1',
      'Activa P2L_LAB_AWAIT_REAL_PASSENGER=1 para este manual (pasajero móvil + mock conductor en lab).'
    );

    await context.grantPermissions(['geolocation', 'notifications'], { origin: PROD_ORIGIN });
    await context.setGeolocation({ latitude: GEO.lat, longitude: GEO.lng });
  });

  test(
    'espera solicitud entrante y acepta (sin reset; ride real desde móvil)',
    { timeout: INCOMING_WAIT_MS + 180_000 },
    async ({ page }) => {
      test.setTimeout(INCOMING_WAIT_MS + 180_000);
      console.log(
        `[await passenger] esperando solicitud real hasta ${Math.round(INCOMING_WAIT_MS / 1000)}s (geo conductor=${GEO.lat},${GEO.lng})`
      );
      await openSimulationQaLab(page);

      // No hacer Reset antes de la llegada — vaciaría estado local antes del ride real.
      const incomingCount = await waitForIncomingRideRequest(page, INCOMING_WAIT_MS);
      if (incomingCount < 1) {
        const finalDiag = await page.evaluate(() => ({
          count: window.qaRide?.getIncomingRideRequestCount?.() ?? -1,
          socket: window.qaRide?.getSocketDebug?.() ?? null,
          state: window.qaRide?.getState?.() ?? null,
        })).catch(() => null);
        console.log(`[await passenger] fin espera sin solicitud. diagnóstico final=${JSON.stringify(finalDiag)}`);
      }
      expect(incomingCount).toBeGreaterThanOrEqual(1);

      if (MANUAL_MODE) {
        const holdMs = KEEP_OPEN_MS || 15 * 60 * 1000;
        console.log(
          `[await passenger] modo manual activo: no auto-Accept. Manteniendo Chrome abierto ${Math.round(holdMs / 1000)}s para operar panel QA.`
        );
        await sleep(holdMs);
        return;
      }

      await page.getByTestId('btn-accept').click();
      /** Misma SPA que prod: texto de estado + reflejo en API QA (pasajero en móvil debería ver aceptación en paralelo). */
      await expect(page.getByTestId('ride-status')).toHaveText(/accepted/i, { timeout: 90_000 });
      await expect
        .poll(
          async () => {
            const st = await page.evaluate(() => window.qaRide?.getState?.() ?? null);
            return String(st?.status || '');
          },
          { timeout: 30_000 }
        )
        .toMatch(/accepted/i);

      const hangMs = KEEP_OPEN_MS > 0 ? KEEP_OPEN_MS : KEEP_OPEN_AFTER_AUTO_MS;
      if (hangMs > 0) {
        console.log(
          `[await passenger] Accept automático OK. Chrome se cerrará en ${Math.round(hangMs / 1000)}s (añade P2L_LAB_MANUAL_MODE=1 o sube KEEP_OPEN_* para demo más larga).`
        );
        await sleep(hangMs);
      }
    }
  );
});
