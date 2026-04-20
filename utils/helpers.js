/**
 * Utilidades reutilizables para interacción estable con la UI.
 */

/**
 * Clic con espera a estado visible y habilitado.
 * @param {import('@playwright/test').Locator} locator
 */
async function safeClick(locator) {
  await locator.waitFor({ state: 'visible' });
  await locator.click({ trial: false });
}

/**
 * Relleno con limpieza previa y espera de visibilidad.
 * @param {import('@playwright/test').Locator} locator
 * @param {string} text
 */
async function safeFill(locator, text) {
  await locator.waitFor({ state: 'visible' });
  await locator.fill('');
  await locator.fill(text);
}

/**
 * Espera explícita a visible (o attached si se indica).
 * @param {import('@playwright/test').Locator} locator
 * @param {{ state?: 'visible'|'attached'; timeout?: number }} [opts]
 */
async function waitVisible(locator, opts = {}) {
  const state = opts.state || 'visible';
  const timeout = opts.timeout;
  await locator.waitFor({ state, ...(timeout != null ? { timeout } : {}) });
}

/**
 * Sufijo único para nombres de empresa o archivos.
 * @param {string} prefix
 */
function takeTimestampName(prefix) {
  return `${prefix}${Date.now()}`;
}

module.exports = {
  safeClick,
  safeFill,
  waitVisible,
  takeTimestampName,
};
