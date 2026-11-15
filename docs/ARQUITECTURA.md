# Arquitectura implementada de FilaCero

## Referencia

Basada en *Avance 1 – FilaCero*, especialmente las páginas 2, 3, 5, 6 y 7. El documento requiere una PWA **para el paciente** y considera que el panel de clínica es **externo**. No prescribe Angular, React ni un lenguaje para la API: para un prototipo autónomo se eligió JavaScript modular y Node.js. PostgreSQL es la base de datos prevista.

## Vista lógica

```text
┌────────────────────────────── PACIENTE / TELÉFONO ──────────────────────────────┐
│ PWA web/ (HTML, CSS, JavaScript modular, manifest.webmanifest)                 │
│  Inicio -> Registro -> Cuestionario -> Pase QR -> Estado del turno              │
│  Service Worker: caché del shell; IndexedDB: último pase QR, sin CURP/NSS       │
└────────────────────────────────┬─────────────────────┬────────────────────────┘
                                 │ REST /api/*         │ WebSocket /ws/queues
                        cookies HttpOnly              │ sesión por cookie
                                 │                     │
┌────────────────────────────────▼─────────────────────▼────────────────────────┐
│                         API Node.js                                            │
│  /server/validation.mjs: validación CURP/NSS                                   │
│  /server/triage.mjs: evaluador de ejemplo no validado clínicamente              │
│  /server/auth.mjs: sesión HMAC; emisión/verificación QR HMAC                    │
│  /server/repository.mjs: repositorio intercambiable (memoria / PostgreSQL)      │
│  /server/ws.mjs: gateway WebSocket, eventos individuales del paciente           │
└────────────────────────────────┬─────────────────────▲────────────────────────┘
                                 │ SQL / pg            │ REST con clave técnica
                                 ▼                     │
                   PostgreSQL 16                Consola externa de prueba
             pacientes, documentos,             /#/admin (NO panel de
             triaje, turnos, secuencia          producción de la clínica)
```

## Endpoints implementados

| Método | Ruta | Función | Autorización |
|---|---|---|---|
| GET | `/api/meta` | Versión y modo de operación | Pública |
| GET | `/api/health` | Salud básica | Pública |
| POST | `/api/register` | Datos y archivo opcional PDF/JPG/PNG hasta 1 MB | Pública; crea cookie HttpOnly |
| GET | `/api/me` | Estado del proceso actual | Cookie de paciente |
| POST | `/api/triage` | Evaluación inicial demostrativa | Cookie de paciente |
| POST | `/api/turns` | Turno único y QR firmado | Cookie de paciente |
| GET | `/api/turns/mine` | Estado del turno | Cookie de paciente |
| WS | `/ws/queues` | Cambios `queue.updated` | Cookie de paciente, mismo origen |
| GET | `/api/admin/turns` | Lista de turnos | Cabecera `X-Admin-Key` (sólo prueba) |
| PATCH | `/api/admin/turns/:id` | Cambio de turno y emisión por WebSocket | Cabecera `X-Admin-Key` |
| POST | `/api/admin/verify-qr` | Verifica firma del pase | Cabecera `X-Admin-Key` |

### Eventos WebSocket

```json
{
  "type": "queue.updated",
  "turn": {"id":"uuid", "code":"A-045", "status":"Llamado a consultorio", "room":"Consultorio 3", "queueAhead":0, "updatedAt":"ISO-8601"},
  "ts": 0
}
```

Sólo se emiten cambios al paciente propietario de la sesión. La página vibra y muestra una notificación cuando recibe un cambio de estado (vibración sujeta al soporte del dispositivo).

## Persistencia y desconexión

- **Modo demostración por defecto:** en memoria. Los turnos se pierden al reiniciar el servidor. No introducir datos reales.
- **Modo PostgreSQL:** requiere `DATABASE_URL`, migración y `pg`. `patients` guarda nombre, clínica, huellas de CURP/NSS y últimos 4 dígitos del teléfono. `patient_documents` guarda los bytes de un archivo de hasta 1 MB; **es necesario incorporar políticas de retención, cifrado y control de acceso antes de usar datos reales**. La PWA sólo conserva el pase digital con `qrPayload`, SVG y metadatos del turno en IndexedDB. Ningún dato de CURP/NSS entra a IndexedDB.
- El Service Worker precachea **los recursos estáticos** para recarga offline; nunca cachea `/api/*`.
- No se generan QR nuevos sin conexión y el último estado offline puede ser obsoleto. Mostrar el QR offline no verifica por sí solo que el turno esté vigente en el servidor.

## Decisiones técnicas

1. UI sin frameworks ni CDNs: descarga pequeña y compatibilidad móvil; el QR SVG se construye localmente con corrección Reed–Solomon.
2. Sin dependencias externas en el modo de demostración; `pg` sólo se importa cuando PostgreSQL está activado.
3. Autenticación temporal por cookie firmada (2 h) y códigos QR por HMAC, sin datos sensibles en el QR.
4. El panel real de validación/gestión queda fuera del alcance; se incluye una consola técnica restringida de prueba para demostrar la integración.
5. La evaluación de prioridad se realiza en el backend, no en la PWA. Las reglas son ejemplos, NO reglas clínicas aprobadas.

## Pendiente de producción

Integración con identidad institucional real, roles y auditoría para panel médico, HTTPS en dominio real, autorización clínica de reglas de prioridad, gestión segura de archivos personales, caducidad/revocación de QR, ventanas reales de atención, cifrado y retención de datos, política de privacidad y consentimiento, alta disponibilidad y rate limiting distribuido.
