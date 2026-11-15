# Plan Scrum propuesto (5 semanas)

El avance plantea 5 sprints semanales, con Product Backlog, Sprint Planning, Daily Scrum (15 minutos), Sprint Review y Retrospective. Esta distribución está tomada como **propuesta de trabajo**, no como confirmación de responsabilidades.

| Sprint | Objetivo | Evidencia en el repositorio |
|---|---|---|
| 1 | Base PWA, navegación y pre-registro | `web/index.html`, `web/app.js`, `web/style.css`, `server/validation.mjs` |
| 2 | Cuestionario y clasificación de triaje | `server/triage.mjs`, `tests/triage.test.mjs` |
| 3 | Emisión de turno QR y almacenamiento offline | `server/auth.mjs`, `web/qr.js`, `web/db.js`, `web/sw.js` |
| 4 | Seguimiento en tiempo real y avisos | `server/ws.mjs`, cliente WebSocket de `web/app.js`, consola de prueba |
| 5 | Integración, regresión, rendimiento, usabilidad y entrega | `tests/`, `.github/workflows/ci.yml`, `performance/`, `docs/` |

## Backlog prioritario

1. HU-01: Como paciente, quiero completar un pre-registro con CURP/NSS para adelantar trámites.
2. HU-02: Como paciente, quiero responder preguntas de síntomas para dar información preliminar.
3. HU-03: Como paciente, quiero un turno QR verificable para presentarlo en la clínica.
4. HU-04: Como paciente, quiero abrir mi QR en modo avión para no perderlo.
5. HU-05: Como paciente, quiero recibir avisos cuando cambie mi turno.
6. HU-06: Como equipo, quiero automatizar validaciones y regresión antes de integrar código.

## Responsables propuestos por el documento

- Juan Cruz: coordinación funcional y backlog.
- Octavio Guerrero: backend e integración.
- Uriel Osuna: desarrollo de PWA, formularios, triaje, QR y offline.
- Tania Portillo: pruebas, documentación y calidad.

## Ramas y versiones

- `main` = estable; `develop` = integración; `feature/nombre` = funcionalidad; `hotfix/nombre` = correcciones urgentes.
- Pull Requests con revisión por pares, commits `feat:`, `fix:`, `test:`, `docs:` y GitHub Actions antes de fusionar.
- Versionamiento semántico: `v0.1.0` registro, `v0.2.0` triaje, `v0.3.0` QR offline, `v0.4.0` WebSocket (etapa actual del prototipo), `v1.0.0` tras validación formal.

## Definition of Done

El incremento funciona con datos ficticios, tiene validaciones, pruebas ejecutadas, documentación, revisión de integración y criterios de aceptación explícitos. Los objetivos no ejecutados deben figurar como **pendientes** y nunca darse por cumplidos.
