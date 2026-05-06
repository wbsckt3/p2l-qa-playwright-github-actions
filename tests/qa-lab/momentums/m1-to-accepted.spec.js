const { test, expect } = require('@playwright/test');
const { createDriverLabPage } = require('../helpers/labSession');
const { openQaLab, ensurePanelExpanded, expectEventLogContains } = require('../helpers/qaLabPage');
const { STAGES, runUntil } = require('../helpers/stageRunner');

const ALLOW_SYNTHETIC = process.env.P2L_ALLOW_SYNTHETIC === '1';

/**
 * Documento producto: `momentum 1 - transiciones de estado a accepted.txt` (repo uber-like).
 *
 * Momentum 1 (documento «solicitud → match»):
 * premisa: solicitud real en cola (ride_request).
 * transición: aceptar conductor → estado accepted (asignación).
 */
test.describe('M1 · cola / matching → accepted', () => {
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

  test('M1: solicitud real en cola → Aceptar → accepted', async () => {
    console.log(`[momentum M1] solicitud=${ALLOW_SYNTHETIC ? 'real+opcional_sintético' : 'real_estricto'}`);

    await openQaLab(labPage);
    await ensurePanelExpanded(labPage);
    await runUntil(labPage, STAGES.M1_ACCEPTED);

    await expect(labPage.getByTestId('btn-accept')).toBeDisabled();
    await expect(labPage.getByTestId('btn-q-pickup-leg')).toBeEnabled();
    await expect(labPage.getByTestId('btn-arrived')).toBeDisabled();
    await expect(labPage.getByTestId('trip-counter')).toBeVisible();
    await expect(labPage.getByTestId('wallet-balance')).toBeVisible();

    const state = await labPage.evaluate(() => window.qaRide?.getState?.() ?? null);
    expect(state).toBeTruthy();
    expect(String(state?.status || '')).toMatch(/accepted/i);
    expect(String(state?.rideId || '')).not.toBe('—');

    await expectEventLogContains(labPage, /(qa mode enabled|solicitado.*aceptado|accepted)/i);
  });
});
