# Matriz de pruebas: plan del Avance 1

Criterios de aceptación tomados de las páginas 6–7 de *Avance 1 – FilaCero*. **Una prueba presente en código no implica que las metas de rendimiento, accesibilidad o validez clínica estén acreditadas**.

| ID | Criterio del documento | Estado actual | Comprobación |
|---|---|---|---|
| UT-TRIAGE-01 | Dolor torácico agudo y PA 140/90 → `NIVEL_1_URGENCIA`, rojo | **Automatizada, aprobada** sobre reglas de ejemplo | `npm test` (triage) |
| IT-SOCKET-02 | Cambio de `A-045` de “En espera” a “Llamado a consultorio 3”, alerta visual/vibración, evento en menos de 500 ms | **Integración WebSocket automatizada** con turno `A-001` de prueba; latencia de 500 ms y vibración real **pendientes de medir en dispositivos** | `tests/integration.test.mjs`, prueba móvil |
| ST-E2E-03 | Registro NSS → triaje → QR → escaneo → atendido → consistencia PostgreSQL | **Flujo API en memoria automatizado**; persistencia y escáner físico **pendientes** | `tests/integration.test.mjs`, prueba PG |
| PT-PERF-04 | FCP ≤ 1.5 s en 4G y GET estado API < 200 ms | **No medido** | Lighthouse, `performance/k6-status.js` |
| RT-REG-05 | 100 % pruebas automáticas CURP/NSS antes del despliegue | **Automatizada en CI**; sujeto a ejecutar en GitHub | `.github/workflows/ci.yml` |
| ST-LOAD-06 | 2000 solicitudes/segundo por 5 min, responder estable o HTTP 429 | **No ejecutado**; plan de carga inicial, tasa por calibrar | `performance/load-qr.jmx`, JMeter en sandbox |
| FT-OFFLINE-07 | Generar QR en línea, modo avión y recargar, QR escaneable | **Implementado** Service Worker + IndexedDB, **pendiente validación física** | Móvil y navegador con modo avión |
| UT-USAB-08 | 10 adultos mayores, >90 % completan en <2 min y SUS >80 | **No ejecutada** | Sesiones con participantes; actas y SUS |

## Pruebas automáticas disponibles

```bash
npm run check
npm test
```

Incluye: validaciones de formularios, documentos con firma de archivo, evaluación roja en casos de prueba, firma y rechazo de QR alterados, sesión, estructura QR y flujo API más evento WebSocket autenticado.

## Prueba manual offline FT-OFFLINE-07

1. Ejecutar la PWA desde `http://localhost:3000` en el equipo, o desde un dominio HTTPS accesible en el teléfono.
2. Completar registro y cuestionario **con datos ficticios**, emitir turno y comprobar que aparece QR.
3. Confirmar que el Service Worker está instalado en DevTools > Application y que IndexedDB contiene el almacén `tickets`.
4. Con **este mismo dispositivo** activo, activar modo avión y cerrar la conexión de red. Recargar `/#/turno`.
5. Confirmar que el QR se representa, que hay una leyenda de “guardado offline” y que el servidor **no** se consulta. Escanear el código con un lector adecuado (la validación del turno en servidor exige conexión del escáner).
6. Desactivar modo avión y verificar la recuperación de estado en línea.

Importante: en `localhost`, Service Workers funcionan sin HTTPS; desde otro dispositivo usando una IP privada HTTP normalmente **no** se habilitan Service Workers. Publicar en HTTPS para probarlo en celulares diferentes.

## Prueba manual de notificaciones

1. Con el paciente en `/#/turno` y conectado, abrir `/#/admin` en otra sesión.
2. Entrar con `ADMIN_DEMO_KEY`, emitir desde allí el cambio `Llamado a consultorio` y asignar `Consultorio 3`.
3. Verificar alerta visual, actualización de estado y vibración si el móvil la permite. Medir desde el cambio hasta la recepción con herramientas de instrumentación.
4. No usar el tiempo de recarga manual como sustituto del indicador de latencia WebSocket.

## Rendimiento y estrés

- Ejecutar Lighthouse con emulación 4G para medir FCP; registrar navegador, dispositivo, red y cinco repeticiones.
- Ejecutar `k6 run -e BASE_URL=http://localhost:3000 -e COOKIE='fc_session=...' performance/k6-status.js`. El archivo registra latencia; sus umbrales son metas, no resultados.
- JMeter: configurar `host`, `port`, `cookie` y un ambiente aislado. `performance/load-qr.jmx` es un **punto de partida** para el endpoint de emisión; no implementa aún la carga mixta de WebSocket ni garantiza 2000 RPS.
- Para 2000 RPS sostenidos durante 5 minutos deben prepararse múltiples usuarios de prueba, métricas de CPU/DB y un generador de tráfico independiente. El límite por IP del servidor puede producir 429 intencionalmente.
