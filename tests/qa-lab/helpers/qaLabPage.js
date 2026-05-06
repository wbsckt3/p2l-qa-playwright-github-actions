const { expect } = require('@playwright/test');
const { SIMULATION_ROUTES } = require('../../../utils/testData');

/** Mismo criterio que `uber-like-lab-await-passenger.spec.js`: SPA puede tardar tras `load`. */
const QA_PANEL_WAIT_MS = Number.parseInt(process.env.P2L_QA_PANEL_WAIT_MS || '45000', 10) || 45000;

function resolveLabPath(path) {
  const base = (process.env.PLAYWRIGHT_FORCE_BASE_URL || '').trim().replace(/\/$/, '');
  if (!base) return path.startsWith('/') ? path : `/${path}`;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function dismissOptionalPushModal(page) {
  const dismiss = page.getByTestId('btn-push-dismiss');
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
}

async function openQaLab(page) {
  const nav = { waitUntil: 'domcontentloaded', timeout: 60_000 };
  let lastErr = null;

  for (const route of SIMULATION_ROUTES) {
    const path = route.startsWith('/') ? route : `/${route}`;
    const target = resolveLabPath(path);
    try {
      await page.goto(target, nav);
      await dismissOptionalPushModal(page);
      await page.waitForSelector('[data-testid="qa-panel"]', { state: 'visible', timeout: QA_PANEL_WAIT_MS });
      await expect
        .poll(async () => page.evaluate(() => typeof window.qaRide?.getState === 'function'), { timeout: 25_000 })
        .toBe(true);
      return path;
    } catch (e) {
      lastErr = e;
    }
  }

  let diag = '';
  try {
    diag = ` url=${await page.url()} title=${await page.title()}`;
  } catch (_) {
    diag = '';
  }
  throw new Error(
    `No se pudo abrir qa-panel en rutas: ${SIMULATION_ROUTES.join(', ')}.${diag}` +
      (lastErr ? ` Último error: ${lastErr.message}` : '') +
      ' Revisa red, que ?qa=true esté en la URL y sube P2L_QA_PANEL_WAIT_MS si la SPA va lenta.'
  );
}

async function ensurePanelExpanded(page) {
  const body = page.locator('.qa-panel-body');
  if (await body.isVisible().catch(() => false)) return;
  const toggle = page.getByTestId('qa-panel-toggle');
  if (await toggle.isVisible().catch(() => false)) {
    await toggle.click();
    await expect(body).toBeVisible({ timeout: 10_000 });
  }
}

async function resetFlow(page) {
  await ensurePanelExpanded(page);
  const reset = page.getByTestId('btn-reset-flow');
  if (await reset.isVisible().catch(() => false)) {
    await reset.click();
  } else {
    await page.evaluate(() => window.qaRide?.reset?.());
  }
}

async function clickFlowButton(page, testId) {
  await ensurePanelExpanded(page);
  await page.getByTestId(testId).click();
}

async function getIncomingCount(page) {
  return page.evaluate(() => Number(window.qaRide?.getIncomingRideRequestCount?.() ?? 0));
}

async function seedSyntheticIncomingIfAvailable(page) {
  const before = await getIncomingCount(page);
  await page.evaluate(async () => {
    if (typeof window.qaRide?.simStepDriverM1Incoming === 'function') {
      await window.qaRide.simStepDriverM1Incoming();
    }
  });
  await page.waitForTimeout(600);
  const after = await getIncomingCount(page);
  return after > before;
}

async function waitForIncomingRequest(page, timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const count = await getIncomingCount(page);
    if (count > 0) return count;
    await page.waitForTimeout(2000);
  }
  return 0;
}

async function expectRideStatus(page, statusRegex, timeout = 45_000) {
  await expect(page.getByTestId('ride-status')).toHaveText(statusRegex, { timeout });
  await expect
    .poll(
      async () => {
        const st = await page.evaluate(() => window.qaRide?.getState?.() ?? null);
        return String(st?.status || '');
      },
      { timeout }
    )
    .toMatch(statusRegex);
}

async function expectEventLogContains(page, textOrRegex) {
  const log = page.getByTestId('event-log');
  await expect(log).toBeVisible();
  if (typeof textOrRegex === 'string') {
    await expect(log).toContainText(textOrRegex);
  } else {
    await expect(log).toContainText(textOrRegex);
  }
}

/**
 * Tras `accepted`: animación conductor→pickup + modal «Llegaste al origen».
 * Sin esto, `btn-arrived` sigue bloqueado (latch QA / producto).
 * Misma estrategia que `tests/uber-like-simulation-qa.spec.js`.
 */
async function completePickupLegAndDismissArrivalModal(page) {
  await ensurePanelExpanded(page);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (typeof window.qaRide?.startPickupLeg === 'function') window.qaRide.startPickupLeg();
  });

  const hasSimProbe = await page.evaluate(() => typeof window.qaRide?.isMapSimulationRunning === 'function');
  if (hasSimProbe) {
    await expect
      .poll(async () => page.evaluate(() => window.qaRide.isMapSimulationRunning()), { timeout: 25_000 })
      .toBeTruthy();
    await expect
      .poll(async () => !(await page.evaluate(() => window.qaRide.isMapSimulationRunning())), {
        timeout: 120_000,
      })
      .toBeTruthy();
  }

  await expect(page.locator('#driver-pickup-title')).toContainText(/llegaste al origen/i, {
    timeout: 120_000,
  });
  await page.getByRole('button', { name: /^\s*(más tarde|mas tarde)\s*$/i }).click();
}

module.exports = {
  openQaLab,
  ensurePanelExpanded,
  resetFlow,
  clickFlowButton,
  getIncomingCount,
  seedSyntheticIncomingIfAvailable,
  waitForIncomingRequest,
  expectRideStatus,
  expectEventLogContains,
  completePickupLegAndDismissArrivalModal,
};
