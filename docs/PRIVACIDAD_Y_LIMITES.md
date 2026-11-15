# Restricciones de seguridad, datos y salud

**FilaCero es un prototipo académico**, no un sistema clínico certificado ni un servicio de urgencias.

- No subir a la demostración CURP, NSS, teléfonos ni documentos de personas reales. La base de datos permite persistencia de archivos de pacientes y requiere un proceso institucional de protección de datos antes de su uso real.
- La validación CURP / NSS implementa la **estructura** (CURP 18 caracteres con formato y NSS 11 dígitos); NO comprueba existencia, titularidad, ni todos los dígitos verificadores.
- Los datos de identificación se convierten en huellas SHA-256 usando un secreto del servidor; el nombre y el documento se preservan para la simulación en PostgreSQL. La solución no incluye todavía cifrado de campos/documentos, gestión de claves segura, política de eliminación, autenticación institucional, consentimiento ni auditoría. **No se debe usar con pacientes reales.**
- Las reglas del `Triage Evaluation Service` son un ejemplo que cumple UT-TRIAGE-01; cualquier conjunto de reglas, nivel de prioridad y actuación clínica deben definirse y validarse con la institución. Los síntomas de alarma muestran instrucción de urgencias, no un diagnóstico.
- La consola `/#/admin` y `ADMIN_DEMO_KEY` sólo permiten simular un **sistema externo**. No sustituye un panel médico con RBAC, MFA, auditoría, sesiones, permisos ni validación de consulta.
- La sesión del paciente usa cookie `HttpOnly`, `SameSite=Strict` y firma HMAC, con duración de 2 horas; en entornos HTTPS de producción se requiere `Secure`. La clave demo no se debe reutilizar fuera del entorno local.
- El QR está firmado y no contiene nombre, CURP o NSS. Su validez depende de la verificación en línea y de las políticas que apruebe la clínica. Un archivo SVG descargado puede copiarse: hacen falta políticas de control de acceso, revocación y expiración.
- Offline significa **consultar un pase emitido previamente**, no registrarse ni crear turnos ni sincronizar cambios sin internet.
- El backend incluye comprobación de firma de archivos, límite de tamaño, política same-origin y limitación simple por IP, pero esto no sustituye antivirus, controles contra malware, pruebas de penetración, protección frente a DDoS ni rate limiting distribuido.
- El avance original deja pendientes: definición clínica de reglas, manejo de datos personales y documentos, compatibilidad por dispositivos, aprobación de incrementos, duración de sprints y manejo de reconexión/sincronización.

## Lista antes de cualquier despliegue real

1. Aprobar finalidad, consentimiento, políticas de conservación, derechos de titulares y medidas legales aplicables para datos sensibles.
2. Incorporar autenticación verificada, gestión de roles, auditoría, cifrado en tránsito y reposo, revocación de sesiones y firmas QR, y controles de acceso a documentos.
3. Validar clínicamente las reglas de triaje y su comportamiento ante errores o indisponibilidad.
4. Probar incidentes, rendimiento, alta disponibilidad, fallos de red, restauración, estrés y usabilidad con personas representativas.
5. Integrar el panel clínico real y confirmar procesos institucionales de validación y cierre de turnos.
