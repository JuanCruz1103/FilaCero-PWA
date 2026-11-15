// DEMOSTRACIÓN, NO REGLAS MÉDICAS APROBADAS. La institución debe validarlas antes de un uso real.
export function evaluateTriage(q = {}) {
  const normalized = {
    chestPain: q.chestPain === true,
    breathingDifficulty: q.breathingDifficulty === true,
    unconscious: q.unconscious === true,
    fever: q.fever === true,
    severePain: q.severePain === true,
    dizziness: q.dizziness === true,
    systolic: q.systolic === '' || q.systolic == null ? null : Number(q.systolic),
    diastolic: q.diastolic === '' || q.diastolic == null ? null : Number(q.diastolic),
    description: String(q.description || '').slice(0, 400).trim()
  };
  for (const key of ['systolic','diastolic']) {
    if (normalized[key] != null && (!Number.isInteger(normalized[key]) || normalized[key] < 40 || normalized[key] > 260)) throw new Error('Presión arterial fuera del rango admitido.');
  }
  if (normalized.chestPain || normalized.breathingDifficulty || normalized.unconscious) {
    return { level: 'NIVEL_1_URGENCIA', color: 'rojo', title: 'Aviso de atención urgente', message: 'Ante estos síntomas, no esperes un turno digital. Solicita atención inmediata en urgencias o llama al servicio de emergencias.', answers: normalized, reviewed: false };
  }
  if (normalized.severePain || normalized.fever || normalized.dizziness) {
    return { level: 'REVISION_PRIORITARIA', color: 'ambar', title: 'Revisión inicial prioritaria', message: 'Tu información necesita revisión por personal autorizado. Esta clasificación es solamente orientativa.', answers: normalized, reviewed: false };
  }
  return { level: 'PENDIENTE_VALORACION', color: 'verde', title: 'Registro recibido', message: 'Tus respuestas fueron registradas. La prioridad definitiva la establecerá el personal de la clínica.', answers: normalized, reviewed: false };
}
