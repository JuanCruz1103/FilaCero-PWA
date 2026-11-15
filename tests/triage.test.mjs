import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateTriage} from '../server/triage.mjs';
test('UT-TRIAGE-01: dolor torácico 140/90 produce urgencia roja',()=>{const r=evaluateTriage({chestPain:true,systolic:140,diastolic:90});assert.equal(r.level,'NIVEL_1_URGENCIA');assert.equal(r.color,'rojo');assert.equal(r.answers.systolic,140);});
test('Dificultad respiratoria marcada como urgencia',()=>{assert.equal(evaluateTriage({breathingDifficulty:true}).color,'rojo');});
test('Fiebre requiere revisión prioritaria de demostración',()=>{assert.equal(evaluateTriage({fever:true}).level,'REVISION_PRIORITARIA');});
test('Sin alertas queda pendiente de valoración',()=>{assert.equal(evaluateTriage({}).level,'PENDIENTE_VALORACION');});
test('La presión fuera de rango no se acepta',()=>{assert.throws(()=>evaluateTriage({systolic:1000}),/fuera del rango/);});
