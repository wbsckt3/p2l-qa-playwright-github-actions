const fs = require('fs');
const path = require('path');

const MAX_CONSOLE_LINES = 50;

const consoleBufferByPage = new WeakMap();

/**
 * @param {import('@playwright/test').Page} page
 * @returns {string[]}
 */
function getOrCreateBuffer(page) {
  let b = consoleBufferByPage.get(page);
  if (!b) {
    b = [];
    consoleBufferByPage.set(page, b);
  }
  return b;
}

/**
 * Registra un buffer de consola/página; idempotente por Page.
 * @param {import('@playwright/test').Page} page
 */
function attachPageConsoleBuffer(page) {
  if (page.__p2lConsoleBuffer) return;
  page.__p2lConsoleBuffer = true;
  const push = (line) => {
    const b = getOrCreateBuffer(page);
    b.push(line);
    while (b.length > MAX_CONSOLE_LINES) b.shift();
  };
  page.on('console', (msg) => {
    push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    push(`[pageerror] ${err && err.message ? err.message : String(err)}`);
  });
}

/**
 * @returns {boolean}
 */
function shouldRunDiagnostics() {
  return process.env.CI === 'true';
}

/**
 * Guarda captura, URL, título, fragmento de body y consola bajo `test-results/ci-debug/`.
 * @param {import('@playwright/test').Page} page
 * @param {string} [label]
 * @param {{ onLogin: boolean; bodySignalMatch: boolean }} [meta]
 * @returns {Promise<string[]>} paths guardados
 */
async function captureCIFailure(page, label = 'fail', meta = { onLogin: false, bodySignalMatch: false }) {
  const outDir = path.join('test-results', 'ci-debug');
  fs.mkdirSync(outDir, { recursive: true });
  const ts = Date.now();
  const base = label.replace(/[^\w.-]+/g, '_') + `-${ts}`;
  const imgPath = path.join(outDir, `${base}.png`);
  const reportPath = path.join(outDir, `${base}.txt`);
  const consolePath = path.join(outDir, `console-${base}.txt`);

  await page.screenshot({ path: imgPath, fullPage: true }).catch(() => {});

  const pageUrl = page.url();
  const title = await page.title().catch(() => '(error title)');
  const body = (await page.locator('body').innerText().catch(() => '')).slice(0, 4000);
  const buf = getOrCreateBuffer(page);
  const consoleText = buf.length ? buf.join('\n') : '(sin líneas de consola capturadas)';

  const report = [
    `url: ${pageUrl}`,
    `title: ${title}`,
    `onLogin_ui: ${meta.onLogin ? 'sí' : 'no'}`,
    `bodySignalMatch: ${meta.bodySignalMatch ? 'sí' : 'no'}`,
    '',
    '--- body (truncado) ---',
    body,
  ].join('\n');

  fs.writeFileSync(reportPath, report, 'utf8');
  fs.writeFileSync(consolePath, consoleText, 'utf8');
  return [imgPath, reportPath, consolePath];
}

module.exports = {
  attachPageConsoleBuffer,
  captureCIFailure,
  shouldRunDiagnostics,
};
