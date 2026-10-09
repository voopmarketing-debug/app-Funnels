import { createHash } from "node:crypto";
import { AGENDA_QUESTIONS } from "@/lib/agencyAgenda";

// Funnels Labs' own booking page, served at agenda.funnelslabs.app/agenda
// (a routing rule on that Vercel project rewrites the path here, so it runs
// on the same origin as /diagnostico and /calculadora and shares their
// localStorage lead). Bookings still go to the same Google Apps Script as
// before, with the same row: that script is what checks the slot is free,
// emails Funnels Labs and the visitor, and creates the calendar event.
// The answers to the qualifying questions also land in the agency's CRM
// (app/api/agenda-llamada).

// Google Apps Script web app behind the booking calendar (GET ?fecha= →
// horasOcupadas, POST the lead row). Public by design: it's in the page.
export const AGENDA_SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbwn1MgIjP462KMbvJr3vJGQ8aKq7ZVBV48ai5AgPvh6A9r_h7occDh4dtm5Bavko_I/exec";
const AGENDA_WHATSAPP = "573138299658";

const STYLE = `
:root{--bg:#0a0a0a;--surface:#131313;--surface-2:#1a1a1a;--border:#262626;--border-strong:#383838;--text:#f4f4f0;--muted:#a3a39e;--faint:#6e6e69;--accent:#b5ff2b;--accent-soft:rgba(181,255,43,.1);--accent-ink:#0a0a0a;--danger:#ff7a6b}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font-family:Montserrat,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
button,input,select{font:inherit;color:inherit}
.wrap{max-width:560px;margin:0 auto;padding:20px 20px 56px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:36px}
.brand{display:flex;align-items:center;gap:8px;font-weight:800;letter-spacing:.06em;font-size:14px}
.brand i{width:9px;height:9px;border-radius:50%;background:var(--accent);display:inline-block}
.brand b{color:var(--accent);font-weight:800}
.count{font-size:12px;color:var(--faint);font-weight:600;letter-spacing:.04em}
.bar{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:14px 0 26px}
.bar span{height:4px;border-radius:4px;background:var(--border);transition:background .25s}
.bar span.on{background:var(--accent)}
.back{background:none;border:0;padding:6px 0;margin:0 0 10px;color:var(--muted);font-size:14px;cursor:pointer}
.back:hover{color:var(--text)}
.back[hidden]{display:none}
.eyebrow{color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin:0 0 10px}
h1{font-size:clamp(26px,6.4vw,34px);line-height:1.15;font-weight:800;margin:0 0 10px;text-wrap:balance}
h2{font-size:clamp(21px,5.2vw,26px);line-height:1.25;font-weight:800;margin:0 0 6px;text-wrap:balance}
.lead{color:var(--muted);margin:0 0 18px}
.hint{color:var(--muted);font-size:14px;margin:0 0 18px}
.perks{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 26px;padding:0;list-style:none}
.perks li{font-size:13px;color:var(--muted);border:1px solid var(--border);border-radius:999px;padding:5px 11px}
.screen{animation:in .22s ease-out}
@keyframes in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.opts{display:grid;gap:10px}
.opt{display:flex;align-items:center;gap:14px;width:100%;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;cursor:pointer;transition:border-color .15s,background .15s,transform .1s}
.opt:hover{border-color:var(--border-strong)}
.opt:active{transform:scale(.99)}
.opt.sel{border-color:var(--accent);background:var(--accent-soft)}
.opt .em{font-size:22px;width:28px;text-align:center;flex:none}
.opt .lb{flex:1;font-weight:600}
.opt .chev{color:var(--faint);flex:none}
.opt.sel .chev{color:var(--accent)}
.section-label{font-size:13px;font-weight:700;color:var(--muted);margin:22px 0 10px;display:flex;justify-content:space-between;gap:8px}
.section-label span{font-weight:500;color:var(--faint)}
.days{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:20px;padding-bottom:6px;margin:0 -20px;padding-inline:20px;scrollbar-width:none}
.days::-webkit-scrollbar{display:none}
.day{flex:none;width:76px;scroll-snap-align:start;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:10px 6px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s}
.day:hover{border-color:var(--border-strong)}
.day.sel{border-color:var(--accent);background:var(--accent-soft)}
.day .dw{display:block;font-size:11px;font-weight:700;letter-spacing:.08em;color:var(--muted);text-transform:uppercase}
.day .dn{display:block;font-size:24px;font-weight:800;line-height:1.2;font-variant-numeric:tabular-nums}
.day .dm{display:block;font-size:12px;color:var(--faint)}
.day.sel .dw,.day.sel .dm{color:var(--accent)}
.times{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
@media (min-width:480px){.times{grid-template-columns:repeat(4,1fr)}}
.time{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:13px 4px;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums;cursor:pointer;transition:border-color .15s,background .15s}
.time:hover:not(:disabled){border-color:var(--border-strong)}
.time.sel{border-color:var(--accent);background:var(--accent);color:var(--accent-ink)}
.time:disabled{color:var(--faint);text-decoration:line-through;cursor:not-allowed;opacity:.55}
.skel{height:48px;border-radius:12px;background:linear-gradient(90deg,var(--surface) 25%,var(--surface-2) 50%,var(--surface) 75%);background-size:200% 100%;animation:sh 1.2s infinite}
@keyframes sh{to{background-position:-200% 0}}
.note{font-size:13px;color:var(--faint);margin:10px 0 0}
.err{color:var(--danger);font-size:14px;font-weight:600;margin:14px 0 0}
.cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:54px;margin-top:24px;border:0;border-radius:14px;background:var(--accent);color:var(--accent-ink);font-weight:800;font-size:16px;cursor:pointer;text-decoration:none;transition:filter .15s,opacity .15s}
.cta:hover{filter:brightness(1.06)}
.cta:disabled{opacity:.35;cursor:not-allowed;filter:none}
.ghost{display:block;width:100%;margin-top:12px;background:none;border:0;color:var(--muted);font-size:14px;text-decoration:underline;cursor:pointer}
.slot{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:12px 14px;margin:0 0 20px}
.slot .ic{width:38px;height:38px;flex:none;border-radius:10px;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;font-size:18px}
.slot .tx{flex:1;min-width:0}
.slot .tx b{display:block;font-size:15px}
.slot .tx span{font-size:13px;color:var(--muted)}
.slot button{background:none;border:0;color:var(--accent);font-weight:700;font-size:14px;cursor:pointer;padding:6px}
.field{display:block;margin:0 0 14px}
.field>span{display:block;font-size:13px;font-weight:600;color:var(--muted);margin:0 0 6px}
.input{width:100%;height:52px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0 14px;outline:none;transition:border-color .15s}
.input:focus{border-color:var(--accent)}
.input::placeholder{color:var(--faint)}
.field>.phone{display:flex;gap:8px;margin:0}
.phone select{flex:none;width:104px;height:52px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:0 8px;outline:none}
.phone select:focus{border-color:var(--accent)}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.done{text-align:center}
.check{width:72px;height:72px;margin:8px auto 18px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:800}
.done .slot{text-align:left;margin-top:22px}
.small{font-size:13px;color:var(--faint);margin-top:16px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

// Browser side. Kept as plain JS (no build step): it reads/writes the same
// localStorage lead as the diagnostico and calculadora pages, so a visitor
// coming from them books with their results attached.
const SCRIPT = `(function(){
var C=window.__AGENDA__,Q=C.questions,LEAD_KEY="sail_lead",QUEUE_KEY="sail_sheets_queue";
var DAYS=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"],DAYS_SHORT=["dom","lun","mar","mié","jue","vie","sáb"];
var MONTHS=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
var HOURS=["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"];
var COUNTRIES=[["+57","🇨🇴 +57"],["+52","🇲🇽 +52"],["+51","🇵🇪 +51"],["+56","🇨🇱 +56"],["+593","🇪🇨 +593"],["+54","🇦🇷 +54"],["+507","🇵🇦 +507"],["+506","🇨🇷 +506"],["+58","🇻🇪 +58"],["+591","🇧🇴 +591"],["+595","🇵🇾 +595"],["+598","🇺🇾 +598"],["+502","🇬🇹 +502"],["+503","🇸🇻 +503"],["+504","🇭🇳 +504"],["+1","🇺🇸 +1"],["+34","🇪🇸 +34"]];
function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k)||"null");localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}}
function uuid(){return crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c=="x"?r:r&3|8).toString(16)})}
function setLeadParam(id){try{var u=new URL(location.href);u.searchParams.set("lead",id);history.replaceState({},"",u.toString())}catch(e){}}
// Same rules as the diagnostico/calculadora pages: keep the lead they came with.
function loadLead(){var p=new URLSearchParams(location.search).get("lead"),s=store(LEAD_KEY),now=new Date().toISOString(),l;
 if(s&&p&&p===s.id)l=s;else if(s&&!p){l=Object.assign({},s);delete l.cita}else l={id:p||uuid(),createdAt:now,updatedAt:now};
 store(LEAD_KEY,l);setLeadParam(l.id);return l}
