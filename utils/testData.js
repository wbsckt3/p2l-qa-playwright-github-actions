/**
 * Rutas y datos compartidos entre specs (producción).
 */

const DASHBOARD_PATH = '/p2l-tenant/dashboard';

/**
 * Rutas SPA del QA Lab sin login Google (una o varias candidatas para el helper del spec).
 * Router producto (`src/router/index.js`): `/p2l-tenant/simulacion-lab` → `/simulacion-lab`;
 * también existe `/p2l-tenant/simulation-lab`.
 *
 * Override opcional:
 * `P2L_SIMULATION_ROUTES=/p2l-tenant/simulacion-lab?role=driver&qa=true`
 *
 * Ver `tests/QA_LAB_SPEC.md`.
 */
const SIMULATION_ROUTES_FALLBACK =
  '/p2l-tenant/simulacion-lab?role=driver&qa=true,/p2l-tenant/simulation-lab?role=driver&qa=true';
const SIMULATION_ROUTES = (process.env.P2L_SIMULATION_ROUTES?.trim()
  ? process.env.P2L_SIMULATION_ROUTES.split(',')
  : SIMULATION_ROUTES_FALLBACK.split(',')
).map((s) => s.trim()).filter(Boolean);

/** Textos que indican plan inicial / trial / starter (validación flexible). */
const PLAN_HINT_PATTERNS = [
  /\bFREE\b/i,
  /\bPLAN\s+FREE\b/i,
  /\bTRIAL\b/i,
  /\bSTARTER\b/i,
  /\bPLAN\s+STARTER\b/i,
  /\bPlan\s+0\b/i,
  /\bPlan\s+actual\b/i,
  /0\s*COP/i,
  /\$\s*0\b/i,
  /Gratis/i,
  /Prueba/i,
];

module.exports = {
  DASHBOARD_PATH,
  PLAN_HINT_PATTERNS,
  SIMULATION_ROUTES,
};
