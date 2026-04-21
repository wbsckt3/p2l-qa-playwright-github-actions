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
- `PLAYWRIGHT_STORAGE_B64` (opcional pero recomendado)

> Sin `PLAYWRIGHT_STORAGE_B64`, el spec principal se omite en CI por la limitación del login Google automatizado.

## De dónde sacar `PLAYWRIGHT_STORAGE_B64` (en local)

1. En tu máquina local (ya loguea bien), guarda el estado de sesión:

```bash
npx playwright codegen https://www.refactorii.com/p2l-tenant/dashboard --save-storage=storageState.json
```

2. Completa login Google en la ventana que abre Playwright y cierra.
3. Convierte el JSON a base64:

**PowerShell**

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("storageState.json"))
```

**Git Bash / Linux**

```bash
cat storageState.json | base64
```

4. Copia ese valor y pégalo en el secret `PLAYWRIGHT_STORAGE_B64`.

## Estructura

- `tests/` - specs E2E.
- `pages/` - Page Object Model (`DashboardPage`).
- `utils/` - helpers y datos de prueba.
- `.github/workflows/playwright.yml` - pipeline CI.

## Notas sobre la UI real

El formulario de creación de empresa incluye:

- nombre comercial
- teléfono
- responsable
- correo responsable

No incluye ciudad/tipo como campos separados; el test conserva trazabilidad incorporándolos en el nombre comercial.
