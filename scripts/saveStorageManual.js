require('dotenv').config();

const { chromium } = require('playwright');
const path = require('path');
const readline = require('readline');
const { resolveChromeLaunch } = require('../utils/chromeExecutable');

const GOTO_RETRIES = 3;
const GOTO_RETRY_MS = 2_000;

function printGotoFailureHelp(targetUrl, err) {
  console.error('\n--- page.goto falló (net::ERR_* suele ser red / proxy / antivirus / firewall) ---');
  console.error(String(err.message || err));
  console.error('\nQué probar en Windows:');
  console.error('  · Abrir la misma URL en Chrome normal; si ahí carga, prueba:');
  console.error('    $env:PLAYWRIGHT_USE_CHROMIUM="1"; npm run storage:save');
  console.error('  · VPN corporativa / proxy: excepciones o otro puerto puede bloquear el perfil de Playwright.');
  console.error('  · Otro objetivo (si el bloqueo es solo a /dashboard):');
  console.error('    $env:P2L_DASHBOARD_URL="https://www.refactorii.com/p2l-tenant/"');
  console.error(`\nURL intentada: ${targetUrl}`);
  console.error('---\n');
}

async function gotoWithRetries(page, url) {
  let lastErr;
  for (let i = 0; i < GOTO_RETRIES; i++) {
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      return true;
    } catch (e) {
      lastErr = e;
      if (i < GOTO_RETRIES - 1) {
        console.warn(`[storage:save] goto intento ${i + 1}/${GOTO_RETRIES} falló, reintento en ${GOTO_RETRY_MS}ms…`);
        await new Promise((r) => setTimeout(r, GOTO_RETRY_MS));
      }
    }
  }
  printGotoFailureHelp(url, lastErr);
  return false;
}

async function waitForEnter(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  const output = process.env.STORAGE_STATE_OUTPUT || 'storageState.json';
  const targetUrl = process.env.P2L_DASHBOARD_URL || 'https://www.refactorii.com/p2l-tenant/dashboard';
  /**
   * En GitHub Actions el workflow instala y usa Google Chrome (channel: 'chrome', v. playwright.config).
   * PLAYWRIGHT_USE_CHROMIUM=1 fuerza el Chromium empaquetado (sin Chrome en el SO).
   * STORAGE_FOR_CI=1 usa un perfil distinto (./playwright/.tmp-profile-ci) pero el mismo channel chrome que en CI.
   */
  const forCi = process.env.STORAGE_FOR_CI === '1';
  const usePureChromium = process.env.PLAYWRIGHT_USE_CHROMIUM === '1';
  /** Igual que en playwright.config.js: chrome.exe conocido o `channel: 'chrome'`. */
  const chromeLaunch = usePureChromium ? null : resolveChromeLaunch();
  /**
   * Perfil único por ejecución evita Chrome (“Se está abriendo en una sesión de navegador existente”).
   * STORAGE_REUSE_PROFILE=1 reutiliza `./.tmp-profile`; cerrá Chrome antes para no bloquear el lock del perfil.
   */
  const reuseTmp = !forCi && process.env.STORAGE_REUSE_PROFILE === '1';
  const profileSubdir = forCi
    ? '.tmp-profile-ci'
    : reuseTmp
      ? '.tmp-profile'
      : `.save-session-${Date.now()}`;
  const userDataDir = path.join(process.cwd(), 'playwright', profileSubdir);
  if (!forCi && !reuseTmp) {
    console.log(`[storage:save] Perfil aislado: ${profileSubdir}`);
  }

  /** Script solo se usa local; quitar `--no-sandbox` del default de Playwright (banner amarillo en Chrome). */
  const stealth =
    process.env.PLAYWRIGHT_USE_AUTOMATION_STEALTH === '1'
      ? ['--disable-blink-features=AutomationControlled']
      : [];
  const baseOpts = {
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    args: [
      '--start-maximized',
      ...stealth,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  };

  const context = usePureChromium
    ? await chromium.launchPersistentContext(userDataDir, baseOpts)
    : await chromium.launchPersistentContext(userDataDir, {
        ...baseOpts,
        ...(chromeLaunch.mode === 'executable'
          ? { executablePath: chromeLaunch.path }
          : { channel: 'chrome' }),
      });

  try {
    const page = context.pages()[0] || (await context.newPage());
    const landed = await gotoWithRetries(page, targetUrl);
    if (!landed) {
      await page.goto('about:blank').catch(() => {});
      console.log('\n=== Guardado manual de storageState (navegación inicial falló) ===');
      console.log('Se abrió el navegador; ve manualmente a la URL del panel y completa el login:');
      console.log(`  ${targetUrl}`);
      console.log('(También puedes probar P2L_DASHBOARD_URL con la raíz del tenant, p. ej. …/p2l-tenant/)\n');
    } else {
      console.log('\n=== Guardado manual de storageState ===');
    }
    if (usePureChromium) {
      console.log('MODO: Chromium empaquetado (PLAYWRIGHT_USE_CHROMIUM=1; no es Google Chrome instalado).');
    } else if (chromeLaunch.mode === 'executable') {
      console.log('MODO: Google Chrome —', chromeLaunch.path, '(' + chromeLaunch.hint + ')');
    } else if (forCi) {
      console.log('MODO: Google Chrome (channel; perfil CI) — alineado con Actions.');
    } else {
      console.log('MODO: Google Chrome (`channel` del sistema); sin chrome.exe típico en disco.');
    }
    console.log(`URL objetivo: ${targetUrl}`);
    console.log('1) Completa login Google en la ventana del navegador');
    console.log('2) Verifica que quedaste en dashboard');
    console.log('3) Regresa a esta consola y presiona ENTER para guardar\n');

    await waitForEnter('Presiona ENTER para guardar storageState... ');

    const resolved = path.resolve(process.cwd(), output);
    await context.storageState({ path: resolved });
    console.log(`\nOK: storageState guardado en ${resolved}`);
    console.log('Siguiente paso: puede usar el JSON con PLAYWRIGHT_STORAGE_STATE en local, o dejar de usarlo: en CI se genera la sesión en el workflow (ver README).');
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

