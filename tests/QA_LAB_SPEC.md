# Contrato QA Lab — Simulation Lab (Uber-like)

Referencia desde el código de producto (no duplicar lógica de negocio aquí):

- **Shell / landing del lab:** `src/views/UberLikeSimulacionView.vue`  
  - Texto para Playwright (`?qa=true`, `getIncomingRideRequestCount()`, mock conductor sin Google).

- **Mapa + panel QA (`data-testid`) y API global:** `src/views/UberLikeView.vue` (cuando `isQaMode && isSimulationMode`).

- **Router:** `src/router/index.js`  
  - SPA canónico del lab sin auth: **`/simulacion-lab`** (`meta.requiresAuth: false`).  
  - Alias públicos típicos en producción con prefijo tenant:  
    **`/p2l-tenant/simulacion-lab`** y **`/p2l-tenant/simulation-lab`** → redirigen a `/simulacion-lab`.

## URLs que deben cargar `qa-panel` y `window.qaRide`

| Uso | Query mínimos |
|-----|----------------|
| Conductor escritorio QA | `role=driver` · `qa=true` |

Ejemplo estable en CI/local (con `baseURL` del tenant):  
`/p2l-tenant/simulacion-lab?role=driver&qa=true`

Override lista en **`P2L_SIMULATION_ROUTES`** (comma-separated).

## Contrato `window.qaRide` (solo si `qa=true`)

Expuesto en montaje QA en `UberLikeView.vue`; métodos que los specs pueden asumir:

| Miembro | Tipo esperado |
|---------|----------------|
| `runFullFlow` | función |
| `reset` | función |
| `startPickupLeg` | función (`startPickupApproachSimulation`) |
| `getState` | `() => { status, rideId, phase }` |
| `getWallet` | función |
| `getCoords` | función (coords conductor/pasajero para demos) |
| `isMapSimulationRunning` | `() => boolean` — true mientras corre el intervalo de movimiento en mapa (`startRideSimulation`; usado por Playwright pickup→modal). |
| `getIncomingRideRequestCount` | función (integración conductor mock + solicitud **real** móvil) |
| `getQaFlowPrimary` | función |
| `getRideMapGuide` | función (`summary`, `checklist`) |
| `getSocketDebug` | función |

## Contrato UI — `data-testid` principal del panel

| Test id | Rol en producto |
|---------|----------------|
| `qa-panel` | Contenedor aside QA |
| `ride-status` | Estado textual del viaje / simulador |
| `qa-panel-toggle` | Minimizar / expandir panel |
| `wallet-balance` · `trip-counter` | Metadatos visibles QA |
| `qa-flow-guide` · `qa-flow-step-title` · `qa-flow-hint` · `qa-map-leg-summary` · `qa-flow-checklist` | Guía conductor lab |
| `btn-accept` · `btn-arrived` · `btn-start` · `btn-complete` | Flujo orden real producto |
| `btn-cancel` · `btn-run-full-flow` · `btn-reset-flow` | Utilidades QA |
| `btn-sim-pickup-leg` | Animación conductor→pickup + modal llegada |
| `btn-timeout` · `btn-cancel-by-driver` · `btn-no-driver` | Mocks sólo diagnóstico |
| `event-log` | Log texto |
| `driver-marker` · `passenger-marker` | Mapa Leaflet (atributos de posición pueden usarse como respaldo; en specs nuevos preferimos **`qaRide.getCoords`** ante flakes de mapa). |

## Pasajero manual + conductor automatizado — paridad «producción»

En vivo, **la solicitud la dispara solo el pasajero** desde la app uber-like habitual (Google / flujo normal del tenant): **no** entra por URL del lab.

**El conductor**, en paralelo debería tener la **misma experiencia visible que en producción** en lo que permite el modo lab:

| Ámbito | Comportamiento esperado |
|--------|--------------------------|
| **Vista** | `UberLikeView.vue` cargada desde `/simulacion-lab?role=driver&qa=true` (mock de usuario sin Google **pero mismo mapa**, footer, sockets, estados UI que el uber-like normal). |
| **Entrada de solicitudes reales** | El socket y el broadcast de `uber-like:ride_request` alimentan la cola medida con `getIncomingRideRequestCount()` como en producción. |
| **Playwright** | Automatiza **los mismos clics** que haría un conductor humano (p. ej. **Aceptar** vía `btn-accept`); no sustituye la lógica del backend. El panel QA es **adicional** a la UI de producto, no un atajo fuera de ella. |
| **Notificaciones** | El spec pide `geolocation` + `notifications` sobre el origen del tenant (`grantPermissions` en Playwright). Así el navegador puede mostrar notificaciones **si** el producto las dispara y el SO / política corporativa no las bloquea. |
| **Manual operator** | Con `P2L_LAB_MANUAL_MODE=1` el test **no** hace auto-Aceptar: el conductor ve notificaciones y UI “como en prod” y opera a mano mientras el pasajero solicita. |

**Importante:** no ejecutar **Reiniciar simulador** (`btn-reset-flow`) antes de que llegue la solicitud real: vacía estado local y borra la cola mock/real recién armada.

## Mapeo a specs Playwright (este repo)

| Spec | Cobertura declarada |
|------|---------------------|
| `uber-like-simulation-qa.spec.js` | Estados sintéticos, full flow automático, cancel, pickup+modal (`btn-sim-pickup-leg`). Describe en modo **serial** con timeout **180s** por test (pickup animado + red). **`afterAll` cierra el `BrowserContext`**: Chrome se cierra al terminar el archivo, no es fallo del mapa. Tras `reset`, «Cancelar» exige viaje/solicitud cancelable: el spec vuelve a **Aceptar** y luego cancela. |
| `uber-like-lab-await-passenger.spec.js` | `P2L_LAB_AWAIT_REAL_PASSENGER=1`: espera solicitud **real** del móvil y, salvo modo manual, **Aceptar** automatizado + aserción de estado `accepted` en la misma interfaz conductor. |
| `qa-lab/momentums/m1-to-accepted.spec.js` … `m4-to-completed.spec.js` | **Un spec = un momentum**: `runUntil` compartido (`stageRunner.js`); tramo pickup→modal antes de `arrived`. Scripts: `npm run test:qa:m1` … `test:qa:m4`, o `test:qa:momentums` para todos. **Solicitud real por defecto**; `P2L_ALLOW_SYNTHETIC=1` solo para depuración. |

Si el front cambia nombres de `data-testid` o rutas del router, actualizar **`utils/testData.js`** y este archivo en el mismo PR.
