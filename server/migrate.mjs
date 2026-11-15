import fs from 'node:fs/promises';
try { const raw=await fs.readFile(new URL('../.env',import.meta.url),'utf8'); for(const line of raw.split(/\r?\n/)){const m=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());if(m && !(m[1] in process.env))process.env[m[1]]=m[2].replace(/^[\"']|[\"']$/g,'');} } catch {}
const url=process.env.DATABASE_URL;
if (!url) { console.error('Falta DATABASE_URL.'); process.exit(1); }
const { Pool }=await import('pg');
const pool=new Pool({connectionString:url});
try { await pool.query(await fs.readFile(new URL('../db/schema.sql', import.meta.url),'utf8')); console.log('Esquema actualizado.'); }
finally { await pool.end(); }
