const { test, expect } = require('@playwright/test');
const { openQaLab, ensurePanelExpanded, expectEventLogContains } = require('./helpers/qaLabPage');
const { STAGES, runUntil } = require('./helpers/stageRunner');

const PROD_ORIGIN = 'https://www.refactorii.com';
const LAB_GEO = { latitude: 6.247638, longitude: -75.56583 };
const TARGET_STAGE = process.env.P2L_STAGE_TARGET || STAGES.M1_ACCEPTED;
const ALLOW_SYNTHETIC = process.env.P2L_ALLOW_SYNTHETIC === '1';

test.describe('QA Lab · Momentum 1 (request_sent/request_viewed -> accepted)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(['geolocation', 'notifications'], { origin: PROD_ORIGIN });
    await context.setGeolocation(LAB_GEO);
    await openQaLab(page);
    await ensurePanelExpanded(page);
  });

  test('M1: la simulación llega hasta accepted y deja señales QA verificables', async ({ page }) => {
    console.log(
      `[qa-lab/m1] modo solicitud=${ALLOW_SYNTHETIC ? 'real+fallback_sintetico' : 'real_estricto'} stage=${STAGES.M1_ACCEPTED}`
    );
    await runUntil(page, STAGES.M1_ACCEPTED);

    await expect(page.getByTestId('btn-accept')).toBeDisabled();
    /**
     * Tras accepted, el flujo QA ordena primero «Ir al origen (sim)»;
     * «Registrar llegada al origen» sigue bloqueado hasta latch/modal (M2, no M1).
     */
    await expect(page.getByTestId('btn-q-pickup-leg')).toBeEnabled();
    await expect(page.getByTestId('btn-arrived')).toBeDisabled();
    await expect(page.getByTestId('trip-counter')).toBeVisible();
    await expect(page.getByTestId('wallet-balance')).toBeVisible();

    const state = await page.evaluate(() => window.qaRide?.getState?.() ?? null);
    expect(state).toBeTruthy();
    expect(String(state?.status || '')).toMatch(/accepted/i);
    expect(String(state?.rideId || '')).not.toBe('—');

    await expectEventLogContains(page, /(qa mode enabled|solicitado.*aceptado|accepted)/i);
  });

  test('runner por stages: permite ejecutar momentum por tramo', async ({ page }) => {
    console.log(
      `[qa-lab/m1] modo solicitud=${ALLOW_SYNTHETIC ? 'real+fallback_sintetico' : 'real_estricto'} stage=${TARGET_STAGE}`
    );
    await runUntil(page, TARGET_STAGE);

    const expectedByStage = {
      [STAGES.M1_REQUESTED]: /requested/i,
      [STAGES.M1_ACCEPTED]: /accepted/i,
      [STAGES.M2_ARRIVED]: /arrived/i,
      [STAGES.M3_IN_PROGRESS]: /in_progress/i,
      [STAGES.M4_COMPLETED]: /completed/i,
    };

    const expected = expectedByStage[TARGET_STAGE] || /accepted/i;
    await expect(page.getByTestId('ride-status')).toHaveText(expected);
  });
});
