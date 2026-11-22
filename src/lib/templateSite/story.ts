import { HONEYPOT_HTML } from "@/lib/honeypot";
import { ensureContrast } from "@/lib/colorContrast";
import type { CatalogProduct } from "@/lib/websiteContentV2";
import { TEMPLATE_FONTS, type StoryContent } from "./content";
import type { StoryClientData } from "./storyClient";
import { STORY_CLIENT_SOURCE } from "./clientScripts.generated";
import { clientProducts, esc, iconSvg, jsonForHtml, MONTHS, withMonth } from "./shared";

// The Scroll Story template: a product told while you scroll. One protagonist image travels and
// turns between sections (portada, ritual, moving text, ingredients), then the collection fan, the
// month's promotion, the first visit, the booking card and the giant brand word. Ported from the
// hand-designed template; the data comes from the catalog and from the texts the AI wrote.

export const STORY_CSS = `
:root{--bg:#ffffff;--bg-2:#f5f6f8;--surface:#fafafb;--ink:#111214;--muted:#6b7078;--line:#e4e6ea;--deep:#f0f1f4;--deep-ink:var(--ink);--deep-muted:var(--muted);--card:#ffffff;--shadow:rgba(17,18,20,.2);
--f-display:"Manrope",system-ui,-apple-system,sans-serif;--f-body:"Inter Tight",system-ui,-apple-system,sans-serif;--f-mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;color-scheme:light}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;overflow-x:hidden}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:30;background:var(--bg)}
.wrap{max-width:1240px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
a{color:inherit}
button{font:inherit;color:inherit;cursor:pointer}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}
.mono{font-family:var(--f-mono);font-size:11px;letter-spacing:.18em;text-transform:uppercase}
.display{font-family:var(--f-display);font-weight:700;text-transform:none;line-height:1.05;letter-spacing:-.03em;margin:0;text-wrap:balance}
.count{display:flex;align-items:center;gap:12px;color:var(--muted)}
.count i{width:44px;height:1px;background:currentColor;opacity:.5}
.link{display:inline-flex;align-items:center;gap:8px;font-size:14px;font-weight:500;text-decoration:none;border:0;background:none;padding:6px 0}
.link svg{transition:transform .25s}
.link:hover svg{transform:translateX(4px)}
.btn{white-space:nowrap;display:inline-flex;align-items:center;gap:10px;border-radius:999px;padding:12px 22px;font-size:14px;font-weight:500;text-decoration:none;border:1px solid var(--ink);background:var(--ink);color:var(--bg);transition:opacity .2s,transform .2s;cursor:pointer}
.btn:hover{opacity:.86}
.btn:active{transform:scale(.97)}
.btn.line{background:transparent;color:var(--ink)}
.btn.light{background:var(--deep-ink);color:var(--deep);border-color:var(--deep-ink)}
header.top{position:fixed;top:env(safe-area-inset-top,0px);left:0;right:0;z-index:25;transition:background .3s;background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(12px)}
header.top .wrap{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding-block:16px}
nav.links{display:flex;gap:24px}
nav.links a{text-decoration:none;font-size:13px;color:var(--muted)}
nav.links a:hover{color:var(--ink)}
.logo{font-family:var(--f-display);font-weight:700;font-size:18px;letter-spacing:.3em;text-decoration:none;padding-left:.3em;text-transform:uppercase}
header .btn{justify-self:end;padding:9px 18px}
.ticker{background:var(--ink);color:#fff;overflow:hidden;font-size:12px;letter-spacing:.02em}
.tk-track{display:flex;width:max-content;animation:tk 36s linear infinite}
.tk-track span{padding:8px 28px;white-space:nowrap;position:relative}
.tk-track span::after{content:"✦";position:absolute;right:-6px;top:50%;transform:translateY(-50%);font-size:10px;color:color-mix(in srgb,var(--accent) 55%,#fff)}
.ticker:hover .tk-track{animation-play-state:paused}
@keyframes tk{to{transform:translateX(-50%)}}
#flyer{position:fixed;left:0;top:0;z-index:6;pointer-events:none;will-change:transform,opacity;filter:drop-shadow(0 40px 40px var(--shadow));display:none;object-fit:contain}
html.fly #flyer{display:block}
.anchor{position:relative;aspect-ratio:1/1}
.anchor img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 30px 30px var(--shadow))}
html.fly .anchor img{visibility:hidden}
.hero{position:relative;padding-top:118px;background:linear-gradient(180deg,#ffffff 0%,var(--bg-2) 100%);overflow:hidden}
.hero .word{position:absolute;left:0;right:0;top:64px;text-align:center;font-family:var(--f-display);font-size:clamp(80px,15vw,220px);font-weight:800;line-height:.8;letter-spacing:.06em;color:rgba(17,18,20,.05);pointer-events:none;user-select:none;padding-left:.12em;text-transform:uppercase;white-space:nowrap;overflow:hidden}
.hero .wrap{position:relative;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:center;gap:24px;min-height:min(760px,92vh);padding-block:40px 60px}
.hero.solo .wrap{grid-template-columns:minmax(0,1fr)}
.hero-copy{display:flex;flex-direction:column;gap:20px;max-width:440px}
.hero-copy .display{font-size:clamp(32px,4.2vw,56px)}
.hero-copy p{margin:0;color:var(--muted);max-width:36ch}
.hero-copy .row{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.trust{display:flex;gap:22px;flex-wrap:wrap;color:var(--muted);font-size:13px;margin-top:6px}
.trust span{display:flex;align-items:center;gap:8px}
.trust svg{width:18px;height:18px}
.hero .anchor{width:min(460px,80%);justify-self:center}
.ritual{position:relative;background:linear-gradient(180deg,#ffffff 0 58%,var(--deep) 58% 100%)}
.ritual .wrap{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,4fr) minmax(0,3fr);gap:40px;padding-block:120px 96px;align-items:start;min-height:720px}
.ritual.noanchor .wrap{grid-template-columns:minmax(0,5fr) minmax(0,4fr);min-height:0}
.ritual .display{font-size:clamp(28px,3.4vw,44px)}
.ritual p{color:var(--muted);max-width:32ch}
.ritual .anchor{width:min(340px,100%);justify-self:center;margin-top:170px}
.benefits{list-style:none;margin:0;padding:0;display:grid;gap:18px}
.benefits li{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding-bottom:16px;border-bottom:1px solid var(--line)}
.benefits b{font-family:var(--f-display);font-size:18px;font-weight:600}
.benefits small{display:block;color:var(--muted);font-size:13px}
.swatch{width:42px;height:42px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),0 8px 16px -8px var(--shadow)}
.spec-line{position:absolute;left:0;right:0;bottom:28px;display:flex;justify-content:space-between;color:var(--deep-muted)}
.ritual .wrap.spec-line{display:flex;min-height:0;padding-block:0;grid-template-columns:none}
.marquee{position:relative;background:var(--bg-2);padding-block:56px;overflow:hidden}
.mq{display:flex;width:max-content;font-family:var(--f-display);text-transform:none;font-weight:700;letter-spacing:-.02em;font-size:clamp(26px,4vw,52px);line-height:1.25;color:rgba(17,18,20,.42);white-space:nowrap;animation:mq 38s linear infinite}
.mq.rev{animation-direction:reverse;color:rgba(17,18,20,.2)}
.mq span{padding-right:.4em}
@keyframes mq{to{transform:translateX(-50%)}}
.marquee .anchor{position:absolute;left:50%;top:50%;width:min(180px,28vw);transform:translate(-50%,-50%)}
.marquee .tags{position:absolute;left:0;right:0;bottom:26px;display:flex;justify-content:center;gap:28px;color:var(--muted)}
.inside .wrap{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:48px;align-items:center;padding-block:120px}
.inside .display{font-size:clamp(28px,3.4vw,44px)}
.inside p{color:var(--muted);max-width:34ch}
.lab{position:relative;aspect-ratio:16/10;min-width:0}
.lab svg.wires{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.wires path{fill:none;stroke:var(--muted);stroke-width:1;stroke-dasharray:3 4;vector-effect:non-scaling-stroke;opacity:.7}
.lab .anchor{position:absolute;left:50%;top:50%;width:30%;transform:translate(-50%,-50%)}
.ing{position:absolute;display:flex;align-items:center;gap:12px;width:max-content;max-width:46%}
.ing .drop{width:clamp(58px,7vw,88px);height:clamp(58px,7vw,88px);border-radius:50%;flex:none;box-shadow:0 0 0 6px color-mix(in srgb,var(--surface) 80%,transparent),0 14px 26px -12px var(--shadow)}
.ing b{display:block;font-family:var(--f-display);font-size:16px;font-weight:600;line-height:1.2}
.ing small{color:var(--muted);font-size:13px;display:block;max-width:18ch}
.ing .mono{color:var(--muted);font-size:10px}
.d1{background:radial-gradient(circle at 30% 28%,#fff 0 7%,transparent 8%),radial-gradient(circle at 64% 62%,rgba(255,255,255,.75) 0 5%,transparent 6%),radial-gradient(circle at 50% 45%,color-mix(in srgb,var(--accent) 25%,#fff),color-mix(in srgb,var(--accent) 70%,#fff) 80%)}
.d2{background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.9) 0 6%,transparent 7%),repeating-radial-gradient(circle at 50% 50%,color-mix(in srgb,var(--accent) 10%,#fff) 0 6px,color-mix(in srgb,var(--accent) 30%,#fff) 6px 9px)}
.d3{background:radial-gradient(circle at 30% 30%,#fff 0 6%,transparent 7%),radial-gradient(circle at 60% 55%,rgba(255,255,255,.7) 0 9%,transparent 10%),radial-gradient(circle at 50% 50%,#f6e7c8,#d8b77a 85%)}
.d4{background:radial-gradient(circle at 50% 50%,var(--surface) 0 60%,transparent 61%),conic-gradient(from 20deg,color-mix(in srgb,var(--accent) 40%,#fff),color-mix(in srgb,var(--accent) 12%,#fff),color-mix(in srgb,var(--accent) 55%,#fff),color-mix(in srgb,var(--accent) 12%,#fff),color-mix(in srgb,var(--accent) 40%,#fff));display:grid;place-items:center;font-family:var(--f-display);font-weight:700;font-size:20px;color:var(--accent-ink)}
.collection{background:var(--deep);color:var(--deep-ink);overflow:hidden}
.collection .wrap{padding-block:110px 90px;text-align:center}
.collection .display{font-size:clamp(28px,3.4vw,44px)}
.collection .mono{color:var(--deep-muted)}
.fan{position:relative;height:440px;margin-top:40px;touch-action:pan-y;user-select:none;-webkit-user-select:none;cursor:grab}
.card{position:absolute;left:50%;top:20px;width:230px;margin-left:-115px;height:330px;border-radius:22px;background:var(--card);color:var(--ink);border:1px solid var(--line);padding:14px;display:flex;flex-direction:column;justify-content:space-between;text-align:left;transform:translateX(calc(var(--k) * 250px)) translateY(calc(var(--k) * var(--k) * 16px)) rotate(calc(var(--k) * 6deg));transition:transform .7s cubic-bezier(.2,.8,.2,1),opacity .5s;box-shadow:0 30px 50px -34px rgba(52,36,78,.45)}
.card.jump{transition:none}
.card img{height:200px;width:100%;object-fit:contain;margin-top:10px;filter:drop-shadow(0 16px 14px rgba(40,30,62,.22))}
.card .meta{background:var(--bg-2);border-radius:14px;padding:10px 12px;display:flex;justify-content:space-between;align-items:flex-end;gap:8px}
.card .meta b{display:block;font-size:13px;font-weight:600;line-height:1.25}
.card .meta small{font-size:12px;color:var(--muted)}
.heart{position:absolute;right:12px;top:12px;width:32px;height:32px;border-radius:50%;background:#fff;display:grid;place-items:center;border:0;color:var(--ink)}
.heart svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.6}
.heart[aria-pressed="true"] svg{fill:var(--accent);stroke:var(--accent)}
.tag{position:absolute;left:12px;top:14px;font-family:var(--f-mono);font-size:10px;letter-spacing:.12em;background:var(--ink);color:#fff;border-radius:4px;padding:3px 7px}
.fan-ctrl{display:flex;justify-content:center;align-items:center;gap:16px;margin-top:8px}
.round{width:44px;height:44px;border-radius:50%;border:1px solid currentColor;background:transparent;display:grid;place-items:center;opacity:.8}
.round:hover{opacity:1}
.dots{display:flex;gap:8px}
.dots i{width:6px;height:6px;border-radius:50%;background:var(--deep-muted);opacity:.5}
.dots i.on{opacity:1;background:var(--deep-ink)}
.visit .wrap{padding-block:120px 80px;display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:56px}
.visit .display{font-size:clamp(28px,3.4vw,44px)}
.steps{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--line);counter-reset:v}
.steps li{padding:30px 22px 0 0;display:flex;flex-direction:column;gap:8px;counter-increment:v;min-width:0}
.steps li + li{padding-left:22px;border-left:1px solid var(--line)}
.steps li::before{content:"0" counter(v);font-family:var(--f-display);font-weight:700;font-size:30px;line-height:1;color:var(--accent-ink)}
.steps b{font-weight:600}
.steps span{color:var(--muted);font-size:15px}
.steps .mono{color:var(--ink);letter-spacing:.1em}
.book .wrap{padding-block:30px 120px}
.book-card{background:var(--deep);color:var(--deep-ink);border:1px solid var(--line);border-radius:30px;padding:clamp(24px,4vw,56px);display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:56px;align-items:start}
.book-card .display{font-size:clamp(26px,3vw,40px)}
.book-card p{color:var(--deep-muted)}
.facts{display:grid;gap:12px;margin-top:22px}
.facts div{display:flex;flex-direction:column}
.facts .mono{color:var(--deep-muted)}
form.form{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.field{display:flex;flex-direction:column;gap:6px;min-width:0}
.full{grid-column:1/-1}
label.lbl{font-family:var(--f-mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--deep-muted)}
.form input:not([type=checkbox]):not([type=radio]),.form select{font:inherit;color:var(--ink);background:#ffffff;border:1px solid var(--line);border-radius:12px;padding:12px;width:100%;min-width:0;color-scheme:light}
.form input:focus,.form select:focus{outline:none;border-color:var(--accent)}
.seg{display:flex;gap:8px}
.seg label{position:relative;flex:1;border:1px solid var(--line);background:#fff;border-radius:12px;padding:11px;text-align:center;cursor:pointer;font-size:14px}
.seg input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;pointer-events:none}
.seg label:has(input:checked){border-color:var(--accent);background:var(--bg-2)}
.seg label:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}
.check{display:flex;flex-direction:row;gap:10px;align-items:flex-start;font-size:13px;color:var(--deep-muted)}
.check input{width:18px;height:18px;margin-top:2px;accent-color:var(--accent);flex:none}
.ok{border:1px solid var(--accent);background:#fff;border-radius:12px;padding:14px;font-size:14px}
.ok[hidden]{display:none}
footer{position:relative;overflow:hidden;background:linear-gradient(180deg,#ffffff,var(--bg-2))}
footer .big{font-family:var(--f-display);font-size:clamp(70px,13vw,200px);font-weight:800;line-height:.85;letter-spacing:.06em;text-align:center;color:rgba(17,18,20,.06);padding-left:.14em;margin-top:30px;user-select:none;text-transform:uppercase;white-space:nowrap;overflow:hidden}
footer .wrap{display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between;padding-block:22px;color:var(--muted);font-size:13px;border-top:1px solid var(--line)}
dialog.sheet{border:0;background:var(--bg);color:var(--ink);border-radius:24px;padding:0;width:min(940px,calc(100vw - 24px));max-height:calc(100dvh - 24px);overflow:auto;box-shadow:0 40px 80px -20px var(--shadow)}
dialog.sheet::backdrop{background:color-mix(in srgb,var(--deep) 60%,transparent);backdrop-filter:blur(6px)}
.sheet-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.sheet-art{position:relative;background:radial-gradient(circle at 50% 55%,var(--surface) 0 40%,var(--bg-2) 41%);display:grid;place-items:center;padding:48px 24px 80px;min-height:440px}
#s-art img{display:block;height:min(320px,55vw);width:auto;max-width:100%;object-fit:contain;filter:drop-shadow(0 30px 24px var(--shadow));animation:rise .6s cubic-bezier(.2,.8,.2,1)}
@keyframes rise{from{transform:translateY(24px);opacity:0}}
.sheet-nav{position:absolute;bottom:18px;left:0;right:0;display:flex;justify-content:center;gap:10px}
.sheet .round{border-color:var(--line);background:var(--surface);opacity:1}
.sheet-info{padding:36px 34px 30px;display:flex;flex-direction:column;gap:16px;position:relative;min-width:0}
.sheet-info h3{margin:0;font-family:var(--f-display);font-size:clamp(26px,3vw,36px);line-height:1.05;font-weight:700;letter-spacing:-.03em}
.sheet-info .sub{color:var(--muted);margin-top:-6px}
.x{position:absolute;right:14px;top:14px}
.tabs{display:flex;gap:22px;border-bottom:1px solid var(--line)}
.tabs button{border:0;background:none;padding:10px 0;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px;font-size:14px}
.tabs button[hidden]{display:none}
.tabs button[aria-selected="true"]{color:var(--ink);border-color:var(--ink)}
.panel{min-height:150px}
.panel p{margin:0 0 10px}
dl.kv{display:grid;grid-template-columns:auto 1fr;gap:8px 18px;margin:0}
dl.kv dt{font-family:var(--f-mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);padding-top:4px}
dl.kv dd{margin:0}
.big-price{font-family:var(--f-display);font-weight:700;font-size:36px;line-height:1;font-variant-numeric:tabular-nums}
.small{font-size:13px;color:var(--muted)}
.promo-wrap .wrap{padding-block:110px 0}
.promo{position:relative;overflow:hidden;isolation:isolate;border-radius:34px;background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 14%,#fff),color-mix(in srgb,var(--accent) 6%,#fff) 55%,color-mix(in srgb,var(--accent) 10%,#fff));display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:center;gap:24px;padding:clamp(28px,4vw,60px);min-height:420px;border:1px solid var(--line)}
.promo.solo{grid-template-columns:minmax(0,1fr)}
.promo .glow{position:absolute;z-index:-1;width:460px;height:460px;border-radius:50%;left:var(--gx,70%);top:var(--gy,50%);transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(255,255,255,.95),transparent 65%);transition:left .25s ease-out,top .25s ease-out;pointer-events:none}
.pb{position:absolute;z-index:-2;border-radius:50%;filter:blur(50px);opacity:.7;animation:drift 14s ease-in-out infinite alternate}
.pb.p1{width:380px;height:380px;left:-80px;bottom:-160px;background:color-mix(in srgb,var(--accent) 45%,#fff)}
.pb.p2{width:340px;height:340px;right:-60px;top:-140px;background:color-mix(in srgb,var(--accent) 25%,#fff);animation-delay:-7s}
@keyframes drift{to{transform:translate(50px,-30px) scale(1.15)}}
.promo-copy{display:flex;flex-direction:column;gap:16px;align-items:flex-start;min-width:0}
.promo-copy .display{font-size:clamp(28px,3.4vw,44px)}
.promo-copy p{margin:0;color:var(--muted);max-width:40ch}
.promo-tag{display:inline-flex;align-items:center;gap:8px;color:var(--accent-ink)}
.promo-tag i{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:blink 1.8s infinite}
@keyframes blink{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 60%,transparent)}70%{box-shadow:0 0 0 10px transparent}}
.clock{display:flex;gap:10px}
.clock div{background:rgba(255,255,255,.75);border:1px solid var(--line);border-radius:14px;padding:10px 12px;min-width:66px;text-align:center;backdrop-filter:blur(6px)}
.clock b{display:block;font-family:var(--f-display);font-weight:800;font-size:26px;line-height:1;font-variant-numeric:tabular-nums}
.clock span{font-size:11px;color:var(--muted)}
.promo-art{position:relative;height:340px;min-width:0;transform:perspective(900px) rotateY(var(--ry,0deg)) rotateX(var(--rx,0deg));transition:transform .3s ease-out}
.pa{position:absolute;bottom:0;height:auto;max-height:100%;object-fit:contain;filter:drop-shadow(0 26px 22px rgba(40,30,62,.25));animation:float 5s ease-in-out infinite}
.pa.a1{left:6%;width:20%;bottom:16%;animation-delay:-1s}
.pa.a2{left:30%;width:40%;bottom:4%}
.pa.a3{right:6%;width:20%;bottom:18%;animation-delay:-2.5s}
.promo-art.one .pa.a2{left:24%;width:52%}
@keyframes float{50%{transform:translateY(-14px)}}
.stamp{position:absolute;right:2%;top:2%;width:88px;height:88px;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;text-align:center;padding:6px;font-family:var(--f-display);font-weight:800;font-size:20px;transform:rotate(-12deg);animation:bob 3s ease-in-out infinite}
@keyframes bob{50%{transform:rotate(-5deg) translateY(-8px)}}
.reveal.pre{opacity:0;transform:translateY(28px)}
.reveal{transition:opacity .8s cubic-bezier(.2,.8,.2,1),transform .8s cubic-bezier(.2,.8,.2,1)}
@media (max-width:900px){
  header.top .wrap{grid-template-columns:auto 1fr}
  nav.links{display:none}
  .logo{grid-column:1}
  .hero{padding-top:100px}
  .hero .wrap{grid-template-columns:minmax(0,1fr);min-height:0;padding-top:24px}
  .hero .anchor{width:min(320px,74%)}
  .ritual{background:var(--bg-2)}
  .ritual .wrap,.ritual.noanchor .wrap{grid-template-columns:minmax(0,1fr);min-height:0;padding-block:80px 60px}
  .ritual .anchor{margin-top:0;width:min(260px,70%)}
  .spec-line{display:none}
  .marquee{padding-block:80px}
  .inside .wrap{grid-template-columns:minmax(0,1fr);padding-block:80px}
  .lab{aspect-ratio:auto;display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .lab svg.wires{display:none}
  .lab .anchor{position:relative;left:auto;top:auto;transform:none;width:min(240px,70%);grid-column:1/-1;justify-self:center}
  .ing{position:static;max-width:none;width:auto;min-width:0;flex-direction:column!important;align-items:flex-start;text-align:left!important}
  .visit .wrap{grid-template-columns:minmax(0,1fr);padding-block:80px}
  .collection .wrap{padding-block:80px 64px}
  .promo-wrap .wrap{padding-top:80px}
  .promo{grid-template-columns:minmax(0,1fr)}
  .promo-art{height:260px}
  .book-card{grid-template-columns:minmax(0,1fr)}
  .sheet-grid{grid-template-columns:minmax(0,1fr)}
  .sheet-art{min-height:300px}
}
@media (max-width:560px){
  .steps{grid-template-columns:minmax(0,1fr)}
  .steps li + li{padding-left:0;border-left:0}
  .card{width:190px;margin-left:-95px;height:290px;transform:translateX(calc(var(--k) * 205px)) translateY(calc(var(--k) * var(--k) * 14px)) rotate(calc(var(--k) * 6deg))}
  .card img{height:170px}
  .fan{height:390px}
  form.form{grid-template-columns:minmax(0,1fr)}
  .marquee .tags{gap:14px;font-size:9px;flex-wrap:wrap}
  .clock div{min-width:0;flex:1;padding:8px 6px}.clock b{font-size:26px}.stamp{width:72px;height:72px;font-size:20px}.book .wrap{padding-bottom:80px}
}
@media (prefers-reduced-motion:reduce){.tk-track,.mq,.pb,.pa,.stamp,.promo-tag i{animation:none}.card{transition:none}#s-art img{animation:none}html{scroll-behavior:auto}.reveal.pre{opacity:1;transform:none}}
`;

