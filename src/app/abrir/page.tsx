import type { Metadata } from "next";

// "Cargando tu sesión": the screen the installed app opens on. It is a static page (no data, no
// account), so it appears at once, and it hands over to the panel straight away: the phone keeps
// showing this animation while the panel itself loads, instead of a blank white screen.
export const dynamic = "force-static";
export const metadata: Metadata = { title: "Funnels Labs", robots: { index: false, follow: false } };

const CSS = `
.fl-open{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;background:#0a0a0a;color:#f4f4f1;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;padding:24px}
.fl-open::before{content:"";position:absolute;inset:0;background:radial-gradient(60% 40% at 50% 38%,rgba(181,255,43,.14),transparent 70%);animation:fl-glow 2.4s ease-in-out infinite}
.fl-open svg{position:relative;width:92px;height:92px;overflow:visible}
.fl-open .b1,.fl-open .b2{fill:none;stroke:#b5ff2b;stroke-width:3;stroke-dasharray:1;stroke-dashoffset:1}
.fl-open .b1{animation:fl-draw 1.8s ease-in-out infinite}
.fl-open .b2{animation:fl-draw 1.8s ease-in-out .25s infinite}
.fl-open .dot{fill:#b5ff2b;transform-origin:32px 50px;animation:fl-drop 1.8s ease-in-out .5s infinite}
.fl-open h1{position:relative;margin:0;font-size:19px;font-weight:700;letter-spacing:-.01em}
.fl-open .msgs{position:relative;height:20px;width:100%;max-width:300px;font-size:14px;color:#a3a39c}
.fl-open .msgs span{position:absolute;left:0;right:0;opacity:0;animation:fl-msg 9s infinite}
.fl-open .msgs span:nth-child(2){animation-delay:3s}
.fl-open .msgs span:nth-child(3){animation-delay:6s}
.fl-open .bar{position:relative;width:min(220px,60vw);height:4px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}
.fl-open .bar i{position:absolute;inset:0 auto 0 0;width:40%;border-radius:99px;background:#b5ff2b;animation:fl-bar 1.4s ease-in-out infinite}
@keyframes fl-draw{0%{stroke-dashoffset:1;opacity:.4}45%,80%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:-1;opacity:.4}}
@keyframes fl-drop{0%,100%{transform:translateY(-6px) scale(.7);opacity:.3}50%{transform:translateY(0) scale(1);opacity:1}}
@keyframes fl-msg{0%{opacity:0;transform:translateY(6px)}6%,30%{opacity:1;transform:none}36%,100%{opacity:0;transform:translateY(-6px)}}
@keyframes fl-bar{0%{transform:translateX(-110%)}100%{transform:translateX(280%)}}
@keyframes fl-glow{0%,100%{opacity:.55}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.fl-open *,.fl-open::before{animation:none!important}.fl-open .b1,.fl-open .b2{stroke-dashoffset:0}.fl-open .dot{opacity:1}.fl-open .msgs span:first-child{opacity:1}}
`;

export default function OpenPage() {
  return (
    <div className="fl-open" role="status" aria-live="polite">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect className="b1" x="6" y="6" width="52" height="9" rx="4.5" pathLength={1} />
        <rect className="b2" x="17" y="26" width="30" height="9" rx="4.5" pathLength={1} />
        <circle className="dot" cx="32" cy="50" r="7.5" />
      </svg>
      <h1>Cargando tu sesión</h1>
      <div className="msgs">
        <span>Conectando con tu cuenta…</span>
        <span>Preparando tus chats y tus contactos…</span>
        <span>Casi listo…</span>
      </div>
      <div className="bar" aria-hidden="true">
        <i />
      </div>
      {/* Straight on to the panel; replace, so "back" never lands here again. */}
      <script dangerouslySetInnerHTML={{ __html: 'setTimeout(function(){location.replace("/dashboard")},250)' }} />
      <noscript>
        <meta httpEquiv="refresh" content="0;url=/dashboard" />
      </noscript>
    </div>
  );
}
