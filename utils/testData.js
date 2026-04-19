/**
 * Rutas y datos compartidos entre specs (producción).
 */

const DASHBOARD_PATH = '/p2l-tenant/dashboard';

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
};