export type StoryRenderCtx = {
  businessName: string;
  trackingBasePath: string;
  preview?: boolean;
  leadSubmitted?: boolean;
  products: CatalogProduct[];
  edit?: boolean;
};

export function storyScript(): string {
  return `(${STORY_CLIENT_SOURCE})(JSON.parse(document.getElementById("site-data").textContent));`;
}

const ARROW = `<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M0 6h14M9 1l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;

export function renderStory(content: StoryContent, ctx: StoryRenderCtx): string {
  const accent = /^#[0-9a-fA-F]{6}$/.test(content.brand.accent) ? content.brand.accent : "#8a73c9";
  const accentInk = ensureContrast(accent, "#ffffff", 3);
  const previewQ = ctx.preview ? "&preview=1" : "";
  const href = (label: string) => `${ctx.trackingBasePath}/ir?label=${encodeURIComponent(label)}${previewQ}`;
  const registroAction = `${ctx.trackingBasePath}/registro${ctx.preview ? "?preview=1" : ""}`;

  const withPhoto = clientProducts(ctx.products, { requirePhoto: true, max: 10 });
  const byId = new Map(content.items.map((i) => [i.productId, i]));
  const items = withPhoto.map((p) => {
    const x = byId.get(p.id);
    return {
      id: p.id,
      name: p.name,
      img: p.frames[0],
      price: p.price,
      cur: p.currency,
      zone: x?.zone ?? p.category ?? "",
      tag: p.soldOut ? "AGOTADO" : p.badge ?? "",
      what: x?.what ?? p.desc,
      res: x?.results ?? "",
      dur: x?.duration ?? "",
      ses: x?.sessions ?? "",
      after: x?.after ?? "",
      pack: x?.pack ?? "",
    };
  });
  const hasItems = items.length > 0;
  const star = items[0]?.img ?? null;
  const brandName = content.brand.name.trim() || ctx.businessName;
  const brandWord = brandName.split(/\s+/)[0].slice(0, 12).toUpperCase();
  const collectionTitle = content.collection.title || `${items.length} ${items.length === 1 ? "opción" : "opciones"}. Una sola marca.`;

  const clientData: StoryClientData = { items, collectionTitle, months: MONTHS };

  const ticker = content.ticker.map((t) => t.trim()).filter(Boolean).slice(0, 6);
  const tickerHtml = ticker.length
    ? `<div class="ticker" aria-label="Anuncios"><div class="tk-track">${ticker.map((t) => `<span>${esc(t)}</span>`).join("")}${ticker.map((t) => `<span aria-hidden="true">${esc(t)}</span>`).join("")}</div></div>`
    : "";

  const anchor = (rot: number, last = false) => (star ? `<div class="anchor" data-anchor data-rot="${rot}"${last ? " data-last" : ""}><img src="${esc(star)}" alt=""></div>` : "");

  const h = content.hero;
  const trust = h.trust.filter((t) => t.text).slice(0, 3);
  const heroHtml = `<section class="hero${star ? "" : " solo"}" id="inicio" aria-label="Inicio"><div class="word" aria-hidden="true">${esc(brandWord)}</div><div class="wrap">
      <div class="hero-copy">${h.kicker ? `<span class="mono" style="color:var(--muted)">${esc(h.kicker)}</span>` : ""}<h1 class="display">${esc(h.title)}</h1>${h.text ? `<p>${esc(h.text)}</p>` : ""}
        <div class="row"><a class="btn" href="#agenda">${esc(h.primaryCta)} ${ARROW}</a>${hasItems ? `<a class="link" href="#coleccion">${esc(h.secondaryCta)} ${ARROW}</a>` : ""}</div>
        ${trust.length ? `<div class="trust">${trust.map((t) => `<span>${iconSvg(t.icon)}${esc(t.text)}</span>`).join("")}</div>` : ""}</div>
      ${star ? `<div class="anchor" data-anchor data-rot="-14"><img src="${esc(star)}" alt="${esc(items[0].name)}"></div>` : ""}
    </div></section>`;

  const r = content.ritual;
  const benefits = r.benefits.filter((b) => b.title).slice(0, 3);
  const swatches = ["d1", "d4", "d2"];
  const spec = r.spec.filter(Boolean).slice(0, 2);
  const ritualHtml =
    r.title || benefits.length
      ? `<section class="ritual${star ? "" : " noanchor"}" id="ritual" aria-label="El ritual"><div class="wrap">
        <div style="display:flex;flex-direction:column;gap:18px"><span class="mono count">01<i></i></span><h2 class="display">${esc(r.title)}</h2>${r.text ? `<p>${esc(r.text)}</p>` : ""}${content.inside ? `<a class="link" href="#ingredientes">${esc(r.link)} ${ARROW}</a>` : ""}</div>
        ${anchor(0)}
        <ul class="reveal benefits">${benefits.map((b, i) => `<li><span class="mono" style="color:var(--muted)">${String(i + 1).padStart(2, "0")}</span><span><b>${esc(b.title)}</b><small>${esc(b.text)}</small></span><span class="swatch ${swatches[i]}"></span></li>`).join("")}</ul>
      </div>${spec.length ? `<div class="wrap spec-line mono">${spec.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}</section>`
      : "";

  const rows = content.marquee.rows.filter(Boolean).slice(0, 2);
  const tags = content.marquee.tags.filter(Boolean).slice(0, 3);
  const mq = (text: string, rev: boolean) => `<div class="mq${rev ? " rev" : ""}" aria-hidden="true">${Array.from({ length: 4 }, () => `<span>${esc(text)} ·</span>`).join("")}</div>`;
  const marqueeHtml = rows.length
    ? `<section class="marquee" aria-label="${esc(rows.join(". "))}">${rows.map((t, i) => mq(t, i % 2 === 1)).join("")}${anchor(8)}${tags.length ? `<div class="tags mono">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""}</section>`
    : "";

  const ins = content.inside;
  const ingItems = ins ? ins.items.filter((i) => i.title).slice(0, 4) : [];
  const drops = ["d3", "d1", "d2", "d4"];
  const spots = [
    'style="left:0;top:6%"',
    'style="right:0;top:6%;flex-direction:row-reverse;text-align:right"',
    'style="left:0;bottom:6%"',
    'style="right:0;bottom:6%;flex-direction:row-reverse;text-align:right"',
  ];
  const insideHtml =
    ins && ingItems.length
      ? `<section class="inside" id="ingredientes" aria-label="${esc(ins.title)}"><div class="wrap">
        <div style="display:flex;flex-direction:column;gap:18px"><span class="mono count">02<i></i></span><h2 class="display">${esc(ins.title)}</h2>${ins.text ? `<p>${esc(ins.text)}</p>` : ""}${hasItems ? `<a class="link" href="#coleccion">${esc(h.secondaryCta)} ${ARROW}</a>` : ""}</div>
        <div class="lab"><svg class="wires" viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden="true"><path d="M30 18 C 55 18, 62 34, 72 42"/><path d="M130 18 C 106 18, 98 34, 88 42"/><path d="M30 82 C 55 82, 62 66, 72 58"/><path d="M130 82 C 106 82, 98 66, 88 58"/></svg>
          ${ingItems.map((it, i) => `<div class="ing" ${spots[i]}><span class="drop ${drops[i]}"></span><span><span class="mono">${String(i + 1).padStart(2, "0")}</span><b>${esc(it.title)}</b><small>${esc(it.text)}</small></span></div>`).join("")}
          ${anchor(-6, true)}</div></div></section>`
      : "";

  const collectionHtml = hasItems
    ? `<section class="collection" id="coleccion" aria-label="${esc(content.collection.kicker)}"><div class="wrap"><span class="mono">· ${esc(content.collection.kicker)} ·</span><h2 class="display" id="colTitle" style="margin-top:14px"></h2>
        <div class="fan" id="fan" tabindex="0" role="region" aria-roledescription="carrusel" aria-label="Colección. Usa las flechas para moverte."></div>
        <div class="fan-ctrl"><button class="round" id="fPrev" type="button" aria-label="Anterior"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button><div class="dots" id="fDots" aria-hidden="true"></div><button class="round" id="fNext" type="button" aria-label="Siguiente"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></div>
      </div></section>`
    : "";

  const pr = content.promo;
  const clock = pr.countdown
    ? `<div class="clock" aria-label="Tiempo restante de la promoción">${[["d", "días"], ["h", "horas"], ["m", "min"], ["s", "seg"]].map(([k, l]) => `<div><b id="cd-${k}">00</b><span>${l}</span></div>`).join("")}</div>`
    : "";
  const art = withPhoto.length
    ? `<div class="promo-art${withPhoto.length < 3 ? " one" : ""}" id="promoArt" aria-hidden="true">${withPhoto.length >= 3 ? `<img class="pa a1" src="${esc(withPhoto[1].frames[0])}" alt="">` : ""}<img class="pa a2" src="${esc(withPhoto[0].frames[0])}" alt="">${withPhoto.length >= 3 ? `<img class="pa a3" src="${esc(withPhoto[2].frames[0])}" alt="">` : ""}${pr.stamp ? `<span class="stamp">${esc(pr.stamp)}</span>` : ""}</div>`
    : "";
  const promoHtml = pr.title
    ? `<section class="promo-wrap" aria-label="Promoción del mes"><div class="wrap"><div class="promo reveal${art ? "" : " solo"}" id="promo"><span class="glow" aria-hidden="true"></span><span class="pb p1" aria-hidden="true"></span><span class="pb p2" aria-hidden="true"></span>
        <div class="promo-copy"><span class="mono promo-tag"><i></i><span>${withMonth(pr.tag)}</span></span><h3 class="display">${withMonth(pr.title)}</h3>${pr.text ? `<p>${esc(pr.text)}</p>` : ""}${clock}<a class="btn" href="#agenda">${esc(pr.cta)} ${ARROW}</a></div>${art}</div></div></section>`
    : "";

  const v = content.visit;
  const steps = v.steps.filter((s) => s.title).slice(0, 3);
  const visitHtml = steps.length
    ? `<section class="visit" id="primera-visita"><div class="wrap"><div style="display:flex;flex-direction:column;gap:16px"><span class="mono count">03<i></i></span><h2 class="display">${esc(v.title)}</h2>${v.text ? `<p style="color:var(--muted);margin:0">${esc(v.text)}</p>` : ""}</div>
        <ol class="reveal steps">${steps.map((s) => `<li><b>${esc(s.title)}</b><span>${esc(s.text)}</span>${s.meta ? `<span class="mono">${esc(s.meta)}</span>` : ""}</li>`).join("")}</ol></div></section>`
    : "";

  const b = content.book;
  const facts = b.facts.filter((f) => f.label && f.text).slice(0, 3);
  const formHtml = ctx.leadSubmitted
    ? `<div><p class="ok">¡Listo! Recibimos tu solicitud y te escribimos muy pronto.</p><p style="margin:16px 0 0"><a class="btn light" href="${esc(href("registro-ok"))}">Escribir por WhatsApp</a></p></div>`
    : `<form class="form" id="bookForm" method="POST" action="${esc(registroAction)}" novalidate>${HONEYPOT_HTML}
          <input type="hidden" name="message" id="f-msg" value="">
          ${hasItems ? `<div class="field full"><label class="lbl" for="f-tx">Lo que te interesa</label><select id="f-tx"></select></div>` : ""}
          <div class="field"><label class="lbl" for="f-date">Día</label><input id="f-date" type="date"></div>
          <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="lbl" style="margin-bottom:6px">Franja</legend><div class="seg"><label><input type="radio" name="franja" id="fr-am" value="mañana" checked>Mañana</label><label><input type="radio" name="franja" id="fr-pm" value="tarde">Tarde</label></div></fieldset>
          <div class="field"><label class="lbl" for="f-name">Nombre</label><input id="f-name" name="name" type="text" autocomplete="name" placeholder="Nombre y apellido"></div>
          <div class="field"><label class="lbl" for="f-phone">Celular</label><input id="f-phone" name="contact" type="tel" inputmode="tel" autocomplete="tel" placeholder="300 000 0000"></div>
          <label class="check full" for="f-ok"><input id="f-ok" name="consent" value="1" type="checkbox"><span>Autorizo el tratamiento de mis datos para que me contacten sobre esta cita (Ley 1581 de 2012).</span></label>
          <div class="full"><button class="btn light" type="submit" style="width:100%;justify-content:center">${esc(b.button)}</button></div>
          <div class="ok full" id="ok" hidden role="status"></div></form>`;
  const bookHtml = `<section class="book" id="agenda"><div class="wrap"><div class="reveal book-card"><div><span class="mono count" style="color:var(--deep-muted)">04<i></i></span><h2 class="display" style="margin-top:16px">${esc(b.title)}</h2>${b.text ? `<p>${esc(b.text)}</p>` : ""}
        ${facts.length ? `<div class="facts">${facts.map((f) => `<div><span class="mono">${esc(f.label)}</span><span>${esc(f.text)}</span></div>`).join("")}</div>` : ""}</div>
        ${formHtml}</div></div></section>`;

  const sheet = hasItems
    ? `<dialog class="sheet" id="sheet" aria-labelledby="s-name"><div class="sheet-grid"><div class="sheet-art"><div id="s-art"></div><div class="sheet-nav"><button class="round" id="s-prev" type="button" aria-label="Anterior"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button><button class="round" id="s-next" type="button" aria-label="Siguiente"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button></div></div>
        <div class="sheet-info"><button class="round x" id="s-close" type="button" aria-label="Cerrar"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1 1 11" stroke="currentColor" stroke-width="1.6"/></svg></button><span class="mono" id="s-count" style="color:var(--muted)"></span><h3 id="s-name"></h3><span class="sub" id="s-sub"></span>
        <div class="tabs" role="tablist" aria-label="Detalle"><button type="button" role="tab" id="t-que" aria-controls="s-panel" aria-selected="true">Qué es</button><button type="button" role="tab" id="t-res" aria-controls="s-panel" aria-selected="false">Resultados</button><button type="button" role="tab" id="t-inv" aria-controls="s-panel" aria-selected="false">Inversión</button></div>
        <div class="panel" id="s-panel" role="tabpanel"></div><button class="btn" id="s-book" type="button" style="justify-content:center">Agendar para este</button></div></div></dialog>`
    : "";

  const navLinks = [ritualHtml ? '<a href="#ritual">El ritual</a>' : "", insideHtml ? '<a href="#ingredientes">Ingredientes</a>' : "", collectionHtml ? `<a href="#coleccion">${esc(content.collection.kicker)}</a>` : ""].join("");
  const fontsHref = `https://fonts.googleapis.com/css2?${TEMPLATE_FONTS.story.map((f, i) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}${i === 0 ? ":ital@0;1" : i === 1 ? ":wght@400;500;600" : ":wght@400;500"}`).join("&")}&display=swap`;
  const css = `${STORY_CSS}:root{--accent:${accent};--accent-ink:${accentInk}}`;

  return `<!doctype html>
<html lang="es"${ctx.edit ? ' data-fx="off"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>${esc(brandName)}${content.hero.title ? ` · ${esc(content.hero.title)}` : ""}</title>
<meta name="description" content="${esc(content.hero.text || brandName)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(fontsHref)}">
<style>${css}</style>
</head>
<body>
<header class="top" id="top">${tickerHtml}<div class="wrap"><nav class="links" aria-label="Secciones">${navLinks}</nav><a class="logo" href="#inicio">${esc(brandWord)}</a><a class="btn" href="#agenda">${esc(h.primaryCta)}</a></div></header>
${star ? `<img id="flyer" src="${esc(star)}" alt="" aria-hidden="true">` : ""}
<main>
${heroHtml}
${ritualHtml}
${marqueeHtml}
${insideHtml}
${collectionHtml}
${promoHtml}
${visitHtml}
${bookHtml}
</main>
<footer><div class="big" aria-hidden="true">${esc(brandWord)}</div><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(brandName)}${content.footer ? ` · ${esc(content.footer)}` : ""}</span><a href="${esc(href("footer"))}">Escríbenos por WhatsApp</a></div></footer>
${sheet}
<noscript><style>.reveal.pre{opacity:1;transform:none}</style></noscript>
<script type="application/json" id="site-data">${jsonForHtml(clientData)}</script>
<script>${storyScript()}</script>
</body>
</html>`;
}
