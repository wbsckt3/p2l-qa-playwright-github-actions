const { test, expect } = require('@playwright/test');
const { createDriverLabPage } = require('../helpers/labSession');
const { openQaLab, ensurePanelExpanded } = require('../helpers/qaLabPage');
const { STAGES, runUntil } = require('../helpers/stageRunner');

const ALLOW_SYNTHETIC = process.env.P2L_ALLOW_SYNTHETIC === '1';

/**
 * Momentum 3: viaje en trayecto hacia destino (in_progress).
 * premisa: arrived en origen.
 * transición: Iniciar hacia destino.
 */
test.describe('M3 · arrived → in_progress (ruta pickup → destino)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  /** @type {import('@playwright/test').BrowserContext | undefined} */
  let labContext;
  /** @type {import('@playwright/test').Page | undefined} */
  let labPage;

  test.beforeAll(async ({ browser }) => {
    const s = await createDriverLabPage(browser);
    labContext = s.context;
    labPage = s.page;
  });

  test.afterAll(async () => {
    await labContext?.close();
  });

  test('M3: arrived → Iniciar hacia destino → in_progress', async () => {
    console.log(`[momentum M3] solicitud=${ALLOW_SYNTHETIC ? 'real+opcional_sintético' : 'real_estricto'}`);

    await openQaLab(labPage);
    await ensurePanelExpanded(labPage);
    await runUntil(labPage, STAGES.M3_IN_PROGRESS);

    await expect(labPage.getByTestId('ride-status')).toHaveText(/in_progress/i);
    await expect(labPage.getByTestId('btn-complete')).toBeEnabled();

    const st = await labPage.evaluate(() => window.qaRide?.getState?.() ?? null);
    expect(String(st?.status || '')).toMatch(/in_progress/i);
  });
});
