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

### Clon nuevo o compañero sin tu `storageState`

El repo **no** incluye sesión de Google: en GitHub Actions el job mete la suya vía el secreto `PLAYWRIGHT_STORAGE_B64`; en **local** cada máquina debe tener su propio JSON o probar login asistido.

Si al correr `npm test` aparece **«Sesión en login, no en panel»** (sigue en la URL con `?redirect=/dashboard` y el aviso de Google), lo más estable es **no** depender del login automatizado en ese entorno:

1. `npm run storage:save` (script `scripts/saveStorageManual.js`).
2. En el navegador que abre, inicie sesión **a mano** con Google hasta ver el dashboard.
3. En la consola, Enter para guardar (p. ej. `storageState.json` en la raíz del repo).
4. En `.env` añada la ruta al JSON y omita la UI de Google en los tests:

```env
PLAYWRIGHT_STORAGE_STATE=storageState.json
PLAYWRIGHT_SKIP_GOOGLE_UI=1
```

5. Vuelva a ejecutar `npm test` o `npm run test:headed`.  
**No hace falta** el mismo base64 del CI en local; esas credenciales/JSON son por usuario y se mantienen fuera de git (ver `.gitignore`).

## Modo solo dashboard (sin ejercitar el login de Google)

**Solo aplica en este repo de Playwright (QA), no hace falta cambiar el proyecto P2L.**

Con `PLAYWRIGHT_DASHBOARD_ONLY=1` el spec **no** llama a `loginWithGoogle`: hace `open()` y `waitDashboardLoaded()` usando la sesión ya cargada (`PLAYWRIGHT_STORAGE_STATE` en local, o `PLAYWRIGHT_STORAGE_B64` + workflow en GitHub). Sigue haciendo falta `ADMIN_EMAIL` para el formulario de empresa; `ADMIN_PASSWORD` no se usa en este modo.

```bash
# .env de ejemplo
PLAYWRIGHT_DASHBOARD_ONLY=1
PLAYWRIGHT_STORAGE_STATE=playwright/.auth/p2l-admin.json
ADMIN_EMAIL=tu@cuenta.qa
```

En **GitHub Actions** puede añadir `PLAYWRIGHT_DASHBOARD_ONLY: '1'` al paso de `npx playwright test` si quiere el mismo comportamiento (sigue siendo obligatorio el secreto con la sesión en base64 para que el navegador en CI tenga cookies).

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
- `PLAYWRIGHT_STORAGE_B64` (recomendado para el E2E de dashboard; ver abajo)

### Google en GitHub Actions (sin login en el workflow)

**El workflow de CI no intenta iniciar sesión con Google** (evita captcha, 2FA y bloqueos habituales en runners).

1. Usted (o otra pipeline) genera un `storageState.json` con sesión ya válida (p. ej. `npm run storage:save` con login manual en una máquina con Chrome coherente con el runner).
2. Convierte el JSON a **una sola cadena base64** y la guarda en el secreto `PLAYWRIGHT_STORAGE_B64`.
3. Al ejecutarse el job, se decodifica a `playwright/.auth/ci-state.json`, se fija `PLAYWRIGHT_STORAGE_STATE` y `PLAYWRIGHT_SKIP_GOOGLE_UI=1`, y los tests reutilizan la sesión **sin** abrir el flujo Google en GitHub.

Sin `PLAYWRIGHT_STORAGE_B64`, el spec de dashboard de empresa se **omite** en CI; otros specs pueden seguir corriendo.

**Si en CI vuelve a la pantalla de Google** aun con B64, el `storageState` no se está rehidratando (cookies o dominio distintos, sesión vencida, o JSON generado en otro motor). Vuelva a generar el JSON estando **ya en el panel** (URL con `/p2l-tenant/dashboard`); en lo posible con **Google Chrome** y `npx playwright install chrome` alineado al job; convierta a base64 y actualice el secreto.

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

### 2) Base64 para el secreto `PLAYWRIGHT_STORAGE_B64` (CI)

**PowerShell** (ruta al JSON generado, una sola línea):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\storageState.json"))
```

**Git Bash / Linux:**

```bash
cat storageState.json | base64 -w0
```

Pegar el resultado en el secreto `PLAYWRIGHT_STORAGE_B64` (sin saltos de línea).

### 3) Notas sobre almacenamiento local

- **No** suba `storageState.json` al repositorio (es estado de sesión).
- Sigue pudiendo ocurrir el aviso de Google *“navegador o aplicación no segura”*; en ese caso use `test:headed` o el script manual.

## Artifacts en GitHub Actions

Tras un run, baje el artifact **playwright-e2e-outputs**. Dentro del ZIP verá `playwright-report/index.html` (reporte interactivo de Playwright) y `test-results/` (PNG, trazas, vídeo). **Abra `index.html` en el navegador** o en local: `npx playwright show-report playwright-report` desde la carpeta descomprimida. En el workflow los archivos se copian a `ci-upload` porque `playwright-report/` está en `.gitignore` y el subidor de GitHub a veces no empaqueta esas carpetas.

## Estructura

- `tests/` - specs E2E.
- `pages/` - Page Object Model (`DashboardPage`).
- `utils/` - helpers y datos de prueba.
- `playwright/.auth/` - el workflow puede escribir `ci-state.json` desde B64 (ignorado por git; ver `.gitignore`).
- `.github/workflows/playwright.yml` - pipeline CI.

## Notas sobre la UI real

El formulario de creación de empresa incluye:

- nombre comercial
- teléfono
- responsable
- correo responsable

No incluye ciudad/tipo como campos separados; el test conserva trazabilidad incorporándolos en el nombre comercial.
