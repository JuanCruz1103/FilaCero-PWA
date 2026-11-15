import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export function sign(data, secret) { return createHmac('sha256', secret).update(data).digest('base64url'); }
export function secureEquals(a, b) {
  const left = Buffer.from(String(a ?? '')); const right = Buffer.from(String(b ?? ''));
  return left.length === right.length && timingSafeEqual(left, right);
}
export function issueSession(patientId, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: patientId, exp: now + 2 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}
export function readSession(token, secret, now = Date.now()) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !secureEquals(sign(parts[0],secret), parts[1])) return null;
  try { const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); return value.exp > now && typeof value.sub === 'string' ? value.sub : null; }
  catch { return null; }
}
export function cookieValue(header, name) {
  return String(header ?? '').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${name}=`))?.slice(name.length+1) || '';
}
export function signTicket(code, nonce, secret) {
  const raw = `FC1|${code}|${nonce}`;
  return `${raw}|${sign(raw, secret).slice(0, 22)}`;
}
export function checkTicket(qr, secret) {
  const match = /^FC1\|(A-\d{3,6})\|([A-Za-z0-9_-]{12,32})\|([A-Za-z0-9_-]{22})$/.exec(String(qr || ''));
  if (!match) return null;
  const raw = `FC1|${match[1]}|${match[2]}`;
  return secureEquals(sign(raw, secret).slice(0,22), match[3]) ? { code:match[1], nonce:match[2] } : null;
}
export function createNonce() { return randomBytes(9).toString('base64url'); }
