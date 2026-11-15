const CURP_RE = /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
export function isCurp(value) {
  return CURP_RE.test(String(value || '').trim().toUpperCase());
}
export function isNss(value) { return /^\d{11}$/.test(String(value || '').trim()); }
export function validateRegistration(body = {}) {
  const name = String(body.fullName || '').trim().replace(/\s+/g, ' ');
  const curp = String(body.curp || '').trim().toUpperCase();
  const nss = String(body.nss || '').trim();
  const phone = String(body.phone || '').trim();
  const clinic = String(body.clinic || '').trim();
  const errors = {};
  if (!/^[\p{L} '.\-]{5,110}$/u.test(name) || name.split(' ').length < 2) errors.fullName = 'Escribe nombre y apellido válidos.';
  if (!curp && !nss) errors.curp = 'Indica CURP o NSS.';
  if (curp && !isCurp(curp)) errors.curp = 'La CURP debe tener 18 caracteres con estructura válida.';
  if (nss && !isNss(nss)) errors.nss = 'El NSS debe contener exactamente 11 dígitos.';
  if (phone && !/^\d{10}$/.test(phone)) errors.phone = 'El teléfono debe tener 10 dígitos.';
  if (!['Clínica Centro', 'Unidad Norte', 'Unidad Sur'].includes(clinic)) errors.clinic = 'Selecciona una clínica.';
  let document = null;
  if (body.document != null) {
    const d = body.document;
    if (!d || typeof d !== 'object' || typeof d.dataBase64 !== 'string' || typeof d.name !== 'string') {
      errors.document = 'Documento inválido.';
    } else if (!['application/pdf', 'image/jpeg', 'image/png'].includes(d.mime)) {
      errors.document = 'Sólo se acepta PDF, JPG o PNG.';
    } else if (!/^[a-zA-Z0-9_\- .()]{1,100}$/.test(d.name)) {
      errors.document = 'Nombre de archivo no válido.';
    } else if (!/^[A-Za-z0-9+/]+={0,2}$/.test(d.dataBase64) || d.dataBase64.length > 1_400_000) {
      errors.document = 'Documento ilegible o de más de 1 MB.';
    } else {
      const buffer = Buffer.from(d.dataBase64, 'base64');
      const validSignature = d.mime === 'application/pdf' ? buffer.subarray(0,5).toString() === '%PDF-' :
        d.mime === 'image/png' ? buffer.subarray(0,8).toString('hex') === '89504e470d0a1a0a' :
        buffer.subarray(0,3).toString('hex') === 'ffd8ff';
      if (!validSignature || buffer.length > 1_048_576 || buffer.length === 0) errors.document = 'Tipo o tamaño del documento inválido.';
      else document = { name: d.name, mime: d.mime, buffer };
    }
  }
  return { valid: !Object.keys(errors).length, errors, value: { fullName: name, curp, nss, phone, clinic, document } };
}
export const ALLOWED_STATUS = ['En espera', 'Llamado a consultorio', 'En atención', 'Atendido'];
