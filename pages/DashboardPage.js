/**
 * Page Object del panel empresa P2L (CompanyDashboardView).
 * Selectores: roles, placeholders, testId; CSS mínimo solo donde la app no expone otra vía.
 */

const { expect } = require('@playwright/test');
const { safeClick, safeFill, waitVisible } = require('../utils/helpers');
const { attachPageConsoleBuffer, captureCIFailure, shouldRunDiagnostics } = require('../utils/ciDebug');
const { DASHBOARD_PATH, PLAN_HINT_PATTERNS } = require('../utils/testData');

const T = {
  SHORT: 5_000,
  MEDIUM: 15_000,
  LONG: 45_000,
  XL: 60_000,
  RETRY: 40_000,
};

const googleHostRe = (u) => /accounts\.google\.com|google\.com\/o\/oauth2|signin\.google/i.test(u || '');

class DashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    /** @type {string | null} */
    this._lastCompanyName = null;
  }

  /**
   * @param {{ onLogin: boolean; bodySignalMatch: boolean; signal?: string }} meta
   */
  async _captureDebugState(meta) {
    if (!shouldRunDiagnostics()) return;
    return captureCIFailure(this.page, 'dashboard-wait', meta);
  }

  _locatorRoleDashboard() {
    return this.page
      .getByRole('heading', { name: 'Crear empresa' })
      .or(this.page.getByRole('heading', { name: /Empresa · P2L/i }))
      .or(this.page.getByRole('button', { name: /Planes/i }))
      .or(this.page.getByRole('button', { name: /Cerrar sesión/i }))
      .or(this.page.getByRole('button', { name: /Ir a Unidades/i }));
  }

  async _bodyTextMatchesP2lDashboard() {
    if (await this._isGoogleLoginUIRendered()) {
      return false;
    }
    const raw = (await this.page.locator('body').innerText().catch(() => '')) || '';
    const t = raw.toLowerCase();
    if (
      /(crear\s+empresa|mi\s+empresa|empresa\s*·\s*p2l|unidades|plan actual|datos de empresa|ir\s+a\s+unidades|cerrar\s*sesi[oó]n)/i.test(
        t
      )
    ) {
      return true;
    }
    if (/(planes|dashboard)/i.test(t) && /(empresa|p2l|refactorii|tenant)/i.test(t)) {
      return true;
    }
    return false;
  }

  _pathnameTenantDashboard() {
    try {
      const p = new URL(this.page.url()).pathname;
      return /p2l-tenant/i.test(p) && /dashboard/i.test(p);
    } catch {
      return false;
    }
  }

  /**
   * Señal “URL”: ruta tenant; la SPA a veces muestra login en la misma ruta, por eso se combina con otras señales.
   */
  async _signalUrlWithShell() {
    if (await this._isGoogleLoginUIRendered()) {
      return false;
    }
    if (!this._pathnameTenantDashboard()) {
      return false;
    }
    const u = this.page.url();
    if (!/refactorii\.com/i.test(u) && !/localhost/i.test(u)) {
      return false;
    }
    const structure = await this._internalDashboardStructureVisible(T.MEDIUM);
    const body = await this._bodyTextMatchesP2lDashboard();
    return structure || body;
  }

  async _internalDashboardStructureVisible(timeout = T.MEDIUM) {
    const shell = this.page
      .locator(
        'details.company-accordion__item--company, section.company-dash__card, .company-dash__card--inside-accordion'
      )
      .first();
    if (await shell.isVisible({ timeout }).catch(() => false)) {
      return true;
    }
    return this.page
      .getByText(/datos de empresa/i)
      .first()
      .isVisible({ timeout: T.SHORT })
      .catch(() => false);
  }

  async _isGoogleLoginUIRendered() {
    const loginHeading = this.page.getByRole('heading', { name: /Inicia sesión con Google/i });
    const googleBtn = this.page.locator('#google-signin-button');
    return (
      (await loginHeading.isVisible().catch(() => false)) && (await googleBtn.isVisible().catch(() => false))
    );
  }

  /**
   * Ya hay sesión en el panel (evita clics GIS). Umbral de rol acotado a MEDIUM.
   * @returns {Promise<boolean>}
   */
  async _isSessionAlreadyInDashboard() {
    return (await this._detectDashboardSignals(T.MEDIUM)) !== 'none';
  }

  /**
   * A/B/C/D: rol → cuerpo → (URL+shell) → estructura interna.
   * @returns {Promise<'role' | 'body' | 'url' | 'internal' | 'none'>}
   */
  async _detectDashboardSignals(roleFirstTimeout = T.LONG) {
    if (await this._isGoogleLoginUIRendered()) {
      return 'none';
    }
    if (await this._locatorRoleDashboard().isVisible({ timeout: roleFirstTimeout }).catch(() => false)) {
      return 'role';
    }
    if (await this._bodyTextMatchesP2lDashboard()) {
      return 'body';
    }
    if (await this._signalUrlWithShell()) {
      return 'url';
    }
    if (await this._internalDashboardStructureVisible(T.LONG)) {
      return 'internal';
    }
    return 'none';
  }

  async _waitForDashboardShell() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle', { timeout: T.MEDIUM }).catch(() => {});
    await this.page.getByText('Cargando…').waitFor({ state: 'hidden', timeout: T.XL }).catch(() => {});
  }

  /**
   * Resuelve popup o pestaña de Google; listeners registrados *antes* del clic.
   * @param {ReadonlyArray<Promise<import('@playwright/test').Page | null | undefined>>} pagePromises
   */
  async _waitForFirstGoogleAuthPage(pagePromises, budgetMs) {
    return new Promise((resolve) => {
      let finished = false;
      let pending = pagePromises.length;
      const ms = budgetMs != null ? budgetMs : T.LONG + 11_000;
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
      for (const pr of pagePromises) {
        Promise.resolve(pr)
          .then((pg) => {
            if (finished) return;
            if (pg) {
              finished = true;
              clearTimeout(timer);
              resolve(pg);
            } else {
              doneOne();
            }
          })
          .catch(() => doneOne());
      }
    });
  }

  /**
   * @param {import('@playwright/test').Page} fromPage
   * @param {import('@playwright/test').BrowserContext} ctx
   * @returns {Promise<import('@playwright/test').Page | null>}
   */
  async _pollForGoogleAuthPage(fromPage, ctx) {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const hit = ctx.pages().find((p) => p !== fromPage && googleHostRe(p.url()));
      if (hit) {
        return hit;
      }
      await new Promise((r) => setTimeout(r, 350));
    }
    return null;
  }

  /** Abre la URL de dashboard tenant (puede redirigir a login si no hay sesión). */
  async open() {
    attachPageConsoleBuffer(this.page);
    const isAbsolute = /^https?:\/\//i.test(DASHBOARD_PATH);
    const base = process.env.P2L_BASE_URL || 'https://www.refactorii.com';
    const target = isAbsolute ? DASHBOARD_PATH : new URL(DASHBOARD_PATH, base).toString();
    await this.page.goto(target, { waitUntil: 'domcontentloaded' });
  }

  /**
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
      'Google no mostró el campo de contraseña. Revise captcha/2FA o use PLAYWRIGHT_STORAGE_B64 en CI; ver test-results/ci-debug si falla en Actions.'
    );
  }

  /**
   * Con storageState (PLAYWRIGHT_SKIP_GOOGLE_UI) o sesión ya en panel, no abre el flujo GIS.
   * Sesión reutilizable: `PLAYWRIGHT_STORAGE_STATE` en playwright.config.
   */
  async loginWithGoogle(email, password) {
    if (process.env.PLAYWRIGHT_SKIP_GOOGLE_UI === '1') {
      await this.waitDashboardLoaded();
      return;
    }

    await this._waitForDashboardShell();
    if (await this._isSessionAlreadyInDashboard()) {
      return;
    }

    const loginHeading = this.page.getByRole('heading', { name: /Inicia sesión con Google/i });
    await loginHeading.waitFor({ state: 'visible', timeout: T.LONG }).catch(() => {});
    if (!(await loginHeading.isVisible().catch(() => false))) {
      await this.waitDashboardLoaded();
      return;
    }

    const iframeSel = '#google-signin-button iframe';
    await this.page.locator(iframeSel).first().waitFor({ state: 'attached', timeout: T.LONG });

    const ctx = this.page.context();
    const popupWait = this.page.waitForEvent('popup', { timeout: T.LONG + 10_000 }).catch(() => null);
    const newPageWait = ctx
      .waitForEvent('page', { timeout: T.LONG + 10_000 })
      .then(async (p) => {
        if (!p || p === this.page) return null;
        try {
          await p.waitForURL(/accounts\.google\.com|google\.com\/o\/oauth2/i, { timeout: T.LONG });
        } catch {
          return null;
        }
        return googleHostRe(p.url()) ? p : null;
      })
      .catch(() => null);

    const frame = this.page.frameLocator(iframeSel).first();
    const innerBtn = frame.getByRole('button').or(frame.locator('div[role="button"]')).first();
    await safeClick(innerBtn, { timeout: T.LONG });

    let authPage = await this._waitForFirstGoogleAuthPage([popupWait, newPageWait], T.LONG + 11_000);
    if (!authPage) {
      authPage = await this._pollForGoogleAuthPage(this.page, ctx);
    }
    if (!authPage) {
      throw new Error(
        'No apareció autenticación de Google (popup o pestaña). En Actions use el secreto PLAYWRIGHT_STORAGE_B64 (ver README) o pruebe local: npm run test:headed.'
      );
    }

    try {
      await authPage.waitForLoadState('domcontentloaded');
      const emailInput = authPage.locator('input#identifierId, input[type="email"]').first();
      await waitVisible(emailInput, { timeout: T.LONG });
      await safeFill(emailInput, email, { timeout: T.LONG });
      await safeClick(authPage.getByRole('button', { name: /Siguiente|Next/i }).first(), { timeout: T.LONG });
      await authPage.waitForLoadState('networkidle', { timeout: T.MEDIUM }).catch(() => {});

      const accountPick = authPage
        .locator(`[data-identifier="${email}"], [data-email="${email}"]`)
        .first();
      if (await accountPick.isVisible({ timeout: T.SHORT }).catch(() => false)) {
        await accountPick.click();
        await authPage.waitForLoadState('networkidle', { timeout: T.MEDIUM }).catch(() => {});
      }

      const pwd = await this._waitGooglePasswordLocator(authPage, T.XL);
      await waitVisible(pwd, { timeout: T.XL });
      await pwd.fill('');
      await pwd.fill(password);
      await safeClick(
        authPage.getByRole('button', { name: /Siguiente|Next|Aceptar|Continue/i }).first(),
        { timeout: T.LONG }
      );
      await authPage.waitForEvent('close', { timeout: T.XL * 2 }).catch(() => {});
    } catch (e) {
      if (authPage && !authPage.isClosed()) {
        await authPage.close().catch(() => {});
      }
      throw e instanceof Error ? e : new Error(String(e));
    }

    await this.page.bringToFront();
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle', { timeout: T.MEDIUM }).catch(() => {});
    await this.waitDashboardLoaded();
  }

  async waitDashboardLoaded() {
    await this._waitForDashboardShell();

    let lastSignal = await this._detectDashboardSignals(T.LONG);
    if (lastSignal !== 'none') {
      return;
    }

    if (process.env.CI === 'true' || process.env.PLAYWRIGHT_SKIP_GOOGLE_UI === '1') {
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this._waitForDashboardShell();
      lastSignal = await this._detectDashboardSignals(T.RETRY);
      if (lastSignal !== 'none') {
        return;
      }
    }

    const url = this.page.url();
    const bodyMatch = await this._bodyTextMatchesP2lDashboard();
    const onLogin = await this._isGoogleLoginUIRendered();
    const meta = {
      onLogin,
      bodySignalMatch: bodyMatch,
      signal: String(lastSignal),
    };

    if (process.env.CI === 'true' && process.env.PLAYWRIGHT_SKIP_GOOGLE_UI === '1' && onLogin) {
      await this._captureDebugState(meta);
      throw new Error(
        'CI restauró storageState pero la app sigue en login. URL: ' +
          url +
          ' — Regenere con STORAGE_FOR_CI=1 y npm run storage:save, base64 a PLAYWRIGHT_STORAGE_B64.'
      );
    }
    if (onLogin) {
      await this._captureDebugState(meta);
      throw new Error('Sesión en login, no en panel. URL: ' + url);
    }
    await this._captureDebugState(meta);
    const bodySnippet = (await this.page.locator('body').innerText().catch(() => '')).slice(0, 800);
    throw new Error(
      'No se detectó el panel empresa a tiempo. URL: ' +
        url +
        '\nVer test-results/ci-debug y trace.\n' +
        bodySnippet
    );
  }

  /**
   * @param {{ name: string; phone: string; cityLine?: string; businessType?: string; adminEmail: string }} data
   */
  async createCompanyIfNeeded(data) {
    const heading = this.page.getByRole('heading', { name: 'Crear empresa' });
    if (!(await heading.isVisible().catch(() => false))) {
      return false;
    }
    const commercialName = data.cityLine
      ? `${data.name} — ${data.cityLine} — ${data.businessType || 'Transporte'}`
      : data.name;
    this._lastCompanyName = commercialName;
    const createCard = this.page
      .locator('section.company-dash__card')
      .filter({ has: this.page.getByRole('heading', { name: 'Crear empresa' }) });
    const act = 40_000;
    await safeFill(createCard.getByPlaceholder('Nombre comercial'), commercialName, { timeout: act });
    await safeFill(createCard.locator('input.inp').nth(1), data.phone, { timeout: act });
    await safeFill(createCard.locator('input.inp').nth(2), 'QA Admin Onboarding', { timeout: act });
    await safeFill(createCard.locator('input[type="email"]').first(), data.adminEmail, { timeout: act });
    await safeClick(createCard.getByRole('button', { name: /Crear empresa/i }), { timeout: act });
    await this.page.getByText('Creando…').waitFor({ state: 'hidden', timeout: T.XL }).catch(() => {});
    await this.waitDashboardLoaded();
    return true;
  }

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
    parts.push(await this.page.locator('body').innerText());
    return parts.join('\n---\n');
  }

  async expectFlexibleFreeOrStarterPlan() {
    const blob = await this.getCurrentPlanText();
    const ok = PLAN_HINT_PATTERNS.some((re) => re.test(blob));
    expect(ok, `Texto de plan no reconocido. Fragmento:\n${blob.slice(0, 1200)}`).toBeTruthy();
  }

  async _dismissPushNotificationModalIfPresent() {
    const overlay = this.page.locator('.push-notifications-modal-overlay').first();
    if (!(await overlay.isVisible().catch(() => false))) return;
    const root = this.page.locator('.push-notifications-modal-overlay, [class*="push-notifications"]').first();
    const candidates = [
      root.getByRole('button', { name: /Cerrar|Aceptar|Entendido|Continuar|Ahora no|Más tarde|No, gracias|OK/i }),
      root.getByRole('button').first(),
    ];
    for (const loc of candidates) {
      if (await loc.isVisible().catch(() => false)) {
        await loc.click({ timeout: T.SHORT }).catch(() => {});
        break;
      }
    }
    await this.page.keyboard.press('Escape');
    await expect(overlay).toBeHidden({ timeout: T.MEDIUM - 2_000 }).catch(() => {});
  }

  async _ensureCompanyDetailsOpen() {
    await this._dismissPushNotificationModalIfPresent();
    const details = this.page.locator('details.company-accordion__item--company').first();
    await expect(details).toBeVisible({ timeout: T.LONG });
    if ((await details.getAttribute('open')) == null) {
      await details.locator('summary').first().click({ force: true });
    }
    const nameH2 = details.locator('section.company-dash__card--inside-accordion h2').first();
    await expect(nameH2).toBeVisible({ timeout: 25_000 });
  }

  async getCompanyName() {
    await this._ensureCompanyDetailsOpen();
    const details = this.page.locator('details.company-accordion__item--company');
    const h2 = details.locator('.company-dash__card--inside-accordion h2, h2').first();
    if (this._lastCompanyName) {
      await expect(h2).toBeVisible({ timeout: 30_000 });
      await expect(h2).toContainText(this._lastCompanyName, { timeout: T.MEDIUM - 2_000 });
      return this._lastCompanyName;
    }
    await waitVisible(h2, { timeout: 30_000 });
    return (await h2.innerText()).trim();
  }

  async takeScreenshot(name) {
    const fs = require('fs');
    const safe = String(name).replace(/[^\w.-]+/g, '_');
    fs.mkdirSync('test-results', { recursive: true });
    await this.page.screenshot({ path: `test-results/${safe}.png`, fullPage: true });
  }
}

module.exports = { DashboardPage };
