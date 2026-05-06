const { test, expect } = require('@playwright/test');
const { createDriverLabPage } = require('../helpers/labSession');
const { openQaLab, ensurePanelExpanded } = require('../helpers/qaLabPage');
const { STAGES, runUntil } = require('../helpers/stageRunner');

const ALLOW_SYNTHETIC = process.env.P2L_ALLOW_SYNTHETIC === '1';

/**
 * Documento producto: `momentum 2 - accepted a llegada pickup (arrived).txt` (repo uber-like).
 *
 * Momentum 2 (post-accept → llegada al origen):
 * premisa: viaje accepted.
 * transición: tramo al pickup (sim) + modal → registrar arrived.
 */
test.describe('M2 · accepted → animación pickup → arrived_pickup', () => {
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

  test('M2: accepted → ir al origen (sim) → modal → Registrar llegada → arrived', async () => {
    console.log(`[momentum M2] solicitud=${ALLOW_SYNTHETIC ? 'real+opcional_sintético' : 'real_estricto'}`);

    await openQaLab(labPage);
    await ensurePanelExpanded(labPage);
    await runUntil(labPage, STAGES.M2_ARRIVED);

    await expect(labPage.getByTestId('ride-status')).toHaveText(/arrived/i);
    await expect(labPage.getByTestId('btn-start')).toBeEnabled();
    await expect(labPage.getByTestId('btn-arrived')).toBeDisabled();

    const st = await labPage.evaluate(() => window.qaRide?.getState?.() ?? null);
    expect(String(st?.status || '')).toMatch(/arrived/i);
  });
});
