import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { validateRegistration, ALLOWED_STATUS } from './validation.mjs';
import { evaluateTriage } from './triage.mjs';
import { cookieValue, readSession, issueSession, checkTicket, secureEquals } from './auth.mjs';
import { createHub } from './ws.mjs';
import { MemoryRepo, PostgresRepo } from './repository.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../web');
const envPath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.env');
try { const raw=await fs.readFile(envPath,'utf8'); for(const line of raw.split(/\r?\n/)) { const m=/^([A-Z][A-Z_0-9]*)=(.*)$/.exec(line.trim()); if(m && !(m[1] in process.env))process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,''); } }catch{}
const DEMO=process.env.DEMO_MODE!=='false';
const PORT=Number(process.env.PORT||3000);
const HOST=process.env.HOST||'0.0.0.0';
const SESSION_SECRET=process.env.SESSION_SECRET || (DEMO ? randomBytes(32).toString('hex') : '');
const QR_SECRET=process.env.QR_SECRET || (DEMO ? randomBytes(32).toString('hex') : '');
const ADMIN_KEY=process.env.ADMIN_DEMO_KEY || (DEMO ? 'demo-fila-2026' : '');
if(!DEMO && (!process.env.DATABASE_URL || SESSION_SECRET.length<32 || QR_SECRET.length<32 || ADMIN_KEY.length<24)) {
  console.error('En modo PostgreSQL define DATABASE_URL, SESSION_SECRET, QR_SECRET y ADMIN_DEMO_KEY robustos.'); process.exit(1);
}
let repo, pool;
if(DEMO){repo=new MemoryRepo({qrSecret:QR_SECRET,pepper:SESSION_SECRET});}
else {
  const {Pool}=await import('pg');
  pool=new Pool({connectionString:process.env.DATABASE_URL, max:12, connectionTimeoutMillis:5000});
  await pool.query('SELECT 1');
  repo=new PostgresRepo(pool,{qrSecret:QR_SECRET,pepper:SESSION_SECRET});
}
const hub=createHub();
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const rateBucket=new Map();
function limit(req, scope, max=30, duration=60_000) {
  const key=`${req.socket.remoteAddress}:${scope}`;const now=Date.now();
  const entry=rateBucket.get(key); if(!entry || entry.reset<now){rateBucket.set(key,{count:1,reset:now+duration});return false;}
  entry.count++;return entry.count>max;
}
function json(res,status,body,extra={}) {
  res.writeHead(status,{ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra }); res.end(JSON.stringify(body));
}
function fail(res,status,message,errors){json(res,status,{error:message,...(errors?{fields:errors}:{})});}
async function readJson(req) {
  let size=0, chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>1_600_000)throw Object.assign(new Error('La solicitud excede el límite permitido.'),{status:413});chunks.push(chunk);}
  try {return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(new Error('Envía JSON válido.'),{status:400});}
}
function patientId(req){return readSession(cookieValue(req.headers.cookie,'fc_session'),SESSION_SECRET);}
async function requirePatient(req,res){const id=patientId(req);if(!id || !await repo.getPatient(id)){fail(res,401,'Primero debes completar el pre-registro.');return null;}return id;}
function requireAdmin(req,res){if(!ADMIN_KEY || !secureEquals(String(req.headers['x-admin-key']||''),ADMIN_KEY)){fail(res,401,'Clave de administrador incorrecta.');return false;}return true;}
function sanitizeTurn(turn){if(!turn)return null;const{patientId,nonce,...safe}=turn;return safe;}
const VALID_ROOM=/^Consultorio [1-9]\d?$/;
async function api(req,res,url){
  const method=req.method;const pathname=url.pathname;
  if(pathname==='/api/health' && method==='GET')return json(res,200,{ok:true,mode:DEMO?'demo':'postgresql'});
  if(pathname==='/api/meta' && method==='GET')return json(res,200,{app:'FilaCero',demo:DEMO,version:'0.4.0',clinicalRulesValidated:false});
  if(pathname==='/api/register' && method==='POST') {
    if(limit(req,'registration',8))return fail(res,429,'Demasiados registros. Intenta más tarde.');
    const check=validateRegistration(await readJson(req));
    if(!check.valid)return fail(res,422,'Revisa los campos del formulario.',check.errors);
    const patient=await repo.register(check.value);
    const cookie=`fc_session=${issueSession(patient.id,SESSION_SECRET)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200${process.env.NODE_ENV==='production'?'; Secure':''}`;
    return json(res,201,{patient},{'Set-Cookie':cookie});
  }
  if(pathname==='/api/me' && method==='GET') {
    const id=patientId(req);const patient=id?await repo.getPatient(id):null;
    if(!patient)return json(res,200,{patient:null,triage:null,turn:null});
    return json(res,200,{patient,triage:await repo.getTriage(id),turn:sanitizeTurn(await repo.getTurnByPatient(id))});
  }
  if(pathname==='/api/triage' && method==='POST') {
    const id=await requirePatient(req,res);if(!id)return;
    if(await repo.getTurnByPatient(id))return fail(res,409,'El turno ya fue emitido; no puede modificarse el triaje.');
    let result;try{result=evaluateTriage(await readJson(req));}catch(e){return fail(res,422,e.message);}
    await repo.saveTriage(id,result);return json(res,200,{triage:result});
  }
  if(pathname==='/api/turns' && method==='POST') {
    if(limit(req,'turn',15))return fail(res,429,'Excediste el límite de solicitudes de turno.');
    const id=await requirePatient(req,res);if(!id)return;
    try {const turn=await repo.issueTurn(id);return json(res,201,{turn:sanitizeTurn(turn)});}catch(e){return fail(res,409,e.message);}
  }
  if(pathname==='/api/turns/mine' && method==='GET') {
    const id=await requirePatient(req,res);if(!id)return;
    return json(res,200,{turn:sanitizeTurn(await repo.getTurnByPatient(id))});
  }
  if(pathname==='/api/admin/turns' && method==='GET') {
    if(!requireAdmin(req,res))return;
    return json(res,200,{turns:(await repo.listTurns()).map(sanitizeTurn)});
  }
  if(pathname==='/api/admin/verify-qr' && method==='POST') {
    if(limit(req,'verify',40))return fail(res,429,'Excediste el límite de verificaciones.');
    if(!requireAdmin(req,res))return;
    const body=await readJson(req); const parsed=checkTicket(body.qrPayload,QR_SECRET);
    if(!parsed)return fail(res,422,'El código QR no es válido.');
    const turn=await repo.getTurnByCode(parsed.code);
    if(!turn || !secureEquals(turn.nonce,parsed.nonce))return fail(res,404,'El turno no existe o el QR no corresponde.');
    const {qrPayload,patientId,nonce,...safe}=turn;
    return json(res,200,{valid:true,turn:safe});
  }
  const statusMatch=/^\/api\/admin\/turns\/([a-f0-9-]{36})$/.exec(pathname);
  if(statusMatch && method==='PATCH') {
    if(!requireAdmin(req,res))return;
    const body=await readJson(req),status=String(body.status||''),room=String(body.room||'').trim();
    if(!ALLOWED_STATUS.includes(status))return fail(res,422,'Estado no permitido.');
    if(room && !VALID_ROOM.test(room))return fail(res,422,'Usa el formato Consultorio 3.');
    if(status==='Llamado a consultorio' && !room)return fail(res,422,'El estado llamado requiere un consultorio.');
    const turn=await repo.updateTurn(statusMatch[1],status,room);
    if(!turn)return fail(res,404,'Turno no encontrado.');
    hub.notify(turn.patientId,turn);
    return json(res,200,{turn:sanitizeTurn(turn)});
  }
  return fail(res,404,'Ruta de API no encontrada.');
}
async function staticFile(req,res,pathName) {
  const pathname=pathName==='/'||pathName==='/admin'?'/index.html':pathName;
  const safe=path.normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/,'');
  const file=path.resolve(ROOT,safe);
  if(!file.startsWith(ROOT+path.sep) && file!==ROOT){res.writeHead(403);res.end();return;}
  try {
    const stat=await fs.stat(file);if(!stat.isFile())throw Error('not file');
    const buffer=await fs.readFile(file);
    const ext=path.extname(file);
    res.writeHead(200,{'Content-Type':MIME[ext]||'application/octet-stream','Content-Length':buffer.length,'Cache-Control':ext==='.html'||safe==='sw.js'?'no-cache':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
    if(req.method==='HEAD')res.end();else res.end(buffer);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('No encontrado');}
}
const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,`http://${req.headers.host||'localhost'}`);
    const origin=req.headers.origin;
    if(origin){const expected=`${process.env.NODE_ENV==='production'?'https':'http'}://${req.headers.host}`;if(origin!==expected){return fail(res,403,'Origen no autorizado.');}}
    if(url.pathname.startsWith('/api/'))return await api(req,res,url);
    if(!['GET','HEAD'].includes(req.method))return fail(res,405,'Método no permitido.');
    return await staticFile(req,res,url.pathname);
  } catch(e) {console.error('Solicitud falló:',e.message);if(!res.headersSent)fail(res,e.status||500,e.status?e.message:'Ocurrió un error en el servidor.');}
});
server.on('upgrade',(req,socket,head)=>{
  try{const url=new URL(req.url,'http://localhost');if(url.pathname!=='/ws/queues'){socket.destroy();return;}hub.upgrade(req,socket,head,patientId(req));}catch{socket.destroy();}
});
server.listen(PORT,HOST,()=>console.log(`FilaCero ${DEMO?'[DEMO - sin datos reales]':'[PostgreSQL]'} en http://localhost:${PORT}\nPanel de prueba: http://localhost:${PORT}/#/admin`));
const shutdown=async()=>{hub.close();server.close();if(pool)await pool.end();};
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
