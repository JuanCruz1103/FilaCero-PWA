import test from 'node:test';
import assert from 'node:assert/strict';
import {qrMatrix,qrSvg} from '../web/qr.js';
test('QR versión 4 tiene 33 x 33 celdas',()=>{const matrix=qrMatrix('FC1|A-001|abcdefgh1234|1234567890123456789012');assert.equal(matrix.length,33);assert.ok(matrix.every(r=>r.length===33));});
test('Código QR SVG íntegro y sin dependencias externas',()=>{const svg=qrSvg('FC1|A-001|abcdefgh1234|1234567890123456789012');assert.match(svg,/<svg/);assert.match(svg,/viewBox="0 0 41 41"/);assert.match(svg,/<path/);});
test('QR protege su capacidad máxima',()=>{assert.throws(()=>qrMatrix('a'.repeat(79)),/demasiado largos/);});
