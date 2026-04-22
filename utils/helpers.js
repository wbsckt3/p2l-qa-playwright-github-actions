/**
 * Utilidades reutilizables para interacción estable con la UI.
 */

/**
 * Clic con espera a estado visible y habilitado.
 * @param {import('@playwright/test').Locator} locator
 * @param {{ timeout?: number }} [opts] — p. ej. flujo Google; el actionTimeout global en CI es corto
 */
async function safeClick(locator, opts) {
  const t = opts && opts.timeout;
  await locator.waitFor({ state: 'visible', ...(t != null ? { timeout: t } : {}) });
  await locator.click({ trial: false, ...(t != null ? { timeout: t } : {}) });
}

/**
 * Relleno con limpieza previa y espera de visibilidad.
 * @param {import('@playwright/test').Locator} locator
 * @param {string} text
 * @param {{ timeout?: number }} [opts]
 */
async function safeFill(locator, text, opts) {
  const t = opts && opts.timeout;
  await locator.waitFor({ state: 'visible', ...(t != null ? { timeout: t } : {}) });
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
