const {
  resetFlow,
  clickFlowButton,
  getIncomingCount,
  seedSyntheticIncomingIfAvailable,
  waitForIncomingRequest,
  expectRideStatus,
  expectEventLogContains,
  completePickupLegAndDismissArrivalModal,
} = require('./qaLabPage');

const STAGES = Object.freeze({
  M1_REQUESTED: 'M1_REQUESTED',
  M1_ACCEPTED: 'M1_ACCEPTED',
  M2_ARRIVED: 'M2_ARRIVED',
  M3_IN_PROGRESS: 'M3_IN_PROGRESS',
  M4_COMPLETED: 'M4_COMPLETED',
});

async function runUntil(page, stage) {
  await resetFlow(page);
  await expectRideStatus(page, /requested/i, 30_000);

  // Por defecto exigimos solicitud REAL del pasajero (paridad prod+lab).
  // Fallback sintético solo si se activa explícitamente: P2L_ALLOW_SYNTHETIC=1
  const allowSynthetic = process.env.P2L_ALLOW_SYNTHETIC === '1';
  const incomingWaitMs = Number.parseInt(process.env.P2L_INCOMING_WAIT_MS || '180000', 10) || 180000;

  let incoming = await getIncomingCount(page);
  if (incoming < 1) {
    if (allowSynthetic) {
      const syntheticSeeded = await seedSyntheticIncomingIfAvailable(page);
      if (syntheticSeeded) incoming = await getIncomingCount(page);
    }
  }
  if (incoming < 1) incoming = await waitForIncomingRequest(page, incomingWaitMs);
  if (incoming < 1) {
    const diag = await page.evaluate(() => ({
      state: window.qaRide?.getState?.() ?? null,
      socket: window.qaRide?.getSocketDebug?.() ?? null,
      incoming: window.qaRide?.getIncomingRideRequestCount?.() ?? null,
    }));
    const modeHint = allowSynthetic
      ? 'Con P2L_ALLOW_SYNTHETIC=1 también se intentó semilla sintética.'
      : 'Modo estricto real: solicita viaje desde pasajero real en paralelo.';
    throw new Error(`No llegó solicitud para M1 (incoming=0). ${modeHint} Diag: ${JSON.stringify(diag)}`);
  }

  if (stage === STAGES.M1_REQUESTED) {
    return;
  }

  await clickFlowButton(page, 'btn-accept');
  await expectRideStatus(page, /accepted/i, 60_000);
  await expectEventLogContains(page, /(aceptad|accepted|request.*accepted|solicitado.*aceptado)/i);
  if (stage === STAGES.M1_ACCEPTED) {
    return;
  }

  await completePickupLegAndDismissArrivalModal(page);

  await clickFlowButton(page, 'btn-arrived');
  await expectRideStatus(page, /arrived/i, 60_000);
  if (stage === STAGES.M2_ARRIVED) {
    return;
  }

  await clickFlowButton(page, 'btn-start');
  await expectRideStatus(page, /in_progress/i, 60_000);
  if (stage === STAGES.M3_IN_PROGRESS) {
    return;
  }

  await clickFlowButton(page, 'btn-complete');
  await expectRideStatus(page, /completed/i, 60_000);
}

module.exports = {
  STAGES,
  runUntil,
};
