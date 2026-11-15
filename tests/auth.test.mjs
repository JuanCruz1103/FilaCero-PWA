import test from 'node:test';
import assert from 'node:assert/strict';
import {issueSession,readSession,signTicket,checkTicket} from '../server/auth.mjs';
const secret='A'.repeat(64);
test('Sesión firmada válida y expira',()=>{const token=issueSession('paciente-1',secret,1000);assert.equal(readSession(token,secret,1001),'paciente-1');assert.equal(readSession(token,secret,9000000),null);});
test('QR firmado verificable sin datos del paciente',()=>{const payload=signTicket('A-045','abcdefgh1234',secret);assert.deepEqual(checkTicket(payload,secret),{code:'A-045',nonce:'abcdefgh1234'});assert.equal(payload.includes('nombre'),false);});
test('QR manipulado se rechaza',()=>{const payload=signTicket('A-045','abcdefgh1234',secret);assert.equal(checkTicket(payload.replace('A-045','A-046'),secret),null);});
