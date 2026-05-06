/**
 * Sesión conductor mock + QA lab (geo, permisos, baseURL coherente con `playwright.config.js`).
 */

const PROD_ORIGIN = 'https://www.refactorii.com';
const LAB_GEO = { latitude: 6.247638, longitude: -75.56583 };
const LAB_BASE = process.env.PLAYWRIGHT_FORCE_BASE_URL || 'https://www.refactorii.com';

/**
 * @param {import('@playwright/test').Browser} browser
 * @returns {Promise<{ context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page }>}
 */
async function createDriverLabPage(browser) {
  const context = await browser.newContext({
    baseURL: LAB_BASE,
    geolocation: LAB_GEO,
    permissions: ['geolocation', 'notifications'],
  });
  await context.grantPermissions(['geolocation', 'notifications'], { origin: PROD_ORIGIN });
  const page = await context.newPage();
  return { context, page };
}

module.exports = {
  PROD_ORIGIN,
  LAB_GEO,
  LAB_BASE,
  createDriverLabPage,
};
