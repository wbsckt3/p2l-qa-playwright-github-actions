# P2L QA Playwright

Repositorio **independiente** para QA automatizado del panel empresa P2L en **producción** (`https://www.refactorii.com`), sin tocar backend ni frontend del producto.

## Modo de ejecución (actual)

Este proyecto está configurado para ejecutarse **localmente en la máquina del tester**.

- No hay workflow activo de GitHub Actions para correr pruebas.
- El tester clona el repo, instala dependencias y ejecuta Playwright con navegador visible.

## Qué valida

- Acceso al dashboard tenant `/p2l-tenant/dashboard`.
- Login con Google desde UI real.
- Onboarding de empresa (si aplica en primer ingreso).
- Validación flexible de plan inicial (FREE / STARTER / TRIAL / $0 COP).

## Requisitos

- Node.js 20+.
- npm.
- Cuenta Google de QA (con acceso al tenant).

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

## Ejecución de pruebas

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

## Estructura

- `tests/` — specs E2E.
- `pages/` — Page Object Model (`DashboardPage`).
- `utils/` — helpers y datos de prueba.

## Notas sobre la UI real

En producción, el formulario de creación de empresa contiene:

- nombre comercial
- teléfono
- responsable
- correo responsable

No incluye campos separados de ciudad/tipo; el test conserva trazabilidad incorporándolos en el nombre comercial.

## Uso esperado

Flujo para empresa QA externa:

1. Clonar repo.
2. Configurar `.env`.
3. Ejecutar Playwright local.
4. Ajustar/crear nuevos specs.
5. Hacer commit/push para versionar, sin depender de ejecución en GitHub Actions.
