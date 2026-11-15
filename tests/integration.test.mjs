import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer, connect} from 'node:net';
import {randomBytes} from 'node:crypto';
const base='http://127.0.0.1';
async function freePort(){return new Promise((resolve,reject)=>{const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port));});});}
async function startApi(port){
  const child=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url).pathname,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DEMO_MODE:'true',ADMIN_DEMO_KEY:'demo-fila-2026'},stdio:'ignore'});
  for(let i=0;i<60;i++){
    if(child.exitCode!=null)throw new Error('El servidor se cerró inesperadamente.');
    try{const res=await fetch(`${base}:${port}/api/health`);if(res.ok)return child;}catch{}
    await new Promise(resolve=>setTimeout(resolve,60));
  }
  child.kill();throw new Error('No se inició el servidor de pruebas.');
}
async function connectPatientWs(port,cookie) {
  return new Promise((resolve,reject)=>{
    const client=connect(port,'127.0.0.1');let buf=Buffer.alloc(0),upgraded=false;
    let deliver=null;const messages=[];
    const timeout=setTimeout(()=>{client.destroy();reject(new Error('WebSocket sin respuesta'));},3000);
    client.on('error',reject);
    client.on('connect',()=>{
      const key=randomBytes(16).toString('base64');
      client.write(`GET /ws/queues HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${key}\r\nCookie: ${cookie}\r\nOrigin: http://127.0.0.1:${port}\r\n\r\n`);
    });
    client.on('data',chunk=>{
      buf=Buffer.concat([buf,chunk]);
      if(!upgraded){const end=buf.indexOf('\r\n\r\n');if(end<0)return;const head=buf.subarray(0,end).toString();if(!head.startsWith('HTTP/1.1 101')){clearTimeout(timeout);reject(new Error('Upgrade WS rechazado: '+head));client.destroy();return;}
        upgraded=true;buf=buf.subarray(end+4);clearTimeout(timeout);resolve({client,next:()=>new Promise((done,fail)=>{const desired=messages.find(x=>x.type==='queue.updated');if(desired)return done(desired);deliver=done;setTimeout(()=>fail(new Error('No llegó el aviso WS')),2500);})});}
      while(buf.length>=2){let len=buf[1]&0x7f;let header=2;if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);header=4;}if(buf.length<header+len)return;
        const data=JSON.parse(buf.subarray(header,header+len).toString());buf=buf.subarray(header+len);messages.push(data);if(deliver&&data.type==='queue.updated'){deliver(data);deliver=null;}
      }
    });
  });
}
test('ST-E2E-03: registro, triaje, turno y validación QR + IT-SOCKET-02', {timeout:15000}, async()=>{
  const port=await freePort(),server=await startApi(port),url=`${base}:${port}`;
  const req=async(path,options={})=>{const response=await fetch(url+path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});return {response,data:await response.json()};};
  try{
    const reg=await req('/api/register',{method:'POST',body:JSON.stringify({fullName:'Usuario de Pruebas',nss:'12345678901',clinic:'Unidad Norte'})});
    assert.equal(reg.response.status,201);const cookie=reg.response.headers.get('set-cookie').split(';')[0];
    const t=await req('/api/triage',{method:'POST',headers:{cookie},body:JSON.stringify({chestPain:true,systolic:140,diastolic:90})});
    assert.equal(t.data.triage.color,'rojo');
    const issued=await req('/api/turns',{method:'POST',headers:{cookie},body:'{}'});
    assert.equal(issued.response.status,201);assert.equal(issued.data.turn.code,'A-001');assert.match(issued.data.turn.qrPayload,/^FC1\|/);
    const adminKey='demo-fila-2026';
    const verify=await req('/api/admin/verify-qr',{method:'POST',headers:{'X-Admin-Key':adminKey},body:JSON.stringify({qrPayload:issued.data.turn.qrPayload})});
    assert.equal(verify.data.valid,true);
    const badVerify=await req('/api/admin/verify-qr',{method:'POST',headers:{'X-Admin-Key':adminKey},body:JSON.stringify({qrPayload:issued.data.turn.qrPayload.replace('A-001','A-999')})});
    assert.equal(badVerify.response.status,422);
    const sw=await fetch(`${url}/sw.js`);assert.equal(sw.status,200);
    const ws=await connectPatientWs(port,cookie);
    const noticePromise=ws.next();
    const update=await req(`/api/admin/turns/${issued.data.turn.id}`,{method:'PATCH',headers:{'X-Admin-Key':adminKey},body:JSON.stringify({status:'Llamado a consultorio',room:'Consultorio 3'})});
    assert.equal(update.data.turn.status,'Llamado a consultorio');
    const event=await noticePromise;assert.equal(event.type,'queue.updated');assert.equal(event.turn.code,'A-001');assert.equal(event.turn.room,'Consultorio 3');ws.client.destroy();
    const status=await req('/api/turns/mine',{headers:{cookie}});assert.equal(status.data.turn.room,'Consultorio 3');
  }finally{server.kill('SIGTERM');}
});
