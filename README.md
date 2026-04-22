# P2L QA Playwright

Repositorio **independiente** para QA automatizado del panel empresa P2L en **producción** (`https://www.refactorii.com`), sin tocar backend ni frontend del producto.

## Modos de ejecución

- **Local (tester):** recomendado para depurar login Google con navegador visible.
- **GitHub Actions (push/PR/manual):** ejecuta en CI usando secretos del repositorio.

## Qué valida

- Acceso al dashboard tenant `/p2l-tenant/dashboard`.
- Login con Google desde UI real.
- Onboarding de empresa (si aplica en primer ingreso).
- Validación flexible de plan inicial (FREE / STARTER / TRIAL / $0 COP).

## Requisitos

- Node.js 20+.
- npm.
- Cuenta Google de QA con acceso al tenant.

## Configuración local

1. Clone el repositorio.
2. Instale dependencias:

```bash
npm install
npx playwright install
```

3. Cree `.env` a partir de `.env.example`.
4. Complete:

```env
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

## Ejecución local

Con navegador visible (recomendado para login Google):

```bash
npm run test:headed
```

Modo estándar:

```bash
npm test
```

Ver reporte:

```bash
npm run report
```

### Si Google dice "This browser or app may not be secure"

Este repo en local intenta usar **Google Chrome instalado** (`channel: 'chrome'`).  
Si aun así bloquea el login, use una cuenta QA menos restringida o genere sesión guardada (sección siguiente).

## Habilitar ejecución en GitHub Actions

El workflow vive en `.github/workflows/playwright.yml` y corre en:

- `push` a `main`
- `pull_request`
- `workflow_dispatch` (manual)

### Secrets requeridos

En GitHub: **Settings > Secrets and variables > Actions > Repository secrets**

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

### Cómo funciona el login en GitHub Actions (sin subir `storageState` local)

**No hace falta** el secreto `PLAYWRIGHT_STORAGE_B64` ni subir un JSON generado en tu PC.

En CI el workflow, en un solo job:

1. **Proyecto `auth`**: abre el navegador en el propio runner, ejecuta un login real con Google (usa `DashboardPage.loginWithGoogle` con `forceFullLogin: true`) y escribe `playwright/.auth/ci-generated.json` en el disco del runner.
2. **Proyecto `chrome`**: depende de `auth`, arranca con ese `storageState` y corre los E2E (`**/*.spec.js`).

Así se evita el desfase entorno / IP / motor entre un archivo generado en local y el CI.

> Google puede mostrar captcha, 2FA o bloquear cuentas raras. Si el paso de `auth` falla, mire el trace/artifacts del workflow y reconsidere una cuenta de QA o políticas de la cuenta.

## Opcional: login manual y `storageState` en local (depuración o bypass)

`codegen` a veces no deja acceder a Google. Puede usar el **script manual** (login a mano) y, si hace falta, apuntar `PLAYWRIGHT_STORAGE_STATE` en `.env` o usar `PLAYWRIGHT_SKIP_GOOGLE_UI=1` para no repetir el flujo GIS.

**Importante (solo si guarda usted el JSON en local):** se recomienda `npx playwright install chrome` y `channel: 'chrome'` coherente con el README de Playwright, para aproximarse a lo que usa el `playwright.config`.

```powershell
# PowerShell (Windows), perfil separado
$env:STORAGE_FOR_CI="1"
npm run storage:save
```

### 1) Generar `storageState.json` (manual)

Desde la raíz del repositorio:

```bash
npm run storage:save
```

(Equivale a `node scripts/saveStorageManual.js`.)

- Por defecto se abre **Google Chrome** (`channel: 'chrome'`).
- Con `STORAGE_FOR_CI=1` se usa un perfil distinto (`.tmp-profile-ci`) pero el mismo canal Chrome que en Actions.
- Con `PLAYWRIGHT_USE_CHROMIUM=1` se abre **Chromium** empaquetado (sin Chrome instalado; puede diferir del motor de CI).
- Navega a `https://www.refactorii.com/p2l-tenant/dashboard` (o la URL de `P2L_DASHBOARD_URL` si la defines).
- Inicia sesión con Google de forma **manual** hasta ver el panel.
- Vuelve a la consola y **pulsa Enter** para guardar.

**Opcional (otra ruta de salida):**

```bash
# Windows PowerShell
$env:STORAGE_STATE_OUTPUT="playwright/.auth/p2l-admin.json"
npm run storage:save
```

### 2) Notas sobre almacenamiento local

- **No** suba `storageState.json` al repositorio (es estado de sesión).
- Sigue pudiendo ocurrir el aviso de Google *“navegador o aplicación no segura”*; en ese caso use `test:headed` o el script manual.

## Estructura

- `tests/` - specs E2E (`**/*.spec.js`); en CI, `auth.setup.js` (proyecto `auth`, login + JSON en el runner).
- `pages/` - Page Object Model (`DashboardPage`).
- `utils/` - helpers y datos de prueba.
- `playwright/.auth/` - se genera `ci-generated.json` en el job (ignorado por git; ver `.gitignore`).
- `.github/workflows/playwright.yml` - pipeline CI.

## Notas sobre la UI real

El formulario de creación de empresa incluye:

- nombre comercial
- teléfono
- responsable
- correo responsable

No incluye ciudad/tipo como campos separados; el test conserva trazabilidad incorporándolos en el nombre comercial.
