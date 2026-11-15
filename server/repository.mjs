import { createHash, randomUUID } from 'node:crypto';
import { createNonce, signTicket } from './auth.mjs';

export function fingerprint(value, pepper) { return createHash('sha256').update(`${pepper}:${value}`).digest('hex'); }
function serializeTurn(turn, qrSecret, ahead = 0) {
  if (!turn) return null;
  return {
    id: turn.id, code: turn.code, clinic: turn.clinic, priority: turn.priority,
    priorityColor: turn.priority_color, status: turn.status, room: turn.room,
    queueAhead: ahead, createdAt: turn.created_at, updatedAt: turn.updated_at,
    qrPayload: signTicket(turn.code, turn.nonce, qrSecret)
  };
}
export class MemoryRepo {
  constructor({ qrSecret, pepper }) { this.qrSecret = qrSecret; this.pepper = pepper; this.patients = new Map(); this.triages = new Map(); this.turns = new Map(); this.next = 1; this.documents = new Map(); }
  async register(data) {
    const id = randomUUID();
    const p = { id, fullName:data.fullName, clinic:data.clinic, curpHash:data.curp ? fingerprint(data.curp,this.pepper) : null, nssHash:data.nss ? fingerprint(data.nss,this.pepper) : null, phoneLast4:data.phone.slice(-4), createdAt:new Date().toISOString() };
    this.patients.set(id,p);
    if (data.document) this.documents.set(id, { name:data.document.name, mime:data.document.mime, bytes:data.document.buffer });
    return { id, fullName:p.fullName, clinic:p.clinic, documentName:data.document?.name ?? null };
  }
  async getPatient(id) {
    const p = this.patients.get(id);
    return p ? { id:p.id, fullName:p.fullName, clinic:p.clinic, documentName:this.documents.get(id)?.name ?? null } : null;
  }
  async getTriage(patientId) { return this.triages.get(patientId) ?? null; }
  async saveTriage(patientId, result) { this.triages.set(patientId,result); return result; }
  countAhead(turn) {
    return [...this.turns.values()].filter(t => t.status === 'En espera' && t.clinic === turn.clinic && t.created_at <= turn.created_at && t.id !== turn.id).length;
  }
  async issueTurn(patientId) {
    const existing = [...this.turns.values()].find(t=>t.patient_id === patientId);
    if (existing) return serializeTurn(existing,this.qrSecret,this.countAhead(existing));
    const p = this.patients.get(patientId); const triage = this.triages.get(patientId);
    if (!p || !triage) throw new Error('Completa el pre-registro y el cuestionario primero.');
    const now = new Date().toISOString();
    const turn = { id:randomUUID(), patient_id:patientId, code:`A-${String(this.next++).padStart(3,'0')}`, clinic:p.clinic, priority:triage.level, priority_color:triage.color, status:'En espera', room:null, nonce:createNonce(), created_at:now, updated_at:now };
    this.turns.set(turn.id,turn);
    return serializeTurn(turn,this.qrSecret,this.countAhead(turn));
  }
  async getTurnByPatient(patientId) {
    const t = [...this.turns.values()].find(t=>t.patient_id === patientId);
    return t ? serializeTurn(t,this.qrSecret,this.countAhead(t)) : null;
  }
  async getTurnByCode(code) {
    const t = [...this.turns.values()].find(t=>t.code === code);
    return t ? { ...serializeTurn(t,this.qrSecret,this.countAhead(t)), patientId:t.patient_id, nonce:t.nonce } : null;
  }
  async listTurns() {
    return [...this.turns.values()].map(t=>({ ...serializeTurn(t,this.qrSecret,this.countAhead(t)), fullName:this.patients.get(t.patient_id)?.fullName || '' })).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  }
  async updateTurn(id,status,room) {
    const t = this.turns.get(id); if(!t) return null;
    t.status=status; t.room=room || null; t.updated_at=new Date().toISOString();
    return { ...serializeTurn(t,this.qrSecret,this.countAhead(t)), patientId:t.patient_id };
  }
}

