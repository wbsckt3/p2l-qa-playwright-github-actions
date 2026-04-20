# P2L QA Playwright

Repositorio **independiente** para pruebas end-to-end del panel empresa P2L en **producción** (`https://www.refactorii.com`), sin acceso al código del producto. El enfoque es el de un QA externo: solo UI pública y Chromium automatizado.

## Dónde se ejecuta Playwright (importante)

**El entorno previsto de ejecución es GitHub Actions.** En equipos donde no se puede instalar ni ejecutar Node/npm (política corporativa), el flujo del tester es:

1. Clonar este repositorio (o trabajar en un fork).
2. Crear o editar pruebas en `tests/`, `pages/`, `utils/` con el editor que tenga permitido.
3. Hacer **commit** y **push** a GitHub (por ejemplo rama `main` o una rama de PR).

En el push, el workflow instala Node 20, las dependencias del `package.json`, los binarios de Playwright y **lanza las pruebas en Ubuntu en la nube**. No hace falta instalar Playwright ni npm en la máquina del tester.

Resultados: pestaña **Actions** del repositorio y artefactos (informe HTML y `test-results/`).

## Qué valida

- Acceso al dashboard tenant `/p2l-tenant/dashboard`.
- Inicio de sesión con **Google** (widget GIS en la pantalla de login).
- **Onboarding**: formulario “Crear empresa” en primer ingreso (nombre comercial, teléfono, responsable, correo).
- **Plan inicial** de forma flexible: textos como trial, Starter, FREE, $0 COP, etc.

## Configuración en GitHub (obligatoria para que corran los tests)

En el repositorio remoto: **Settings → Secrets and variables → Actions →  Repository secrets**, cree al menos:

| Secreto | Descripción |
|---------|-------------|
| `ADMIN_EMAIL` | Cuenta Google de QA |
| `ADMIN_PASSWORD` | Contraseña (solo si se usa login por UI; en CI suele fallar) |
| `PLAYWRIGHT_STORAGE_B64` | **Recomendado en CI:** JSON de `storageState` en **una sola línea base64** (ver abajo). Si existe, el workflow omite el clic en Google. |

## Login de Google en CI (por qué falla el popup)

En **GitHub Actions** el widget de Google muchas veces **no abre** popup/pestaña detectable, o **bloquea** navegadores automatizados. Por eso el error *“No apareció ventana de autenticación…”* es esperable solo con email/contraseña en secretos.

**Solución estable:** guardar una sesión ya autenticada y subirla como secreto.

### Generar `PLAYWRIGHT_STORAGE_B64` (en un PC donde sí pueda ejecutar Playwright)

1. Tras `npm install` y `npx playwright install`, inicie sesión manualmente y guarde el estado, por ejemplo:

   ```bash
   npx playwright codegen https://www.refactorii.com/p2l-tenant/dashboard --save-storage=playwright/.auth/p2l-admin.json
   ```

   Complete el login con Google en el navegador que abra Playwright y cierre guardando el archivo.

2. Codifique el JSON en base64 **en una línea** (Linux / Git Bash en el repo):

   ```bash
   base64 -w0 playwright/.auth/p2l-admin.json
   ```

   En **PowerShell**:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("playwright\.auth\p2l-admin.json"))
   ```

3. En GitHub: **Settings → Secrets and variables → Actions → New repository secret**  
   Nombre: `PLAYWRIGHT_STORAGE_B64`  
   Valor: pegue la cadena base64 completa.

4. Haga **push** de nuevo; el workflow decodifica el archivo, define `PLAYWRIGHT_STORAGE_STATE` y `PLAYWRIGHT_SKIP_GOOGLE_UI=1`, y las pruebas arrancan ya logueadas.

Renueve el secreto cuando caduque la sesión (p. ej. token Google ~1 h de validez en app; según uso puede durar más en storage según cookies).

### Sin `PLAYWRIGHT_STORAGE_B64`

Se intentará login por UI con `ADMIN_EMAIL` / `ADMIN_PASSWORD`; puede funcionar en local con `npm run test:headed`, pero **no confíe** en ello en Actions.

## Variables de entorno (referencia)

| Variable | Uso |
|----------|-----|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Secretos en GitHub Actions |
| `PLAYWRIGHT_STORAGE_B64` | Secreto del repo; el workflow escribe `playwright/.auth/ci-state.json` |
| `PLAYWRIGHT_STORAGE_STATE` | Local o CI vía GITHUB_ENV: ruta al JSON de sesión |
| `PLAYWRIGHT_SKIP_GOOGLE_UI` | `1` omite el clic en Google (lo pone el workflow si hay storage) |
| `CI` | Lo define GitHub Actions (`headless: true` en `playwright.config.js`) |

## Ejecución local (solo si su entorno lo permite)

No es parte del flujo corporativo que describió el equipo. Si algún desarrollador o QA **sí** tiene Node instalado y quiere depurar con ventana visible:

```bash
npm install
npx playwright install
cp .env.example .env
# completar ADMIN_EMAIL y ADMIN_PASSWORD
npm run test:headed
```

## Estructura

- `tests/` — especificaciones.
- `pages/` — Page Object Model.
- `utils/` — helpers y datos compartidos.
- `.github/workflows/playwright.yml` — pipeline que instala y ejecuta todo en la nube.

## Notas de alineación con la UI real

El formulario “Crear empresa” incluye **nombre**, **teléfono**, **responsable** y **correo responsable**. El test concatena ciudad y tipo de negocio en el **nombre comercial** para trazabilidad QA.

## Licencia y uso

Uso interno de QA. No modifica backend ni frontend de P2L; solo consume la aplicación desplegada como un usuario real.
