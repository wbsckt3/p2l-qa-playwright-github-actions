/**
 * Resuelve Google Chrome (no Edge, no Firefox): ruta explícita a chrome.exe.
 * En Windows prueba Program Files, (x86) y %LOCALAPPDATA% si no hay env.
 */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * @returns {{ mode: 'executable', path: string, hint: string } | { mode: 'channel' }}
 */
function resolveChromeLaunch() {
  const tryFile = (p) => (p && fs.existsSync(p) ? p : null);

  const fromEnv = process.env.PLAYWRIGHT_CHROME_EXECUTABLE;
  if (fromEnv) {
    const resolved = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
    const hit = tryFile(resolved);
    if (hit) {
      return { mode: 'executable', path: hit, hint: 'PLAYWRIGHT_CHROME_EXECUTABLE' };
    }
    console.warn(
      '[playwright] PLAYWRIGHT_CHROME_EXECUTABLE apuntado pero no existe: ' + resolved
    );
  }

  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    const candidates = [
      path.join('C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join('C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ].filter(Boolean);

    for (const c of candidates) {
      const hit = tryFile(c);
      if (hit) {
        return { mode: 'executable', path: hit, hint: 'instalación típica Windows' };
      }
    }
  }

  return { mode: 'channel' };
}

module.exports = { resolveChromeLaunch };