var lead=loadLead();
var st={step:0,answers:{},fecha:"",hora:"",taken:{},busy:false,error:"",nombre:(lead.contacto&&lead.contacto.nombre)||"",cc:"+57",tel:"",correo:(lead.contacto&&lead.contacto.correo)||""};
var app=document.getElementById("app");
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function ymd(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function sameDay(a,b){return a.toDateString()===b.toDateString()}
function days(n){var out=[],d=new Date(),today=new Date(),tom=new Date();tom.setDate(tom.getDate()+1);
 while(out.length<n){if(d.getDay()!==0){var first=out.length===0&&sameDay(d,today);
  out.push({value:ymd(d),short:sameDay(d,today)?"hoy":sameDay(d,tom)?"mañana":DAYS_SHORT[d.getDay()],num:d.getDate(),mon:MONTHS[d.getMonth()].slice(0,3),
   label:(first?"Hoy · ":sameDay(d,tom)?"Mañana · ":"")+DAYS[d.getDay()]+", "+d.getDate()+" de "+MONTHS[d.getMonth()]})}
  d.setDate(d.getDate()+1)}return out}
var DAY_LIST=days(6);
function hoursFor(f){var t=new Date();if(f!==ymd(t))return HOURS;var min=t.getHours()+(t.getMinutes()>0?1:0)+1;return HOURS.filter(function(h){return Number(h.slice(0,2))>=min})}
function fmtHour(h){var n=Number(h.slice(0,2));return (n%12||12)+":00 "+(n<12?"am":"pm")}
function dayLabel(f){var d=DAY_LIST.find(function(x){return x.value===f});return d?d.label:f}
function qualified(){return!(st.answers.mensajes==="menos_50"&&st.answers.inicio==="averiguando")}
function timeout(ms){var c=new AbortController();setTimeout(function(){c.abort()},ms);return c.signal}
function waLink(){var n=st.nombre||"un visitante",lines=["Hola, soy "+n+" 👋"];
 if(lead.diagnostico)lines.push('Hice el diagnóstico de madurez de funnel: resultado "'+lead.diagnostico.tier+'" ('+lead.diagnostico.score+"/"+lead.diagnostico.maxScore+").");
 if(st.step==="info"){lines.push("Me interesa conocer cómo funciona Funnels Labs. Tengo un negocio de "+label("negocio").toLowerCase()+" y recibo "+label("mensajes").toLowerCase()+" mensajes al mes.")}
 else if(lead.cita)lines.push("Ya elegí cita: "+lead.cita.fechaLabel+", "+lead.cita.hora+". Confírmenmela por favor.");
 else lines.push("Quiero agendar mi llamada. (ref: "+lead.id.slice(0,8)+")");
 return "https://wa.me/"+C.whatsapp+"?text="+encodeURIComponent(lines.join("\\n"))}
function label(id){var q=Q.find(function(x){return x.id===id}),o=q&&q.options.find(function(x){return x.value===st.answers[id]});return o?o.label:""}
function stepNo(){return typeof st.step==="number"?st.step+1:st.step==="calendario"?4:5}
function chrome(body,opts){opts=opts||{};var n=stepNo(),bars="";for(var i=1;i<=5;i++)bars+='<span class="'+(i<=n||opts.full?"on":"")+'"></span>';
 return '<div class="top"><div class="brand"><i></i>FUNNELS <b>LABS</b></div>'+(opts.full?"":'<div class="count">Paso '+n+" de 5</div>")+"</div>"+
  '<div class="bar" aria-hidden="true">'+bars+"</div>"+(opts.back?'<button type="button" class="back" data-act="back">← Atrás</button>':"")+'<div class="screen">'+body+"</div>"}
function render(){var h="";
 if(typeof st.step==="number"){var q=Q[st.step],intro=st.step===0;
  h=chrome((intro?'<p class="eyebrow">Agenda tu llamada · 1 min</p><h1>Agenda una llamada con nosotros</h1><p class="lead">Revisamos tu caso y te mostramos cómo dejar de perder clientes por no responder a tiempo.</p><ul class="perks"><li>✓ Gratis y sin compromiso</li><li>✓ 3 preguntas rápidas</li><li>✓ Confirmación por WhatsApp</li></ul>':"")+
   '<h2 id="qt">'+esc(q.title)+'</h2><p class="hint">'+esc(q.hint)+'</p><div class="opts" role="radiogroup" aria-labelledby="qt">'+
   q.options.map(function(o){var sel=st.answers[q.id]===o.value;return '<button type="button" class="opt'+(sel?" sel":"")+'" role="radio" aria-checked="'+sel+'" data-answer="'+o.value+'"><span class="em" aria-hidden="true">'+o.emoji+'</span><span class="lb">'+esc(o.label)+'</span><span class="chev" aria-hidden="true">›</span></button>'}).join("")+"</div>",{back:st.step>0})}
 else if(st.step==="info"){h=chrome('<p class="eyebrow">Te ayudamos por WhatsApp</p><h1>Te enviamos la información por WhatsApp</h1><p class="lead">Como apenas estás explorando, lo más rápido es que te mandemos por WhatsApp cómo funciona, precios y ejemplos de negocios como el tuyo. Cuando quieras, agendamos la llamada.</p><a class="cta" href="'+esc(waLink())+'" target="_blank" rel="noopener" data-act="wa">Recibir la info por WhatsApp →</a><button type="button" class="ghost" data-act="force">Prefiero agendar una llamada de todas formas</button>',{back:true,full:true})}
 else if(st.step==="calendario"){var hs=st.fecha?hoursFor(st.fecha):[];
  h=chrome('<p class="eyebrow">Elige tu horario</p><h2>¿Qué día y a qué hora te llamamos?</h2><p class="hint">Hora de Colombia (GMT-5). Te confirmamos por WhatsApp.</p>'+
   '<div class="section-label">Día</div><div class="days" role="radiogroup" aria-label="Día">'+DAY_LIST.map(function(d){var sel=st.fecha===d.value;return '<button type="button" class="day'+(sel?" sel":"")+'" role="radio" aria-checked="'+sel+'" aria-label="'+esc(d.label)+'" data-day="'+d.value+'"><span class="dw">'+d.short+'</span><span class="dn">'+d.num+'</span><span class="dm">'+d.mon+"</span></button>"}).join("")+"</div>"+
   (st.fecha?'<div class="section-label">Hora <span>'+esc(dayLabel(st.fecha).replace(/^(Hoy|Mañana) · /,""))+"</span></div>"+(st.loading?'<div class="times">'+"<div class=skel></div>".repeat(6)+"</div>":hs.length===0?'<p class="note">Ya no quedan horarios hoy. Elige otro día.</p>':'<div class="times" role="radiogroup" aria-label="Hora">'+hs.map(function(t){var tk=(st.taken[st.fecha]||[]).indexOf(t)>=0,sel=st.hora===t;return '<button type="button" class="time'+(sel?" sel":"")+'" role="radio" aria-checked="'+sel+'" data-time="'+t+'"'+(tk?" disabled":"")+' aria-label="'+fmtHour(t)+(tk?", ocupado":"")+'">'+fmtHour(t)+"</button>"}).join("")+"</div>"+((st.taken[st.fecha]||[]).length?'<p class="note">Los horarios tachados ya están ocupados.</p>':"")):'<p class="note">Elige un día para ver los horarios disponibles.</p>')+
   (st.error?'<p class="err" role="alert">'+esc(st.error)+"</p>":"")+'<button type="button" class="cta" data-act="toData"'+(st.fecha&&st.hora?"":" disabled")+">Continuar →</button>",{back:true})}
 else if(st.step==="datos"){var ok=st.nombre.trim().length>1&&st.tel.replace(/\\D/g,"").length>=7&&/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(st.correo.trim());
  h=chrome('<p class="eyebrow">Último paso</p><h2>¿A quién llamamos?</h2><p class="hint">Te enviamos la invitación a tu correo y te confirmamos por WhatsApp.</p>'+
   '<div class="slot"><span class="ic" aria-hidden="true">📅</span><span class="tx"><b>'+esc(dayLabel(st.fecha))+"</b><span>"+fmtHour(st.hora)+' · hora de Colombia</span></span><button type="button" data-act="back">Cambiar</button></div>'+
   '<form id="f" novalidate><label class="field"><span>Nombre</span><input class="input" id="nombre" name="nombre" autocomplete="name" placeholder="Tu nombre" value="'+esc(st.nombre)+'" maxlength="120"></label>'+
   '<label class="field"><span>WhatsApp</span><span class="phone"><select id="cc" aria-label="Indicativo del país">'+COUNTRIES.map(function(c){return '<option value="'+c[0]+'"'+(st.cc===c[0]?" selected":"")+">"+c[1]+"</option>"}).join("")+'</select><input class="input" id="tel" name="tel" type="tel" inputmode="numeric" autocomplete="tel-national" placeholder="300 123 4567" value="'+esc(st.tel)+'" maxlength="20"></span></label>'+
   '<label class="field"><span>Correo</span><input class="input" id="correo" name="correo" type="email" inputmode="email" autocomplete="email" placeholder="tucorreo@ejemplo.com" value="'+esc(st.correo)+'" maxlength="160"></label>'+
   '<div class="hp" aria-hidden="true"><label>Sitio web <input id="website_url" name="website_url" tabindex="-1" autocomplete="off"></label></div>'+
   (st.error?'<p class="err" role="alert">'+esc(st.error)+"</p>":"")+'<button type="submit" class="cta" id="submit"'+(ok&&!st.busy?"":" disabled")+">"+(st.busy?"Agendando…":"Confirmar mi llamada")+"</button></form>",{back:!st.busy})}
 else if(st.step==="listo"){var c=lead.cita||{};
  h=chrome('<div class="done"><div class="check" aria-hidden="true">✓</div><p class="eyebrow">¡Gracias'+(st.nombre?", "+esc(st.nombre.split(" ")[0]):"")+'!</p><h1>Tu llamada quedó agendada</h1><p class="lead">Te enviamos la invitación a <b>'+esc(st.correo)+'</b> para que quede en tu calendario.</p>'+
   '<div class="slot"><span class="ic" aria-hidden="true">📅</span><span class="tx"><b>'+esc(c.fechaLabel||"")+"</b><span>"+(c.hora?fmtHour(c.hora):"")+' · hora de Colombia</span></span></div>'+
   '<a class="cta" href="'+esc(waLink())+'" target="_blank" rel="noopener">Confirmar por WhatsApp →</a><p class="small">Si necesitas cambiar la hora, escríbenos por WhatsApp.</p></div>',{full:true})}
 app.innerHTML=h;
 var f=document.getElementById("f");if(f)bindForm(f)}
function bindForm(f){var btn=document.getElementById("submit");
 function sync(){st.nombre=f.nombre.value;st.tel=f.tel.value.replace(/[^0-9 ]/g,"");st.cc=document.getElementById("cc").value;st.correo=f.correo.value;if(f.tel.value!==st.tel)f.tel.value=st.tel;
  var ok=st.nombre.trim().length>1&&st.tel.replace(/\\D/g,"").length>=7&&/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(st.correo.trim());btn.disabled=!ok||st.busy}
 f.addEventListener("input",sync);f.addEventListener("change",sync);f.addEventListener("submit",function(e){e.preventDefault();submit(f)})}
function go(step){st.step=step;st.error="";render();window.scrollTo({top:0});var t=app.querySelector("h1,h2");if(t){t.setAttribute("tabindex","-1");t.focus({preventScroll:true})}}
function back(){if(st.step==="datos")return go("calendario");if(st.step==="calendario"||st.step==="info")return go(2);if(typeof st.step==="number"&&st.step>0)go(st.step-1)}
function pickDay(f){st.fecha=f;st.hora="";st.error="";if(st.taken[f]){render();return}st.loading=true;render();
 fetch(C.sheetsUrl+"?fecha="+encodeURIComponent(f)+"&_="+Date.now(),{cache:"no-store",signal:timeout(6000)}).then(function(r){return r.json()}).catch(function(){return null}).then(function(j){
  st.taken[f]=j&&Array.isArray(j.horasOcupadas)?j.horasOcupadas:[];if(st.fecha===f){st.loading=false;render()}})}
function row(l){return{id:l.id,fecha_registro:l.createdAt,nombre:(l.contacto&&l.contacto.nombre)||"",telefono:(l.contacto&&l.contacto.telefono)||"",correo:(l.contacto&&l.contacto.correo)||"",
 diagnostico_tier:(l.diagnostico&&l.diagnostico.tier)||"",diagnostico_score:l.diagnostico?l.diagnostico.score+"/"+l.diagnostico.maxScore:"",
 calculadora_industria:(l.calculadora&&l.calculadora.industria)||"",calculadora_ciudad:(l.calculadora&&l.calculadora.ciudad)||"",calculadora_objetivo:(l.calculadora&&l.calculadora.objetivo)||"",
 presupuesto_sugerido:l.calculadora?l.calculadora.presupuestoMin+" - "+l.calculadora.presupuestoMax+" COP":"",cita_fecha:(l.cita&&l.cita.fechaLabel)||"",cita_fecha_iso:(l.cita&&l.cita.fecha)||"",cita_hora:(l.cita&&l.cita.hora)||""}}
function queue(l){var q=store(QUEUE_KEY)||[];q=q.filter(function(x){return x.id!==l.id});q.push(l);store(QUEUE_KEY,q)}
function submit(f){if(st.busy)return;var hp=f.website_url.value;st.busy=true;st.error="";render();
 var tel=st.cc+" "+st.tel.trim(),now=new Date().toISOString();
 lead=Object.assign({},lead,{contacto:{nombre:st.nombre.trim(),telefono:tel,correo:st.correo.trim()},cita:{fecha:st.fecha,fechaLabel:dayLabel(st.fecha),hora:st.hora},calificacion:st.answers,updatedAt:now});store(LEAD_KEY,lead);
 var crm=fetch(C.crmUrl,{method:"POST",headers:{"Content-Type":"text/plain"},keepalive:true,body:JSON.stringify({leadId:lead.id,nombre:lead.contacto.nombre,telefono:tel,correo:lead.contacto.correo,fecha:st.fecha,hora:st.hora,respuestas:st.answers,diagnostico:lead.diagnostico?lead.diagnostico.tier:"",website_url:hp})}).catch(function(){});
 // The Apps Script checks the slot, emails both sides and creates the calendar event.
 fetch(C.sheetsUrl,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(row(lead)),signal:timeout(10000)}).then(function(r){return r.json()}).catch(function(){return null}).then(function(j){
  st.busy=false;
  if(j&&j.reason==="slot_taken"){(st.taken[st.fecha]=st.taken[st.fecha]||[]).push(st.hora);st.hora="";delete lead.cita;store(LEAD_KEY,lead);go("calendario");st.error="Justo alguien tomó esa hora. Elige otro horario.";render();return}
  if(j&&j.status==="ok"){lead.sheetsSentAt=new Date().toISOString();store(LEAD_KEY,lead)}else queue(lead);
  go("listo")});void crm}
