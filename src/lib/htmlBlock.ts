import { WebsiteContentV2Schema } from "@/lib/websiteContentV2";
import { SECURITY_HEADERS } from "@/lib/securityHeaders";
import { HTML_MAX_CHARS, incompleteHtmlReason } from "@/lib/websiteContentV2";
import { markEditableText } from "@/lib/htmlText";

// The "Código HTML" block: the owner pastes their own HTML (a widget, an embed, a form from another
// service, a script). It is never put inside the page itself: it is served from its own address and
// shown in a sandboxed frame, so it cannot read the platform's cookies or touch the page around it,
// and the page's own strict policy stays as it is.

/** The policy of the frame's own document: its scripts and external resources work, but the sandbox keeps it isolated. */
export const HTML_BLOCK_CSP =
  "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals; default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self'";

// Reports the content height to the page around it (which sets the frame's height). Fixed text.
const AUTO_HEIGHT = `<script>(function(){function h(){var b=document.body,e=document.documentElement;return Math.max(b?b.scrollHeight:0,b?b.offsetHeight:0,e.offsetHeight);}function s(){try{parent.postMessage({flHtmlH:h()},"*");}catch(x){}}addEventListener("load",s);addEventListener("resize",s);if(window.ResizeObserver){new ResizeObserver(s).observe(document.documentElement);}setInterval(s,1500);s();})();</script>`;

// Forms in the owner's code that have no address of their own save the contact in the CRM: the form's
// fields are sent to the page around the frame (which posts them to this page's contact form address)
// and the frame shows a thank-you. Forms that point to the owner's own service (an https address) are left alone.
const LEAD_BRIDGE = `<script>(function(){function box(f,t,ok){var n=f.__flm;if(!n){n=document.createElement("div");n.setAttribute("role","status");n.style.cssText="margin:12px 0;padding:12px 14px;border-radius:10px;font:600 14px/1.4 system-ui,sans-serif";f.__flm=n;f.appendChild(n);}n.textContent=t;n.style.background=ok?"#dcfce7":"#fee2e2";n.style.color=ok?"#166534":"#991b1b";}function lock(f,on){Array.prototype.forEach.call(f.querySelectorAll("button,input[type=submit]"),function(b){b.disabled=on;});}var cur=null;addEventListener("message",function(e){var m=e.data;if(!m||m.flLeadResult===undefined||!cur)return;var f=cur;cur=null;lock(f,false);if(m.flLeadResult){try{f.reset();}catch(x){}box(f,"¡Gracias! Recibimos tus datos y te contactaremos pronto.",true);}else{box(f,"No pudimos enviarlo. Inténtalo de nuevo en un momento.",false);}});document.addEventListener("submit",function(e){var f=e.target;if(!f||f.tagName!=="FORM")return;if(/^https?:/i.test((f.getAttribute("action")||"").trim()))return;e.preventDefault();var name="",contact="",rest=[];Array.prototype.forEach.call(f.elements,function(el){var t=(el.type||"").toLowerCase();if(!el.name&&!el.id)return;if(t==="submit"||t==="button"||t==="password"||t==="hidden"||t==="file")return;if((t==="checkbox"||t==="radio")&&!el.checked)return;var v=String(el.value||"").trim();if(!v)return;var k=((el.name||"")+" "+(el.id||"")+" "+(el.getAttribute("autocomplete")||"")+" "+(el.placeholder||"")).toLowerCase();if(!contact&&(t==="email"||t==="tel"||/mail|correo|tel|phone|whats|celular|movil|móvil|contact/.test(k))){contact=v;}else if(!name&&/name|nombre/.test(k)){name=v;}else{rest.push((el.name||el.id)+": "+v);}});if(!contact){box(f,"Agrega un campo de correo o de teléfono para poder guardar el contacto.",false);return;}if(!name)name=contact;cur=f;lock(f,true);try{parent.postMessage({flLead:{name:name,contact:contact,message:rest.join(" · ")}},"*");}catch(x){lock(f,false);cur=null;}},true);})();</script>`;

