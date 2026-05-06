const { test, expect } = require('@playwright/test');
const { createDriverLabPage } = require('../helpers/labSession');
const { openQaLab, ensurePanelExpanded } = require('../helpers/qaLabPage');
const { STAGES, runUntil } = require('../helpers/stageRunner');

const ALLOW_SYNTHETIC = process.env.P2L_ALLOW_SYNTHETIC === '1';

/**
 * Momentum 4: cierre del viaje.
 * premisa: trayecto in_progress.
 * transición: Completar viaje → completed.
 */
test.describe('M4 · in_progress → completed', () => {
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

  test('M4: en curso → Completar viaje → completed', async () => {
    console.log(`[momentum M4] solicitud=${ALLOW_SYNTHETIC ? 'real+opcional_sintético' : 'real_estricto'}`);

    await openQaLab(labPage);
    await ensurePanelExpanded(labPage);
    await runUntil(labPage, STAGES.M4_COMPLETED);

    await expect(labPage.getByTestId('ride-status')).toHaveText(/completed/i);

    const st = await labPage.evaluate(() => window.qaRide?.getState?.() ?? null);
    expect(String(st?.status || '')).toMatch(/completed/i);
  });
});
