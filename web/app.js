import { loadOfflineTicket, saveOfflineTicket, deleteOfflineTicket } from './db.js';
import { qrSvg } from './qr.js';

const $=sel=>document.querySelector(sel);
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const ico={
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 user:'<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
 clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
 ticket:'<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M8 6v3m0 3v2m0 2v2"/><path d="m13 12 2 2 4-4"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
 heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
 arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10v.01"/>',
 clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
 wifi:'<path d="M5 12.55a11 11 0 0 1 14 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/>',
 wifiOff:'<path d="m2 2 20 20M8.5 16.1a6 6 0 0 1 7 0M5 12.55A11 11 0 0 1 9 10.5m4.5 0a11 11 0 0 1 5.5 2M1.42 9a16 16 0 0 1 3.8-2.6M9 5.1A16 16 0 0 1 22.58 9"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 9a7 7 0 0 1 12-2l2 5M4 12l2 5a7 7 0 0 0 12-2"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/>',
 phone:'<path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2"/>',
 bolt:'<path d="m13 2-3 9H5l7 11 3-9h5z"/>',
 help:'<circle cx="12" cy="12" r="10"/><path d="M9.3 9a3 3 0 0 1 5.7 1c0 2-3 2-3 4m0 3v.01"/>',
 lock:'<rect x="4" y="11" width="16" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
 medical:'<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/>',
 settings:'<path d="M4 4h16v16H4zM8 9h8M8 13h8M8 17h5"/>',
 external:'<path d="M13 3h8v8m0-8-9 9M20 13v7H4V4h7"/>',
 chevron:'<path d="m6 9 6 6 6-6"/>'
};
const icon=(name,size=19)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ico[name]||ico.info}</svg>`;
const navItems=[['inicio','Inicio','home'],['registro','Pre-registro','user'],['triaje','Cuestionario','clipboard'],['turno','Mi turno','ticket'],['ayuda','Ayuda','help']];
const state={online:navigator.onLine,patient:null,triage:null,turn:null,offlineTurn:null,loading:true,busy:false,socket:null,socketConnected:false,adminKey:'',adminTurns:null,adminVerified:null};
function route(){return location.hash.replace(/^#\/?/,'')||'inicio';}
function toast(message,type='success'){
  const area=$('#toast-region');const box=document.createElement('div');box.className='toast '+type;
  box.innerHTML=icon(type==='danger'?'info':'check',18)+'<span></span>';box.querySelector('span').textContent=message;
  area.appendChild(box);setTimeout(()=>box.remove(),5400);
}
function availableTicket(){return state.turn||(state.offlineTurn&&(!state.patient||state.offlineTurn.ownerId===state.patient.id)?state.offlineTurn:null);}
function progress(){return availableTicket()?3:state.patient?state.triage?2:1:0;}
function layout(content){
  const current=route();
  const nav=navItems.map(([id,label,ic])=>`<a class="nav-link ${current===id?'active':''}" href="#/${id}" ${current===id?'aria-current="page"':''}><span class="ico">${icon(ic)}</span>${label}${id==='turno'&&state.turn?'<span class="nav-badge"></span>':''}</a>`).join('');
  const mobile=navItems.slice(0,4).map(([id,label,ic])=>`<a class="${current===id?'active':''}" href="#/${id}" ${current===id?'aria-current="page"':''}>${icon(ic)}<span>${label}</span></a>`).join('')+`<a class="${current==='ayuda'?'active':''}" href="#/ayuda">${icon('help')}<span>Ayuda</span></a>`;
  const title={inicio:'Inicio',registro:'Pre-registro',triaje:'Cuestionario',turno:'Mi turno',ayuda:'Centro de ayuda',admin:'Panel de prueba'}[current]||'Inicio';
  return `<div class="shell"><aside class="sidebar">
    <a class="logo" href="#/inicio"><span class="logo-icon">F<small>+</small></span><span>Fila<strong>Cero</strong></span></a><div class="logo-subtitle">TU SALUD SIN FILAS</div>
    <div class="nav-caption">MENU PRINCIPAL</div><nav class="nav" aria-label="Navegación principal">${nav}</nav>
    <div class="sidebar-bottom"><div class="help-mini"><span class="mini-icon">${icon('help')}</span><strong>¿Necesitas ayuda?</strong><p>Consulta cómo obtener y mostrar tu turno digital.</p><a class="text-link" href="#/ayuda">Ver preguntas frecuentes →</a></div><div class="side-foot">FilaCero · Prototipo académico<br/>v0.4.0 · Uso demostrativo</div></div>
    </aside><div class="main-area"><header class="topbar"><div class="crumb">Plataforma del paciente <span>/</span> <strong>${title}</strong></div><div class="top-right"><span class="mode-indicator"><i class="dot ${state.online?'':'off'}"></i>${state.online?'Con conexión':'Sin conexión'}</span><span class="avatar">${state.patient?escapeHTML(state.patient.fullName.slice(0,1).toUpperCase()):icon('user',17)}</span></div></header>
    <header class="mobile-top"><a class="logo" href="#/inicio"><span class="logo-icon">F<small>+</small></span><span>Fila<strong>Cero</strong></span></a><span class="mode-indicator"><i class="dot ${state.online?'':'off'}"></i>${state.online?'En línea':'Sin conexión'}</span></header>
    ${state.online?'':'<div class="offline-banner">Sin internet · Puedes consultar tu QR guardado; los estados no se actualizan.</div>'}
    <main class="content" id="main-content">${content}</main></div><nav class="mobile-nav" aria-label="Navegación móvil">${mobile}</nav></div>`;
}
function header(eyebrow,title,subtitle){return `<div class="eyebrow">${eyebrow}</div><h1 class="page-title">${title}</h1><p class="page-subtitle">${subtitle}</p>`;}
function notice(text,type='info'){return `<div class="notice ${type}" role="note">${icon(type==='danger'?'heart':'info',19)}<span>${text}</span></div>`;}
function empty(name,title,body,cta,href){return `<div class="empty-state"><div class="empty-icon">${icon(name,29)}</div><h3>${title}</h3><p>${body}</p><a class="btn btn-primary" href="${href}">${cta} ${icon('arrow',16)}</a></div>`;}
function stepCard(num,name,title,text){return `<div class="step-card"><div class="step-top"><div class="step-icon">${icon(name,20)}</div><span class="step-number">PASO 0${num}</span></div><div><h3>${title}</h3><p>${text}</p></div></div>`;}
function qrArt(){let rect='';for(let i=0;i<121;i++){let x=i%11,y=(i/11)|0;let finder=(x<4&&y<4)||(x>6&&y<4)||(x<4&&y>6);let on=finder?((x+y)%2===0):((x*y+3*x+5*y)%7<3);rect+=`<span class="${on?'':'empty'}"></span>`;}return rect;}
function home(){
  const displayTurn=availableTicket();
  const action=displayTurn?['Ver mi turno','#/turno']:state.triage?['Obtener mi turno','#/turno']:state.patient?['Continuar cuestionario','#/triaje']:['Comenzar pre-registro','#/registro'];
  return `<section class="hero"><div class="hero-copy"><span class="hero-eyebrow">${icon('medical',15)} BIENVENIDO A FILACERO</span><h1>Menos tiempo en fila.<br/><em>Más tiempo para ti.</em></h1><p>Realiza tu registro, responde unas preguntas y obtén tu pase digital desde cualquier lugar.</p><a class="btn btn-light" href="${action[1]}">${action[0]} ${icon('arrow')}</a></div><div class="hero-art" aria-hidden="true"><div class="ticket-art"><div class="art-head">F+ FILACERO <span>↗</span></div><div class="art-code">A-045</div><div class="art-sub">PASE DIGITAL DE EJEMPLO</div><div class="art-dash"></div><div class="art-qr">${qrArt()}</div></div><div class="art-stamp">✓ Turno digital</div></div></section>
    <div class="section-row"><h2>Tu atención en 3 sencillos pasos</h2><span class="tiny">Sin filas innecesarias</span></div>
    <div class="steps">${stepCard(1,'user','Realiza tu pre-registro','Registra tus datos y adjunta tu documentación antes de acudir.')}${stepCard(2,'clipboard','Cuéntanos cómo te sientes','Responde el cuestionario inicial de síntomas de forma sencilla.')}${stepCard(3,'ticket','Recibe tu turno QR','Conserva tu pase digital y sigue las actualizaciones de tu turno.')}</div>
    <div class="two-columns"><div class="card"><div class="card-top"><h3>Tu avance en FilaCero</h3><a class="small-link" href="${action[1]}">Continuar ${icon('arrow',12)}</a></div>
      <div class="mini-flow"><div class="icon-round">${icon(progress()>=3?'ticket':progress()>=2?'clipboard':'user')}</div><div><strong>${displayTurn?'¡Tu turno está listo!':state.triage?'Cuestionario completado':state.patient?'Registro completado':'Empezar es muy fácil'}</strong><span>${displayTurn?`Turno ${escapeHTML(displayTurn.code)} · ${escapeHTML(displayTurn.status)}`:`${progress()} de 3 pasos completados`}</span></div></div></div>
      <div class="card"><div class="card-top"><h3>Siempre contigo</h3><span style="color:#0f887d">${icon('wifi',20)}</span></div><p>Tu código QR estará disponible sin conexión una vez que lo hayas generado y guardado en este dispositivo.</p><a href="#/ayuda" class="small-link">¿Cómo funciona? ${icon('arrow',12)}</a></div></div>
    <div style="margin-top:18px">${notice('Este es un prototipo educativo. Utiliza solamente información ficticia; el triaje no es una valoración médica y debe validarse con la clínica.','warning')}</div>`;
}
function registration(){
  if(state.turn)return `${header('PASO 01','Pre-registro completo','Tu información inicial ya fue enviada.')}<div style="margin-top:24px">${empty('check','Ya tienes un turno asignado','Puedes consultar tu código QR y el estado actual de tu turno.','Ver mi turno','#/turno')}</div>`;
  if(state.patient)return `${header('PASO 01','¡Registro completado!','Ahora puedes continuar con el cuestionario inicial.')}<div class="form-layout"><div>${empty('check',`Bienvenido, ${escapeHTML(state.patient.fullName.split(' ')[0])}`,`Tu pre-registro en ${escapeHTML(state.patient.clinic)} está completo. Ya puedes responder las preguntas iniciales.`, 'Continuar al triaje','#/triaje')}</div><div class="context-side"><div class="side-footnote"><h3>Tu información está protegida</h3><p>Los identificadores no se guardan en el almacenamiento offline del dispositivo.</p></div></div></div>`;
  return `${header('PASO 01 · PRE-REGISTRO','Comencemos con tus datos','Completa el siguiente formulario para registrar tu información antes de acudir a la clínica.')}
    <div class="form-layout"><div class="form-panel"><h2 class="panel-title">Información del paciente</h2><p class="panel-subtitle">Los campos marcados con * son obligatorios. Usa datos ficticios en esta demostración.</p>
      <form id="register-form"><div class="field-grid"><div class="field full"><label for="fullName">Nombre completo *</label><input id="fullName" name="fullName" placeholder="Nombre y apellidos" required minlength="5" autocomplete="name" maxlength="110"/></div>
      <div class="field"><label for="curp">CURP</label><input id="curp" name="curp" maxlength="18" autocomplete="off" placeholder="18 caracteres" style="text-transform:uppercase"/><small>Al menos CURP o NSS es obligatorio.</small></div>
      <div class="field"><label for="nss">Número de Seguridad Social</label><input id="nss" name="nss" maxlength="11" inputmode="numeric" placeholder="11 dígitos"/><small>Se valida el formato.</small></div>
      <div class="field"><label for="phone">Teléfono (opcional)</label><input id="phone" name="phone" maxlength="10" inputmode="tel" placeholder="10 dígitos" autocomplete="tel"/></div>
      <div class="field"><label for="clinic">Unidad médica *</label><select id="clinic" name="clinic" required><option value="">Selecciona una opción</option><option>Clínica Centro</option><option>Unidad Norte</option><option>Unidad Sur</option></select></div>
      <div class="field full"><label for="document">Documento de identidad (opcional)</label><div class="file-box"><input type="file" id="document" name="document" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"/><span>PDF, JPG o PNG, máximo 1 MB.</span></div></div></div>
      <div class="divider"></div>${notice('Por seguridad, no ingreses CURP, NSS o documentos reales aquí. El uso clínico requiere políticas de privacidad y autorización institucional.','warning')}
      <div class="form-footer"><button type="submit" class="btn btn-primary" ${!state.online?'disabled':''}>Continuar al cuestionario ${icon('arrow')}</button></div></form></div>
    <aside class="context-side"><div class="side-card"><h3>¿Qué necesitas?</h3><div class="bullet"><span class="bullet-icon">${icon('check',14)}</span><p>Tu nombre y al menos un identificador válido.</p></div><div class="bullet"><span class="bullet-icon">${icon('check',14)}</span><p>Seleccionar la clínica donde deseas atención.</p></div><div class="bullet"><span class="bullet-icon">${icon('check',14)}</span><p>Documento opcional para el pre-registro.</p></div></div><div class="side-footnote"><h3>¿Por qué hacerlo antes?</h3><p>El pre-registro ayuda a reducir trámites en ventanilla. La validación final depende del personal autorizado.</p></div></aside></div>`;
}
const questions=[
  ['chestPain','¿Sientes dolor fuerte o agudo en el pecho?'],
  ['breathingDifficulty','¿Tienes dificultad para respirar?'],
  ['unconscious','¿Has perdido el conocimiento o has sufrido un desmayo grave?'],
  ['fever','¿Has tenido fiebre recientemente?'],
  ['severePain','¿Presentas dolor intenso en alguna parte del cuerpo?'],
  ['dizziness','¿Sientes mareo o debilidad persistente?']
];
function question([key,title],i){
  const value=state.triage?.answers?.[key];
  return `<fieldset class="question-group"><legend>${i+1}. ${title}</legend><div class="question-options"><label class="radio-choice"><input type="radio" name="${key}" value="true" required ${value===true?'checked':''}/><span>Sí</span></label><label class="radio-choice"><input type="radio" name="${key}" value="false" ${value===false?'checked':''}/><span>No</span></label></div></fieldset>`;
}
function triage(){
  if(!state.patient)return `${header('PASO 02','Cuestionario inicial','Primero debes completar el pre-registro.')}<div style="margin-top:25px">${empty('user','Necesitamos tus datos','Regístrate para continuar con el cuestionario de síntomas.','Hacer pre-registro','#/registro')}</div>`;
  if(state.turn)return `${header('PASO 02','Cuestionario completado','La información inicial ya quedó asociada a tu turno.')}<div style="margin-top:25px">${empty('check','Evaluación registrada',`Nivel asignado para la demostración: ${escapeHTML(state.triage?.level||'pendiente')}.`,'Ver mi turno','#/turno')}</div>`;
  return `${header('PASO 02 · CUESTIONARIO','¿Cómo te sientes hoy?','Estas preguntas ayudan a registrar tus síntomas para una valoración inicial por el personal autorizado.')}
    <div class="form-layout"><div class="form-panel"><div class="progress-top"><span class="progress-label">Paso 2 de 3</span><span class="progress-line"><span class="progress-fill" style="display:block;width:66%"></span></span></div>
    ${notice('Este cuestionario NO diagnostica ni sustituye una consulta médica. Si tienes dolor torácico, dificultad respiratoria o pérdida de conciencia, solicita atención de urgencias de inmediato.','danger')}
    <form id="triage-form" style="margin-top:25px"><h2 class="panel-title">Evaluación inicial de síntomas</h2><p class="panel-subtitle">Responde todas las preguntas de la manera más precisa posible.</p>
    <div class="question-stack">${questions.map(question).join('')}</div><div class="field-grid"><div class="field"><label for="systolic">Presión sistólica (opcional)</label><input id="systolic" name="systolic" type="number" inputmode="numeric" min="40" max="260" placeholder="Ej. 120" value="${escapeHTML(state.triage?.answers?.systolic??'')}"/></div>
    <div class="field"><label for="diastolic">Presión diastólica (opcional)</label><input id="diastolic" name="diastolic" type="number" inputmode="numeric" min="40" max="260" placeholder="Ej. 80" value="${escapeHTML(state.triage?.answers?.diastolic??'')}"/></div>
    <div class="field full"><label for="description">Otros síntomas (opcional)</label><textarea id="description" name="description" maxlength="400" placeholder="Describe brevemente cómo te sientes...">${escapeHTML(state.triage?.answers?.description||'')}</textarea></div></div>
    <div class="form-footer"><a href="#/registro" class="btn btn-outline">Regresar</a><button type="submit" class="btn btn-primary" ${!state.online?'disabled':''}>Evaluar respuestas ${icon('arrow')}</button></div></form>
    ${state.triage?`<div class="divider"></div><div class="result-box ${escapeHTML(state.triage.color)}"><span class="priority">${escapeHTML(state.triage.level.replaceAll('_',' '))}</span><strong>${escapeHTML(state.triage.title)}</strong><p>${escapeHTML(state.triage.message)}</p><a class="btn btn-primary" href="#/turno">Continuar al turno ${icon('arrow')}</a></div>`:''}
    </div><aside class="context-side"><div class="side-card"><h3>Antes de responder</h3><div class="bullet"><span class="bullet-icon">1</span><p>Lee cada pregunta con calma.</p></div><div class="bullet"><span class="bullet-icon">2</span><p>Selecciona Sí o No según tus síntomas.</p></div><div class="bullet"><span class="bullet-icon">3</span><p>Tu prioridad definitiva debe revisarla el personal clínico.</p></div></div><div class="side-footnote"><h3>Tu salud es primero</h3><p>En una urgencia, no esperes por un número de turno. Busca atención inmediata.</p></div></aside></div>`;
}
function statusColor(turn){return turn?.priorityColor==='rojo'?'rojo':turn?.status==='Llamado a consultorio'?'ambar':turn?.priorityColor==='ambar'?'ambar':'';}
function ticket(){
  const t=availableTicket();
  if(!t){const target=state.triage?'#/turno':state.patient?'#/triaje':'#/registro';return `${header('PASO 03','Tu turno virtual','La ficha QR aparecerá aquí una vez que completes el proceso.')}<div style="margin-top:25px">${empty('ticket',state.triage?'¡Ya casi terminamos!':'Aún no tienes un turno',state.triage?'Tu cuestionario está listo. Presiona el botón para emitir tu turno digital.':'Completa los pasos previos para recibir tu pase digital.',state.triage?'Generar turno digital':state.patient?'Ir al cuestionario':'Empezar pre-registro',target)}</div>${state.triage?`<div style="max-width:420px;margin:20px auto"><button class="btn btn-primary btn-wide" data-action="issue-ticket" ${!state.online?'disabled':''}>Generar mi turno QR ${icon('arrow')}</button></div>`:''}`;}
  const offline=!state.online || (!state.turn && !!state.offlineTurn);
  const svg=t.qrSvg||qrSvg(t.qrPayload);
  return `${header('TU PASE DIGITAL','Este es tu turno','Muestra este código QR al personal autorizado cuando te lo soliciten. Puedes volver a consultarlo desde este dispositivo.')}
    ${t.priorityColor==='rojo'?`<div style="margin-top:22px">${notice('Síntomas de posible urgencia: no esperes el turno digital. Solicita atención inmediata. La clasificación de prueba no sustituye el triaje clínico.','danger')}</div>`:''}
    <div class="ticket-layout"><div class="ticket-pass"><div class="pass-top"><div class="pass-logo"><span>F+</span> FILACERO</div><div class="pass-desc">TU NÚMERO DE TURNO</div><div class="pass-number">${escapeHTML(t.code)}</div><div class="pill ${statusColor(t)}">${icon('clock',13)} ${escapeHTML(t.status)}</div></div><div class="pass-divider"></div><div class="pass-qr" id="ticket-svg">${svg}</div><div class="pass-bottom"><p>Presenta este código en recepción.<br/>No lo compartas con otras personas.</p></div><div class="pass-bar">${icon('shield',14)}&nbsp; QR verificable emitido por el servidor</div></div>
    <div class="context-side"><div class="card"><div class="card-top"><h3>Estado de tu atención</h3><span class="pill ${offline?'muted':''}"><i class="dot ${offline?'off':''}"></i>${offline?'Guardado offline':state.socketConnected?'En vivo':'Última consulta'}</span></div>
      <div class="status-row"><div><span class="status-label">Estado actual</span><div class="status-value">${escapeHTML(t.status)}</div></div><div class="step-icon">${icon(t.status==='Llamado a consultorio'?'bell':'clock',19)}</div></div>
      <div class="ticket-meta"><div><span>Unidad médica</span><strong>${escapeHTML(t.clinic)}</strong></div><div><span>Consultorio</span><strong>${escapeHTML(t.room||'Por asignar')}</strong></div><div><span>Turnos anteriores*</span><strong>${offline?'Sin actualización':escapeHTML(String(t.queueAhead??'—'))}</strong></div><div><span>Fecha de emisión</span><strong>${escapeHTML(new Date(t.createdAt).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}))}</strong></div></div>
      ${offline?notice('Mostrando el QR y el último estado guardado. Necesitas internet para recibir cambios de la fila.','warning'):notice('Las novedades de tu turno se reciben automáticamente cuando la conexión WebSocket está disponible.','info')}
      <div class="status-actions" style="margin-top:19px"><button class="btn btn-primary" data-action="refresh-ticket" ${offline?'disabled':''}>${icon('refresh')} Actualizar</button><button class="btn btn-outline" data-action="download-qr">${icon('download')} Guardar QR</button></div>
      <p style="margin:18px 0 0;font-size:11px">* Cálculo orientativo basado en turnos anteriores en espera de esta unidad. No es un tiempo estimado.</p></div>
      <div class="side-footnote"><h3>Recuerda</h3><p>Conserva esta pantalla y acude a la unidad médica indicada. El QR sigue disponible sin internet siempre que la PWA y el pase se hayan guardado previamente.</p></div></div></div>`;
}
function help(){return `${header('CENTRO DE AYUDA','Estamos para orientarte','Respuestas breves a las preguntas más frecuentes sobre FilaCero.')}
  <div class="service-list"><div class="service-row"><span class="step-icon">${icon('phone')}</span><div><strong>¿Necesito instalar la aplicación?</strong><p>No. FilaCero funciona directamente en el navegador. En dispositivos compatibles puedes elegir “Agregar a la pantalla de inicio” para instalarla como PWA.</p></div></div>
    <div class="service-row"><span class="step-icon">${icon('wifiOff')}</span><div><strong>¿Puedo mostrar mi QR sin internet?</strong><p>Sí. Primero debes generar el QR mientras estés conectado y abrir la PWA para que el Service Worker conserve los recursos. IndexedDB guarda el pase en este dispositivo. El registro, los nuevos turnos y las actualizaciones requieren internet.</p></div></div>
    <div class="service-row"><span class="step-icon">${icon('bell')}</span><div><strong>¿Cómo sabré cuando sea mi turno?</strong><p>Con internet, FilaCero escucha cambios del servidor mediante WebSockets. Puede mostrar una alerta y vibrar cuando tu turno sea llamado, según soporte y permisos del dispositivo.</p></div></div>
    <div class="service-row"><span class="step-icon">${icon('heart')}</span><div><strong>¿El cuestionario diagnostica enfermedades?</strong><p>No. Las reglas del prototipo aún no están aprobadas clínicamente. Ante una urgencia, busca atención médica inmediata sin esperar el pase digital.</p></div></div>
    <div class="service-row"><span class="step-icon">${icon('lock')}</span><div><strong>¿Se pueden usar datos reales?</strong><p>No en esta demostración. Para desplegarlo en una clínica se deben aprobar la protección, conservación y control de acceso a los datos de pacientes, entre otros requisitos.</p></div></div></div>
    <div style="margin-top:20px">${notice('Para comprobar el escenario de integración con un panel externo puedes abrir el <a href="#/admin" style="text-decoration:underline;font-weight:800">panel técnico de pruebas</a>. No forma parte del alcance móvil final.','info')}</div>`;}
function admin(){
  let list='';
  if(state.adminTurns){list=state.adminTurns.length?`<div class="admin-table card" style="padding:0"><table><thead><tr><th>Folio</th><th>Paciente ficticio</th><th>Clínica</th><th>Prioridad demo</th><th>Estado</th><th>Actualizar</th></tr></thead><tbody>${state.adminTurns.map(t=>`<tr><td><strong>${escapeHTML(t.code)}</strong></td><td>${escapeHTML(t.fullName)}</td><td>${escapeHTML(t.clinic)}</td><td><span class="pill ${escapeHTML(t.priorityColor)}">${escapeHTML(t.priority)}</span></td><td>${escapeHTML(t.status)}</td><td><form data-action="admin-update" data-id="${escapeHTML(t.id)}" class="admin-update"><select class="admin-control" name="status">${['En espera','Llamado a consultorio','En atención','Atendido'].map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join('')}</select><input class="admin-control" name="room" placeholder="Consultorio 3" value="${escapeHTML(t.room||'')}"/><button type="submit" class="btn btn-primary">Guardar</button></form></td></tr>`).join('')}</tbody></table></div>`:empty('ticket','Aún no hay turnos','Genera un turno desde la vista del paciente para simular cambios.','Inicio','#/inicio');}
  return `${header('PANEL TÉCNICO · EXTERNO AL ALCANCE','Simulador de recepción','Esta consola sirve únicamente para demostrar la integración REST, WebSocket y verificación de códigos QR del proyecto.')}
    <div style="margin:22px 0">${notice('Simulación de uso académico. No es un panel clínico de producción. Para producción se requieren autenticación por roles, auditoría, revisión de seguridad y validación institucional.','warning')}</div>
    <div class="card"><h3>Acceso del personal de pruebas</h3><p>Introduce la clave ADMIN_DEMO_KEY configurada en el servidor. En modo demostración, el valor predeterminado es <code>demo-fila-2026</code>.</p><form id="admin-login" style="display:flex;gap:10px;max-width:540px;flex-wrap:wrap"><input class="admin-control" name="key" type="password" style="flex:1;min-width:200px" placeholder="Clave de prueba" required autocomplete="off"/><button type="submit" class="btn btn-primary">Abrir consola</button></form></div>
    ${state.adminKey?`<div class="admin-toolbar"><h2 style="font-size:17px">Turnos emitidos (${state.adminTurns?.length??'…'})</h2><button class="btn btn-outline" data-action="refresh-admin">${icon('refresh')} Actualizar lista</button></div>${list}
    <div class="card" style="margin-top:18px"><h3>Verificar código QR firmado</h3><p>Pega el texto leído por un escáner de QR para comprobar su firma y encontrar el turno.</p><form id="verify-form" style="display:flex;gap:10px;flex-wrap:wrap"><input class="admin-control" name="qrPayload" placeholder="FC1|A-001|..." style="flex:1;min-width:210px" required/><button class="btn btn-primary" type="submit">Validar QR</button></form>${state.adminVerified?`<p class="pill" style="margin-top:14px">✓ QR verificado · ${escapeHTML(state.adminVerified.code)} · ${escapeHTML(state.adminVerified.status)}</p>`:''}</div>`:''}`;
}
function render(){
  const page=route();const view={inicio:home,registro:registration,triaje:triage,turno:ticket,ayuda:help,admin:admin}[page]||home;
  $('#app').innerHTML=layout(view());
  document.title=`${{inicio:'Inicio',registro:'Pre-registro',triaje:'Cuestionario',turno:'Mi turno',ayuda:'Ayuda',admin:'Consola'}[page]||'Inicio'} · FilaCero`;
}
async function api(url,options={}){
  const res=await fetch(url,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  let body;try{body=await res.json();}catch{body={};}
  if(!res.ok){const e=new Error(body.error||`Error HTTP ${res.status}`);e.fields=body.fields;throw e;}return body;
}
async function persistTicket(turn){
  if(!turn||!turn.qrPayload)return;
  try{const stored={...turn,ownerId:state.patient?.id||null,qrSvg:qrSvg(turn.qrPayload)};await saveOfflineTicket(stored);state.offlineTurn=stored;}
  catch(e){console.warn('No fue posible guardar el pase offline:',e);toast('Tu navegador no permitió almacenar el QR offline.','danger');}
}
async function refreshMe(){
  if(!navigator.onLine)return;
  const data=await api('/api/me');state.patient=data.patient;state.triage=data.triage;
  state.turn=data.turn||null;
  if(state.turn)await persistTicket(state.turn);
  connectSocket();render();
}
function connectSocket(){
  if(!state.turn||!state.patient||!state.online)return;
  if(state.socket&&(state.socket.readyState===WebSocket.CONNECTING||state.socket.readyState===WebSocket.OPEN))return;
  const proto=location.protocol==='https:'?'wss:':'ws:';
  try{
    const ws=new WebSocket(`${proto}//${location.host}/ws/queues`);state.socket=ws;
    ws.onopen=()=>{state.socketConnected=true;render();};
    ws.onmessage=async event=>{
      let message;try{message=JSON.parse(event.data);}catch{return;}
      if(message.type==='queue.updated'&&message.turn&&state.turn?.id===message.turn.id){
        const old=state.turn.status;
        state.turn={...state.turn,...message.turn};await persistTicket(state.turn);
        if(old!==state.turn.status){toast(`Tu turno ${state.turn.code}: ${state.turn.status}${state.turn.room?' · '+state.turn.room:''}`,'success');if(navigator.vibrate&&state.turn.status==='Llamado a consultorio')navigator.vibrate([180,90,180]);}
        render();
      }
    };
    ws.onclose=()=>{state.socketConnected=false;if(state.socket===ws)state.socket=null;render();if(state.online)setTimeout(()=>{if(state.turn)connectSocket();},3500);};
    ws.onerror=()=>{ws.close();};
  }catch(e){console.warn('WebSocket no disponible:',e);}
}
async function registerSubmit(form){
  const data=Object.fromEntries(new FormData(form).entries());
  const file=data.document;delete data.document;
  if(!data.curp&&!data.nss){toast('Agrega CURP o NSS para continuar.','danger');return;}
  if(file&&file.size){
    if(file.size>1_048_576){toast('El archivo excede 1 MB.','danger');return;}
    const buffer=new Uint8Array(await file.arrayBuffer());let encoded='';
    for(let i=0;i<buffer.length;i+=32768)encoded+=String.fromCharCode(...buffer.subarray(i,i+32768));
    data.document={name:file.name,mime:file.type,dataBase64:btoa(encoded)};
  }
  const result=await api('/api/register',{method:'POST',body:JSON.stringify(data)});
  state.patient=result.patient;state.triage=null;state.turn=null;state.offlineTurn=null;try{await deleteOfflineTicket();}catch{}toast('¡Pre-registro completado!');location.hash='#/triaje';render();
}
async function triageSubmit(form){
  const values=new FormData(form);
  const answers=Object.fromEntries(questions.map(([key])=>[key,values.get(key)==='true']));
  answers.systolic=values.get('systolic')||null;answers.diastolic=values.get('diastolic')||null;answers.description=values.get('description')||'';
  const data=await api('/api/triage',{method:'POST',body:JSON.stringify(answers)});
  state.triage=data.triage;render();
  toast(data.triage.color==='rojo'?'Aviso de urgencia: busca atención inmediata.':'Cuestionario registrado.',data.triage.color==='rojo'?'danger':'success');
  $('#main-content')?.scrollIntoView({behavior:'smooth'});
}
async function issueTurn(){
  const data=await api('/api/turns',{method:'POST',body:'{}'});state.turn=data.turn;
  await persistTicket(state.turn);toast('Tu turno QR se generó correctamente.');connectSocket();render();
}
async function refreshTicket(){
  const {turn}=await api('/api/turns/mine');if(turn){state.turn=turn;await persistTicket(turn);render();toast('Información actualizada.');}
}
function downloadQr(){
  const t=availableTicket();if(!t)return;
  const svg=t.qrSvg||qrSvg(t.qrPayload);const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  const a=document.createElement('a');a.href=url;a.download=`FilaCero-${t.code}.svg`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
async function loadAdmin(){const result=await api('/api/admin/turns',{headers:{'X-Admin-Key':state.adminKey}});state.adminTurns=result.turns;render();}
async function updateAdmin(form){const fd=new FormData(form);const data=await api(`/api/admin/turns/${form.dataset.id}`,{method:'PATCH',headers:{'X-Admin-Key':state.adminKey},body:JSON.stringify({status:fd.get('status'),room:fd.get('room')})});toast(`${data.turn.code}: ${data.turn.status}`);await loadAdmin();}
async function verifyQr(form){const qrPayload=new FormData(form).get('qrPayload');const result=await api('/api/admin/verify-qr',{method:'POST',headers:{'X-Admin-Key':state.adminKey},body:JSON.stringify({qrPayload})});state.adminVerified=result.turn;render();toast('Código QR verificado correctamente.');}
async function runButton(button){
  if(state.busy)return;state.busy=true;button.disabled=true;
  try{
    switch(button.dataset.action){case 'issue-ticket':await issueTurn();break;case 'refresh-ticket':await refreshTicket();break;case 'download-qr':downloadQr();break;case 'refresh-admin':await loadAdmin();break;}
  }catch(e){toast(e.message,'danger');}finally{state.busy=false;button.disabled=false;}
}
document.addEventListener('click',event=>{const b=event.target.closest('button[data-action]');if(b)runButton(b);});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.matches('#register-form,#triage-form,#admin-login,#verify-form,form[data-action="admin-update"]'))return;
  event.preventDefault();if(state.busy)return;
  const submit=form.querySelector('[type="submit"]');state.busy=true;if(submit)submit.disabled=true;
  try{
    if(form.id==='register-form')await registerSubmit(form);
    if(form.id==='triage-form')await triageSubmit(form);
    if(form.id==='admin-login'){state.adminKey=new FormData(form).get('key');await loadAdmin();toast('Consola de prueba habilitada.');}
    if(form.id==='verify-form')await verifyQr(form);
    if(form.dataset.action==='admin-update')await updateAdmin(form);
  }catch(e){toast(e.message,'danger');if(e.fields){const first=Object.keys(e.fields)[0];form.querySelector(`[name="${first}"]`)?.focus();}}
  finally{state.busy=false;if(submit)submit.disabled=false;}
});
window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0,behavior:'instant'});});
window.addEventListener('offline',()=>{state.online=false;state.socket?.close();render();toast('No hay conexión. El pase QR guardado sigue disponible.','danger');});
window.addEventListener('online',async()=>{state.online=true;render();try{await refreshMe();toast('Conexión restablecida.');}catch{toast('No se pudo sincronizar con el servidor.','danger');}});
(async function init(){
  try{state.offlineTurn=await loadOfflineTicket();}catch(e){console.warn('IndexedDB:',e);}
  state.loading=false;render();
  if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('/sw.js',{scope:'/'});}catch(e){console.warn('Service Worker:',e);}}
  if(state.online){try{await refreshMe();}catch(e){console.warn('Servidor no disponible:',e);}}
})();