// The builder's editing frame: every text is clickable and changes in place; the new text goes to the builder
// (the window on top) that saves it. Links and forms do nothing while editing. Fixed text, one number inserted.
function editScript(section: number): string {
  return `<script>(function(){var S=${Math.max(0, Math.floor(section))};var st=document.createElement("style");st.textContent='[data-fl-t]{cursor:text}[data-fl-t]:hover{outline:2px dashed #b5ff2b;outline-offset:2px}[data-fl-t][contenteditable]{outline:2px solid #b5ff2b;outline-offset:2px;background:rgba(181,255,43,.14)}';document.head.appendChild(st);var cur=null,orig="";function stop(save){var el=cur;if(!el)return;cur=null;el.removeAttribute("contenteditable");var t=el.textContent||"";if(save&&t!==orig&&t.trim()){try{top.postMessage({flHtmlText:true,section:S,index:Number(el.getAttribute("data-fl-t")),text:t},"*");}catch(x){}}else{el.textContent=orig;}}function start(el){if(cur===el)return;if(cur)stop(true);cur=el;orig=el.textContent||"";el.setAttribute("contenteditable","plaintext-only");if(el.contentEditable!=="plaintext-only")el.setAttribute("contenteditable","true");el.focus();var r=document.createRange();r.selectNodeContents(el);var g=getSelection();g.removeAllRanges();g.addRange(r);}document.addEventListener("click",function(e){if(e.target&&e.target.id==="fl-steps-btn")return;var t=e.target&&e.target.closest?e.target.closest("[data-fl-t]"):null;if(t){e.preventDefault();e.stopPropagation();start(t);return;}if(e.target&&e.target.closest&&e.target.closest("a,button,[onclick]")){e.preventDefault();e.stopPropagation();}},true);document.addEventListener("keydown",function(e){if(!cur)return;if(e.key==="Enter"){e.preventDefault();stop(true);}else if(e.key==="Escape"){e.preventDefault();stop(false);}else if(e.key===" "){e.stopPropagation();}},true);document.addEventListener("keyup",function(e){if(cur&&e.key===" "){e.preventDefault();e.stopPropagation();}},true);document.addEventListener("focusout",function(e){if(cur&&e.target===cur)stop(true);});document.addEventListener("submit",function(e){e.preventDefault();},true);var rev=[],on=false,btn=document.createElement("button");btn.type="button";btn.id="fl-steps-btn";btn.textContent="Ver todos los pasos";btn.style.cssText="position:fixed;left:12px;bottom:12px;z-index:2147483647;display:none;padding:9px 14px;border:0;border-radius:999px;background:#111827;color:#fff;font:700 13px/1 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer";function hiddenUp(el){var out=[];while(el&&el!==document.documentElement){var cs=getComputedStyle(el);if(cs.display==="none"||cs.visibility==="hidden"||el.hidden||parseFloat(cs.opacity)===0)out.push(el);el=el.parentElement;}return out;}function reveal(v){on=v;if(v){Array.prototype.forEach.call(document.querySelectorAll("[data-fl-t]"),function(sp){hiddenUp(sp).forEach(function(el){rev.push([el,el.getAttribute("style"),el.hidden]);el.hidden=false;el.style.setProperty("display","block","important");el.style.setProperty("visibility","visible","important");el.style.setProperty("opacity","1","important");});});}else{rev.reverse().forEach(function(r){r[0].hidden=r[2];if(r[1]===null)r[0].removeAttribute("style");else r[0].setAttribute("style",r[1]);});rev=[];}btn.textContent=v?"Ocultar los pasos extra":"Ver todos los pasos";}btn.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();if(cur)stop(true);reveal(!on);try{top.postMessage({flHtmlAll:on},"*");}catch(x){}},true);function check(){if(on)return;var any=false;Array.prototype.forEach.call(document.querySelectorAll("[data-fl-t]"),function(sp){if(!any&&hiddenUp(sp).length)any=true;});btn.style.display=any||on?"block":"none";}document.body.appendChild(btn);addEventListener("message",function(e){var m=e.data;if(m&&m.flShowAll===true&&!on)reveal(true);});setTimeout(check,700);setTimeout(check,2500);try{top.postMessage({flHtmlReady:true},"*");}catch(x){}})();</script>`;
}

/** The editing version of a block's frame (builder only): its texts can be clicked and changed. */
export function htmlBlockEditDocument(code: string, section: number): string {
  return htmlBlockDocument(markEditableText(code)) + editScript(section);
}

/** The document a block's frame loads: the owner's code, opened links go to a new tab, plus the height reporter. */
export function htmlBlockDocument(code: string): string {
  const hasDoc = /<html[\s>]/i.test(code) || /<body[\s>]/i.test(code);
  const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank">`;
  if (hasDoc) {
    const withHead = /<head[\s>]/i.test(code) ? code.replace(/<head([^>]*)>/i, `<head$1>${head}`) : code.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`);
    return /<\/body>/i.test(withHead) ? withHead.replace(/<\/body>/i, `${AUTO_HEIGHT}${LEAD_BRIDGE}</body>`) : `${withHead}${AUTO_HEIGHT}${LEAD_BRIDGE}`;
  }
  return `<!doctype html><html><head>${head}<style>html,body{margin:0}</style></head><body>${code}${AUTO_HEIGHT}${LEAD_BRIDGE}</body></html>`;
}

/** The document of block number `index` of a stored page, or null when that block is not a visible, filled-in HTML block. */
export function htmlBlockFromContent(content: unknown, index: number, edit = false): string | null {
  const parsed = WebsiteContentV2Schema.safeParse(content);
  if (!parsed.success) return null;
  const section = parsed.data.sections[index];
  if (!section || section.type !== "html" || !section.code.trim() || parsed.data.hidden.includes(index)) return null;
  return edit ? htmlBlockEditDocument(section.code, index) : htmlBlockDocument(section.code);
}

/** Headers of a block's frame response. */
export const HTML_BLOCK_HEADERS: Record<string, string> = {
  ...Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value])),
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": HTML_BLOCK_CSP,
  "X-Robots-Tag": "noindex",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  // The owner edits this often; never serve an old copy.
  "Cache-Control": "no-store",
};

/** Checks the HTML an owner uploads or pastes for a whole page; an error in plain Spanish, or the cleaned text. */
export function checkUploadedHtml(raw: unknown): { ok: true; html: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "No se pudo leer el archivo." };
  const html = raw.replace(/^\uFEFF/, "").trim();
  if (!html) return { ok: false, error: "El archivo está vacío." };
  if (html.length > HTML_MAX_CHARS) return { ok: false, error: `El HTML es muy largo (${html.length.toLocaleString("es")} caracteres): el máximo es ${HTML_MAX_CHARS.toLocaleString("es")}.` };
  if (!/<[a-z!][^>]*>/i.test(html)) return { ok: false, error: "Eso no parece código HTML. Pega o sube un archivo .html." };
  const cut = incompleteHtmlReason(html);
  if (cut) return { ok: false, error: cut };
  return { ok: true, html };
}
