// Implementación WebSocket mínima RFC 6455: sólo eventos pequeños del servidor y control ping/pong.
// No se envía información personal; cada conexión pertenece al paciente autenticado por cookie.
import { createHash } from 'node:crypto';
const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function frame(data, opcode=1) {
  const bytes=Buffer.isBuffer(data)?data:Buffer.from(data);
  if(bytes.length<126) return Buffer.concat([Buffer.from([0x80|opcode,bytes.length]),bytes]);
  const hdr=Buffer.alloc(4); hdr[0]=0x80|opcode;hdr[1]=126;hdr.writeUInt16BE(bytes.length,2);
  return Buffer.concat([hdr,bytes]);
}
export function createHub() {
  const connections=new Map();
  function add(patientId,socket) {
    if(!connections.has(patientId)) connections.set(patientId,new Set());
    connections.get(patientId).add(socket);
    const cleanup=()=>{connections.get(patientId)?.delete(socket);if(connections.get(patientId)?.size===0)connections.delete(patientId);};
    socket.on('close',cleanup);socket.on('error',cleanup);
    let buffer=Buffer.alloc(0);
    socket.on('data',chunk=>{
      buffer=Buffer.concat([buffer,chunk]);
      if(buffer.length>4096){socket.destroy();return;}
      while(buffer.length>=2){
        const masked=!!(buffer[1]&0x80),code=buffer[0]&0x0f,len=buffer[1]&0x7f;
        if(!masked || len>=126){socket.destroy();return;}
        if(buffer.length<6+len)break;
        const mask=buffer.subarray(2,6),payload=Buffer.from(buffer.subarray(6,6+len));
        for(let i=0;i<len;i++)payload[i]^=mask[i%4];
        buffer=buffer.subarray(6+len);
        if(code===8){socket.end(frame(Buffer.alloc(0),8));break;}
        if(code===9) socket.write(frame(payload,10));
      }
    });
    socket.write(frame(JSON.stringify({type:'connected',message:'Seguimiento activo'})));
  }
  return {
    upgrade(req,socket,head,patientId) {
      const key=req.headers['sec-websocket-key'];
      if(!patientId || !req.headers.upgrade?.toLowerCase().includes('websocket') || !/^[A-Za-z0-9+/]{22}==$/.test(String(key||''))) {socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');socket.destroy();return;}
      const origin=req.headers.origin;
      if(origin){try{const u=new URL(origin);if(u.host!==req.headers.host){socket.destroy();return;}}catch{socket.destroy();return;}}
      const accept=createHash('sha1').update(key+GUID).digest('base64');
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+accept+'\r\n\r\n');
      add(patientId,socket);
      if(head?.length)socket.emit('data',head);
    },
    notify(patientId,turn) {
      const safe={ id:turn.id,code:turn.code,clinic:turn.clinic,status:turn.status,room:turn.room,queueAhead:turn.queueAhead,updatedAt:turn.updatedAt };
      for(const s of connections.get(patientId)||[]) if(!s.destroyed) s.write(frame(JSON.stringify({type:'queue.updated',turn:safe,ts:Date.now()})));
    },
    close() {for(const set of connections.values())for(const s of set)s.destroy();connections.clear();}
  };
}
