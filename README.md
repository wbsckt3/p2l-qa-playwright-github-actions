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
| `ADMIN_PASSWORD` | Contraseña (flujo popup; ver nota Google más abajo) |

Opcionalmente puede añadir pasos al workflow para inyectar `PLAYWRIGHT_STORAGE_STATE` (sesión guardada) y `PLAYWRIGHT_SKIP_GOOGLE_UI=1` si Google bloquea el login automatizado en CI.

## Login de Google en CI

Google a menudo **dificulta** el login automatizado (captcha, dispositivo no reconocido, 2FA). Este repo contempla:

1. **UI completa** (por defecto): iframe oficial → popup `accounts.google.com` → email y contraseña desde secretos.
2. **`storageState`**: sesión generada fuera de este repo bloqueado (por ejemplo en una máquina personal o pipeline distinto), guardada de forma segura e inyectada en Actions; ver comentarios en `.env.example`.

## Variables de entorno (referencia)

| Variable | Uso |
|----------|-----|
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Secretos en GitHub Actions |
| `PLAYWRIGHT_STORAGE_STATE` | Ruta al JSON de sesión (si se implementa en el workflow) |
| `PLAYWRIGHT_SKIP_GOOGLE_UI` | `1` para omitir el clic en Google si hay sesión restaurada |
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
