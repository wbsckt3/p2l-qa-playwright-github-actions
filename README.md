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

## De dónde sacar `PLAYWRIGHT_STORAGE_B64` (método manual recomendado)

`codegen` a veces no deja acceder a Google o no muestra el botón bien. En este repo el flujo que suele funcionar es un **script local**: haces **login a mano** y al terminar se guarda `storageState.json`.

**Importante para GitHub Actions:** en CI se usa el **Chromium empaquetado** de Playwright (Linux). Si genera el `storageState` solo con **Google Chrome** en Windows, el secret a veces **no** rehidrata sesión en el runner. Para alinear el motor con CI, genere el archivo con:

```powershell
# PowerShell (Windows)
$env:STORAGE_FOR_CI="1"
npm run storage:save
```

(Requiere `npx playwright install chromium` al menos una vez en esa máquina.)

### 1) Generar `storageState.json`

Desde la raíz del repositorio:

```bash
npm run storage:save
```

(Equivale a `node scripts/saveStorageManual.js`.)

- Por defecto se abre **Chrome** instalado.
- Con `STORAGE_FOR_CI=1` se abre el **Chromium** de Playwright (recomendado para el secret que consumen las Actions).
- Navega a `https://www.refactorii.com/p2l-tenant/dashboard` (o la URL de `P2L_DASHBOARD_URL` si la defines).
- Inicia sesión con Google de forma **manual** hasta ver el panel.
- Vuelve a la consola y **pulsa Enter** para guardar.

**Opcional (otra ruta de salida):**

```bash
# Windows PowerShell
$env:STORAGE_STATE_OUTPUT="playwright/.auth/p2l-admin.json"
npm run storage:save
```

### 2) Convertir a base64 para GitHub

Usa **PowerShell** (ruta absoluta al archivo):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\al\proyecto\storageState.json"))
```

Para dejarlo en un archivo (una sola línea, fácil de copiar al secret):

```powershell
$p = "C:\ruta\al\proyecto\storageState.json"
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($p))
Set-Content -NoNewline -Path "C:\ruta\al\proyecto\PLAYWRIGHT_STORAGE_B64.txt" -Value $b64
```

En **Git Bash / Linux** (repositorio clonado):

```bash
cat storageState.json | base64 -w0
```

### 3) Secret en GitHub

En **Settings > Secrets and variables > Actions** crea o actualiza:

- `PLAYWRIGHT_STORAGE_B64` = contenido de la salida base64 (una sola cadena, sin saltos de línea).

### Notas

- **No** subas `storageState.json` al repositorio (es credencial/estado de sesión).
- Cuando la sesión caduque, repite el proceso.
- Sigue pudiendo ocurrir el aviso de Google *“navegador o aplicación no segura”*; si pasa, cierra, abre de nuevo, o prueba en la misma máquina donde ya iniciaste sesión en Chrome normal; el script ya incluye `ignoreDefaultArgs` y `AutomationControlled` atenuado.

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
