const { expect } = require('@playwright/test');
const { SIMULATION_ROUTES } = require('../../../utils/testData');

async function dismissOptionalPushModal(page) {
  const dismiss = page.getByTestId('btn-push-dismiss');
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
}

async function openQaLab(page) {
  const wait = { waitUntil: 'load' };

  for (const route of SIMULATION_ROUTES) {
    const path = route.startsWith('/') ? route : `/${route}`;
    await page.goto(path, wait);
    await dismissOptionalPushModal(page);
    const panel = page.getByTestId('qa-panel');
    if (await panel.isVisible().catch(() => false)) {
      await expect
        .poll(async () => page.evaluate(() => typeof window.qaRide?.getState === 'function'), { timeout: 20_000 })
        .toBe(true);
      return path;
    }
  }
  throw new Error(`No se pudo abrir qa-panel en rutas: ${SIMULATION_ROUTES.join(', ')}`);
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
};