export class PostgresRepo {
  constructor(pool, { qrSecret, pepper }) { this.pool=pool; this.qrSecret=qrSecret; this.pepper=pepper; }
  async register(d) {
    const id = randomUUID();
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO patients (id,full_name,clinic,curp_hash,nss_hash,phone_last4) VALUES ($1,$2,$3,$4,$5,$6)',
        [id,d.fullName,d.clinic,d.curp?fingerprint(d.curp,this.pepper):null,d.nss?fingerprint(d.nss,this.pepper):null,d.phone.slice(-4)]);
      if(d.document) await client.query('INSERT INTO patient_documents (id,patient_id,file_name,mime_type,content) VALUES ($1,$2,$3,$4,$5)',
        [randomUUID(),id,d.document.name,d.document.mime,d.document.buffer]);
      await client.query('COMMIT');
      return {id,fullName:d.fullName,clinic:d.clinic,documentName:d.document?.name??null};
    } catch(e) {await client.query('ROLLBACK');throw e;}
    finally {client.release();}
  }
  async getPatient(id) {
    const r = await this.pool.query('SELECT p.id,p.full_name,p.clinic,(SELECT file_name FROM patient_documents WHERE patient_id=p.id LIMIT 1) AS document_name FROM patients p WHERE p.id=$1',[id]);
    return r.rows[0] ? { id:r.rows[0].id,fullName:r.rows[0].full_name,clinic:r.rows[0].clinic,documentName:r.rows[0].document_name } : null;
  }
  async getTriage(id) {
    const r=await this.pool.query('SELECT level, color, title, message, answers FROM triage_evaluations WHERE patient_id=$1 ORDER BY created_at DESC LIMIT 1',[id]);
    return r.rows[0] ? { ...r.rows[0], reviewed:false } : null;
  }
  async saveTriage(patientId,result) {
    await this.pool.query('INSERT INTO triage_evaluations (id,patient_id,level,color,title,message,answers) VALUES ($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),patientId,result.level,result.color,result.title,result.message,JSON.stringify(result.answers)]);
    return result;
  }
  async ahead(row) {
    const r = await this.pool.query("SELECT count(*)::int AS c FROM turns WHERE clinic=$1 AND status='En espera' AND created_at <= $2 AND id<>$3",[row.clinic,row.created_at,row.id]);
    return r.rows[0].c;
  }
  async toTurn(row) { return serializeTurn(row,this.qrSecret,await this.ahead(row)); }
  async issueTurn(patientId) {
    const existing=await this.getTurnByPatient(patientId); if(existing) return existing;
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Prevent simultaneous turn creation for the same patient.
      const patient=await client.query('SELECT clinic FROM patients WHERE id=$1 FOR UPDATE',[patientId]);
      if(!patient.rows.length) throw new Error('Paciente no encontrado.');
      const prior=await client.query('SELECT * FROM turns WHERE patient_id=$1',[patientId]);
      if(prior.rows.length) { await client.query('COMMIT'); return this.toTurn(prior.rows[0]); }
      const triage=await client.query('SELECT level,color FROM triage_evaluations WHERE patient_id=$1 ORDER BY created_at DESC LIMIT 1',[patientId]);
      if (!triage.rows.length) throw new Error('Completa el cuestionario primero.');
      const seq=await client.query("INSERT INTO ticket_sequence (id, next_number) VALUES (1, 2) ON CONFLICT (id) DO UPDATE SET next_number=ticket_sequence.next_number+1 RETURNING next_number - 1 AS number");
      const code=`A-${String(seq.rows[0].number).padStart(3,'0')}`;
      await client.query('INSERT INTO turns (id,patient_id,code,clinic,priority,priority_color,status,nonce) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),patientId,code,patient.rows[0].clinic,triage.rows[0].level,triage.rows[0].color,'En espera',createNonce()]);
      await client.query('COMMIT');
      return this.getTurnByPatient(patientId);
    } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }
  async getTurnByPatient(id) {
    const r=await this.pool.query('SELECT * FROM turns WHERE patient_id=$1 ORDER BY created_at DESC LIMIT 1',[id]);
    return r.rows[0] ? this.toTurn(r.rows[0]) : null;
  }
  async getTurnByCode(code) {
    const r=await this.pool.query('SELECT * FROM turns WHERE code=$1 ORDER BY created_at DESC LIMIT 1',[code]);
    return r.rows[0] ? { ...(await this.toTurn(r.rows[0])),patientId:r.rows[0].patient_id,nonce:r.rows[0].nonce } : null;
  }
  async listTurns() {
    const r=await this.pool.query('SELECT t.*,p.full_name FROM turns t JOIN patients p ON p.id=t.patient_id ORDER BY t.created_at');
    return Promise.all(r.rows.map(async row=>({ ...(await this.toTurn(row)),fullName:row.full_name })));
  }
  async updateTurn(id,status,room) {
    const r=await this.pool.query('UPDATE turns SET status=$2,room=$3,updated_at=now() WHERE id=$1 RETURNING *',[id,status,room || null]);
    return r.rows[0] ? { ...(await this.toTurn(r.rows[0])),patientId:r.rows[0].patient_id } : null;
  }
}
