/**
 * Page Object del panel empresa P2L (CompanyDashboardView).
 * Selectores alineados con la UI real: títulos accesibles, placeholders y roles.
 */

const { expect } = require('@playwright/test');
const { safeClick, safeFill, waitVisible } = require('../utils/helpers');
const { DASHBOARD_PATH, PLAN_HINT_PATTERNS } = require('../utils/testData');

class DashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    /** @type {string | null} Último nombre comercial usado al crear empresa */
    this._lastCompanyName = null;
  }

  /** Abre la URL de dashboard tenant (puede redirigir a login si no hay sesión). */
  async open() {
    const isAbsolute = /^https?:\/\//i.test(DASHBOARD_PATH);
    const base = process.env.P2L_BASE_URL || 'https://www.refactorii.com';
    const target = isAbsolute ? DASHBOARD_PATH : new URL(DASHBOARD_PATH, base).toString();
    await this.page.goto(target, { waitUntil: 'domcontentloaded' });
  }

  /**
   * Localiza el input de contraseña en la página de Google (incluye iframes).
   * @param {import('@playwright/test').Page} authPage
   * @param {number} timeoutMs
   * @returns {Promise<import('@playwright/test').Locator>}
   */
  async _waitGooglePasswordLocator(authPage, timeoutMs) {
    const sel =
      'input[type="password"], input[name="Passwd"], input[name="password"], ' +
      'input[autocomplete="current-password"], input#password';
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const frames = authPage.frames();
      for (const frame of frames) {
        const loc = frame.locator(sel).first();
        if (await loc.isVisible().catch(() => false)) return loc;
      }
      await new Promise((r) => setTimeout(r, 450));
    }
    throw new Error(
      'Google no mostró el campo de contraseña a tiempo. Revise captcha/2FA o use PLAYWRIGHT_STORAGE_B64 en CI.'
    );
  }

  /**
   * Login con Google (Google Identity Services: iframe + popup típico de accounts.google.com).
   * Si PLAYWRIGHT_SKIP_GOOGLE_UI=1 y ya hay storageState en config, solo espera salir del login.
   *
   * @param {string} email
   * @param {string} password
   */
  async loginWithGoogle(email, password) {
    const skipUi = process.env.PLAYWRIGHT_SKIP_GOOGLE_UI === '1';
    if (skipUi) {
      await this.waitDashboardLoaded();
      return;
    }

    const loginHeading = this.page.getByRole('heading', { name: /Inicia sesión con Google/i });
    await loginHeading.waitFor({ state: 'visible', timeout: 45_000 }).catch(() => {
      // Ya autenticado o otra vista
    });

    if (!(await loginHeading.isVisible().catch(() => false))) {
      await this.waitDashboardLoaded();
      return;
    }

    const iframeSel = '#google-signin-button iframe';
    await this.page.locator(iframeSel).first().waitFor({ state: 'attached', timeout: 45_000 });

    const ctx = this.page.context();
    const googleAuthUrl = (u) =>
      /accounts\.google\.com|google\.com\/o\/oauth2|signin\.google/i.test(u || '');

    // En CI a veces no hay "popup": GIS abre una Page nueva en el mismo contexto.
    // Registrar ambas esperas *antes* del clic (patrón recomendado por Playwright).
    const popupWait = this.page.waitForEvent('popup', { timeout: 55_000 }).catch(() => null);
    const newPageWait = ctx
      .waitForEvent('page', { timeout: 55_000 })
      .then(async (p) => {
        if (!p || p === this.page) return null;
        try {
          await p.waitForURL(/accounts\.google\.com|google\.com\/o\/oauth2/i, { timeout: 45_000 });
        } catch {
          return null;
        }
        return googleAuthUrl(p.url()) ? p : null;
      })
      .catch(() => null);

    const frame = this.page.frameLocator(iframeSel).first();
    const innerBtn = frame.locator('div[role="button"], button').first();
    await safeClick(innerBtn);

    // No usar Promise.race simple: si una rama resuelve null antes, la otra (popup real) seguiría pendiente.
    const firstNonNullPage = (promises, ms = 56_000) =>
      new Promise((resolve) => {
        let finished = false;
        let pending = promises.length;
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true;
            resolve(null);
          }
        }, ms);
        const doneOne = () => {
          if (finished) return;
          pending -= 1;
          if (pending <= 0) {
            finished = true;
            clearTimeout(timer);
            resolve(null);
          }
        };
        for (const pr of promises) {
          Promise.resolve(pr)
            .then((pg) => {
              if (finished) return;
              if (pg) {
                finished = true;
                clearTimeout(timer);
                resolve(pg);
                return;
              }
              doneOne();
            })
            .catch(() => doneOne());
        }
      });

    let authPage = await firstNonNullPage([popupWait, newPageWait]);

    if (!authPage) {
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        const hit = ctx
          .pages()
          .find((p) => p !== this.page && googleAuthUrl(p.url()));
        if (hit) {
          authPage = hit;
          break;
        }
        await new Promise((r) => setTimeout(r, 350));
      }
    }

    if (!authPage) {
      throw new Error(
        'No apareció ventana de autenticación de Google (popup o pestaña). En GitHub Actions esto es habitual: ' +
          'añada el secreto PLAYWRIGHT_STORAGE_B64 (JSON de storageState en base64) y el workflow restaurará la sesión; ' +
          'o ejecute en local con npm run test:headed.'
      );
    }

    await authPage.waitForLoadState('domcontentloaded');

    const emailInput = authPage.locator('input#identifierId, input[type="email"]').first();
    await waitVisible(emailInput, { timeout: 45_000 });
    await safeFill(emailInput, email);

    const nextAfterEmail = authPage.getByRole('button', { name: /Siguiente|Next/i }).first();
    await safeClick(nextAfterEmail);

    await authPage.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});

    // Selector de cuenta si Google muestra el grid en lugar de ir directo a contraseña.
    const accountPick = authPage
      .locator(`[data-identifier="${email}"], [data-email="${email}"]`)
      .first();
    if (await accountPick.isVisible({ timeout: 5000 }).catch(() => false)) {
      await accountPick.click();
      await authPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    }

    // La contraseña a veces está en un iframe (anti-phishing) o con distintos name/autocomplete.
    const pwd = await this._waitGooglePasswordLocator(authPage, 65_000);
    await waitVisible(pwd, { timeout: 65_000 });
    await pwd.fill('');
    await pwd.fill(password);

    const nextAfterPwd = authPage
      .getByRole('button', { name: /Siguiente|Next|Aceptar|Continue/i })
      .first();
    await safeClick(nextAfterPwd);

    // Posibles pasos extra (2FA, confirmación): el tester debe usar cuenta sin bloqueos o storageState.
    await authPage.waitForEvent('close', { timeout: 120_000 }).catch(() => {});

    await this.page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => {});
    await this.waitDashboardLoaded();
  }

  /** Espera a que desaparezca "Cargando…" y aparezca onboarding o dashboard con empresa. */
  async waitDashboardLoaded() {
    const loading = this.page.getByText('Cargando…');
    await loading.waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle', { timeout: 45_000 }).catch(() => {});

    const createCompany = this.page.getByRole('heading', { name: 'Crear empresa' });
    const empresaHeader = this.page.getByRole('heading', { name: /Empresa · P2L/i });
    const planes = this.page.getByRole('button', { name: /Planes/i });
    const loginHeading = this.page.getByRole('heading', { name: /Inicia sesión con Google/i });
    const googleBtnContainer = this.page.locator('#google-signin-button');

    // Importante: NO usar "login" como criterio de fin del poll. Antes, el primer frame con login
    // (redirect SPA aún resolviendo) hacía .not.toBe('unknown') y cortaba el wait antes de tiempo.
    const dashboardReady = createCompany
      .or(empresaHeader)
      .or(planes);
    try {
      await expect(dashboardReady).toBeVisible({ timeout: 75_000 });
    } catch (e) {
      const onLogin =
        (await loginHeading.isVisible().catch(() => false)) &&
        (await googleBtnContainer.isVisible().catch(() => false));
      if (process.env.CI === 'true' && process.env.PLAYWRIGHT_SKIP_GOOGLE_UI === '1' && onLogin) {
        throw new Error(
          'CI restauró storageState pero la app sigue en login. El estado guardado expiró o no corresponde al tenant. ' +
            'Regenera storageState.json en local, conviértelo a base64 y actualiza el secret PLAYWRIGHT_STORAGE_B64.'
        );
      }
      if (onLogin) {
        throw new Error('La sesión no está en dashboard (sigue en login). Pruebe regenerar storage o login manual con test:headed.');
      }
      throw e;
    }
  }

  /**
   * Si aparece el formulario de primera empresa, lo completa y guarda.
   * Nota: el formulario real no incluye ciudad ni tipo; se reflejan en el nombre comercial para trazabilidad QA.
   *
   * @param {{ name: string; phone: string; cityLine?: string; businessType?: string; adminEmail: string }} data
   */
  async createCompanyIfNeeded(data) {
    const heading = this.page.getByRole('heading', { name: 'Crear empresa' });
    const visible = await heading.isVisible().catch(() => false);
    if (!visible) {
      return false;
    }

    const commercialName = data.cityLine
      ? `${data.name} — ${data.cityLine} — ${data.businessType || 'Transporte'}`
      : data.name;

    this._lastCompanyName = commercialName;

    const createCard = this.page
      .locator('section.company-dash__card')
      .filter({ has: this.page.getByRole('heading', { name: 'Crear empresa' }) });

    await safeFill(createCard.getByPlaceholder('Nombre comercial'), commercialName);
    await safeFill(createCard.locator('input.inp').nth(1), data.phone);
    await safeFill(createCard.locator('input.inp').nth(2), 'QA Admin Onboarding');
    await safeFill(createCard.locator('input[type="email"]').first(), data.adminEmail);

    await safeClick(createCard.getByRole('button', { name: /Crear empresa/i }));
    await this.page.getByText('Creando…').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});

    await this.waitDashboardLoaded();
    return true;
  }

  /**
   * Devuelve fragmentos de texto relacionados al plan (tarjeta "Plan actual" o metadatos).
   */
  async getCurrentPlanText() {
    const parts = [];

    const trialTitle = this.page.locator('.trial-current-card__title');
    if (await trialTitle.isVisible().catch(() => false)) {
      parts.push((await trialTitle.innerText()).trim());
    }

    const trialBanner = this.page.locator('.banner--trial');
    if (await trialBanner.isVisible().catch(() => false)) {
      parts.push((await trialBanner.innerText()).trim());
    }

    const starterTier = this.page.getByText(/PLAN STARTER/i).first();
    if (await starterTier.isVisible().catch(() => false)) {
      parts.push((await starterTier.innerText()).trim());
    }

    const planMeta = this.page.getByText(/Plan actual:/i).first();
    if (await planMeta.isVisible().catch(() => false)) {
      parts.push((await planMeta.innerText()).trim());
    }

    const body = await this.page.locator('body').innerText();
    parts.push(body);

    return parts.join('\n---\n');
  }

  /** Confirma que el texto del plan contiene alguno de los indicadores flexibles. */
  async expectFlexibleFreeOrStarterPlan() {
    const blob = await this.getCurrentPlanText();
    const ok = PLAN_HINT_PATTERNS.some((re) => re.test(blob));
    expect(ok, `Texto de plan no reconocido. Fragmento:\n${blob.slice(0, 1200)}`).toBeTruthy();
  }

  /**
   * Algunas vistas muestran un modal de notificaciones push; el overlay intercepta clics
   * (p. ej. .push-notifications-modal-overlay) hasta cerrarse.
   */
  async _dismissPushNotificationModalIfPresent() {
    const overlay = this.page.locator('.push-notifications-modal-overlay').first();
    const visible = await overlay.isVisible().catch(() => false);
    if (!visible) return;

    const root = this.page.locator('.push-notifications-modal-overlay, [class*="push-notifications"]').first();
    const candidates = [
      root.getByRole('button', { name: /Cerrar|Aceptar|Entendido|Continuar|Ahora no|Más tarde|No, gracias|OK/i }),
      root.locator('button, [role="button"], .btn, a[href^="#"]').first(),
    ];
    for (const loc of candidates) {
      if (await loc.isVisible().catch(() => false)) {
        await loc.click({ timeout: 5000 }).catch(() => {});
        break;
      }
    }
    await this.page.keyboard.press('Escape');
    await expect(overlay).toBeHidden({ timeout: 8000 }).catch(() => {});
  }

  /**
   * Abre el acordeón "Datos de empresa" si hace falta (el h2 del nombre queda hidden si <details> está cerrado).
   * En CompanyDashboardView el bloque usa la clase `company-accordion__item--company`.
   */
  async _ensureCompanyDetailsOpen() {
    await this._dismissPushNotificationModalIfPresent();

    const details = this.page.locator('details.company-accordion__item--company').first();
    await expect(details).toBeVisible({ timeout: 45_000 });

    if ((await details.getAttribute('open')) == null) {
      // force: el overlay a veces sigue arriba un instante; evita "intercepts pointer events"
      await details.locator('summary').first().click({ force: true });
    }

    const nameH2 = details.locator('section.company-dash__card--inside-accordion h2').first();
    // El título h2 queda "hidden" en DOM si <details> sigue colapsado; al abrir, debe mostrarse.
    await expect(nameH2).toBeVisible({ timeout: 25_000 });
  }

  /**
   * Obtiene el nombre comercial mostrado (acordeón "Datos de empresa" o variable interna).
   */
  async getCompanyName() {
    await this._ensureCompanyDetailsOpen();

    // El nombre vive en el h2 del acordeón "Datos de empresa" (no en el h2 del formulario "Crear empresa").
    const details = this.page.locator('details.company-accordion__item--company');
    const h2 = details.locator('.company-dash__card--inside-accordion h2, h2').first();

    if (this._lastCompanyName) {
      await expect(h2).toBeVisible({ timeout: 30_000 });
      await expect(h2).toContainText(this._lastCompanyName, { timeout: 10_000 });
      return this._lastCompanyName;
    }

    await waitVisible(h2, { timeout: 30_000 });
    return (await h2.innerText()).trim();
  }

  /**
   * Captura de pantalla con nombre descriptivo bajo test-results/.
   * @param {string} name
   */
  async takeScreenshot(name) {
    const fs = require('fs');
    const safe = String(name).replace(/[^\w.-]+/g, '_');
    fs.mkdirSync('test-results', { recursive: true });
    await this.page.screenshot({ path: `test-results/${safe}.png`, fullPage: true });
  }
}

module.exports = { DashboardPage };
