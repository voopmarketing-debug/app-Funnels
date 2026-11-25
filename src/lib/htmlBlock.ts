import { WebsiteContentV2Schema } from "@/lib/websiteContentV2";
import { SECURITY_HEADERS } from "@/lib/securityHeaders";
import { HTML_MAX_CHARS, incompleteHtmlReason } from "@/lib/websiteContentV2";

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
export function htmlBlockFromContent(content: unknown, index: number): string | null {
  const parsed = WebsiteContentV2Schema.safeParse(content);
  if (!parsed.success) return null;
  const section = parsed.data.sections[index];
  if (!section || section.type !== "html" || !section.code.trim() || parsed.data.hidden.includes(index)) return null;
  return htmlBlockDocument(section.code);
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
