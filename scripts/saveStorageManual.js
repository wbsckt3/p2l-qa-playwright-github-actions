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
  const userDataDir = path.join(process.cwd(), 'playwright', '.tmp-profile');

  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    viewport: null,
    // Reducir señales de automatización para evitar bloqueo de Google.
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    console.log('\n=== Guardado manual de storageState ===');
    console.log(`URL objetivo: ${targetUrl}`);
    console.log('1) Completa login Google en la ventana de Chrome');
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

