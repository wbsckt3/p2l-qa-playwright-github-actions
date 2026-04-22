const { chromium } = require('playwright');
const path = require('path');
const readline = require('readline');

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
   * En GitHub Actions se usa el Chromium de Playwright, no "Chrome" del SO.
   * Si se guarda el storage con Chrome y luego se corre en CI con Chromium, la sesión puede no aplicar
   * (mismo sitio, pero otra huella/aislamiento de storage).
   * STORAGE_FOR_CI=1 abre el Chromium empaquetado, alineado con el runner.
   */
  const forCi = process.env.STORAGE_FOR_CI === '1' || process.env.PLAYWRIGHT_USE_CHROMIUM === '1';
  const userDataDir = path.join(
    process.cwd(),
    'playwright',
    forCi ? '.tmp-profile-ci' : '.tmp-profile'
  );

  const baseOpts = {
    headless: false,
    viewport: null,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  };

  const context = forCi
    ? await chromium.launchPersistentContext(userDataDir, baseOpts)
    : await chromium.launchPersistentContext(userDataDir, { ...baseOpts, channel: 'chrome' });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    console.log('\n=== Guardado manual de storageState ===');
    if (forCi) {
      console.log('MODO: Chromium empaquetado (recomendado para secret compatible con GitHub Actions).');
    } else {
      console.log('MODO: Google Chrome instalado. Para el secret de CI, use STORAGE_FOR_CI=1 (mismo motor que en Actions).');
    }
    console.log(`URL objetivo: ${targetUrl}`);
    console.log('1) Completa login Google en la ventana del navegador');
    console.log('2) Verifica que quedaste en dashboard');
    console.log('3) Regresa a esta consola y presiona ENTER para guardar\n');

    await waitForEnter('Presiona ENTER para guardar storageState... ');

    const resolved = path.resolve(process.cwd(), output);
    await context.storageState({ path: resolved });
    console.log(`\nOK: storageState guardado en ${resolved}`);
    console.log('Siguiente paso: convertir a base64 y subir a secret PLAYWRIGHT_STORAGE_B64.');
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