app.addEventListener("click",function(e){var b=e.target.closest("[data-answer],[data-day],[data-time],[data-act]");if(!b||b.disabled)return;
 if(b.dataset.answer){var q=Q[st.step];st.answers[q.id]=b.dataset.answer;render();setTimeout(function(){if(st.step<Q.length-1)go(st.step+1);else go(qualified()?"calendario":"info")},180);return}
 if(b.dataset.day)return pickDay(b.dataset.day);
 if(b.dataset.time){st.hora=b.dataset.time;st.error="";render();return}
 var a=b.dataset.act;if(a==="back")back();else if(a==="toData")go("datos");else if(a==="force")go("calendario")});
render();
})();`;

function scriptFor(config: { sheetsUrl: string; crmUrl: string }): string {
  const data = JSON.stringify({
    questions: AGENDA_QUESTIONS,
    whatsapp: AGENDA_WHATSAPP,
    sheetsUrl: config.sheetsUrl,
    crmUrl: config.crmUrl,
  }).replace(/</g, "\\u003c");
  return `window.__AGENDA__=${data};\n${SCRIPT}`;
}

/** The page plus the CSP that goes with it (the inline script is allowed by hash, nothing else runs). */
export function renderAgencyAgendaPage(config: { crmUrl: string; sheetsUrl?: string }): { html: string; csp: string } {
  const sheetsUrl = config.sheetsUrl ?? AGENDA_SHEETS_URL;
  const script = scriptFor({ sheetsUrl, crmUrl: config.crmUrl });
  const hash = createHash("sha256").update(script).digest("base64");
  const crmOrigin = new URL(config.crmUrl).origin;
  const sheetsOrigin = new URL(sheetsUrl).origin;
  const csp = [
    "default-src 'self'",
    `script-src 'sha256-${hash}'`,
    "style-src 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    // The Apps Script answers through a redirect to googleusercontent.com.
    `connect-src ${sheetsOrigin} https://script.googleusercontent.com ${crmOrigin}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Agenda tu llamada · Funnels Labs</title>
<meta name="description" content="Agenda una llamada gratis con Funnels Labs: revisamos tu caso y te mostramos cómo dejar de perder clientes por no responder a tiempo.">
<meta name="theme-color" content="#0a0a0a">
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap">
<style>${STYLE}</style>
</head>
<body>
<main class="wrap" id="app" aria-live="polite"><noscript><p>Activa JavaScript para agendar, o escríbenos por <a href="https://wa.me/${AGENDA_WHATSAPP}" style="color:#b5ff2b">WhatsApp</a>.</p></noscript></main>
<script>${script}</script>
</body>
</html>`;
  return { html, csp };
}
