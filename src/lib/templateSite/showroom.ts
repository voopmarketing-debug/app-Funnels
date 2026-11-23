import { HONEYPOT_HTML } from "@/lib/honeypot";
import { ensureContrast } from "@/lib/colorContrast";
import type { CatalogProduct } from "@/lib/websiteContentV2";
import { TEMPLATE_FONTS, type ShowroomContent } from "./content";
import type { ShowroomClientData } from "./showroomClient";
import { SHOWROOM_CLIENT_SOURCE } from "./clientScripts.generated";
import { ICON_PATHS, clientProducts, esc, iconSvg, jsonForHtml, withMonth, MONTHS, formatMoney } from "./shared";

// The Showroom template: a light studio catalog. Portada with a 360° viewer and feature bubbles,
// a row of key facts, the month's promotion, a budget quoter with progress bars, a services bento
// and a test-drive / visit form. Ported from the hand-designed template; the data comes from the
// catalog and from the texts the AI wrote (content.ts).

export const SHOWROOM_CSS = `
:root{--bg:#ffffff;--surface:#ffffff;--soft:#f5f6f8;--panel:#eceef1;--ink:#0f1012;--muted:#6b7078;--line:#e1e3e7;--ok:#17845a;--warn:#b86412;--on-ink:#ffffff;--floor:rgba(15,16,18,.28);
--f-display:"Manrope",system-ui,-apple-system,sans-serif;--f-body:"Inter Tight",system-ui,-apple-system,sans-serif;--f-mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;color-scheme:light}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}
.wrap{max-width:1280px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
a{color:inherit}
button{font:inherit;color:inherit;cursor:pointer}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:8px}
.mono{font-family:var(--f-mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.ico{width:20px;height:20px;flex:none}
header.top{position:sticky;top:env(safe-area-inset-top,0px);z-index:20;background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(12px)}
header.top .wrap{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px;padding-block:16px}
nav.links{display:flex;gap:24px;align-items:center}
.logo-dot{width:34px;height:34px;border-radius:50%;background:var(--ink);color:var(--on-ink);display:grid;place-items:center;flex:none}
nav.links a{text-decoration:none;font-size:14px;color:var(--muted)}
nav.links a:hover{color:var(--ink)}
.brand{font-family:var(--f-display);font-weight:600;letter-spacing:.42em;font-size:15px;text-decoration:none;text-align:center;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.pill{white-space:nowrap;display:inline-flex;align-items:center;gap:10px;border-radius:999px;padding:12px 20px;font-weight:600;font-size:14px;text-decoration:none;border:0;background:var(--ink);color:var(--on-ink);transition:transform .2s,opacity .2s}
.pill:hover{opacity:.88}
.pill:active{transform:scale(.97)}
.pill .ico{width:16px;height:16px}
header .pill{justify-self:end}
.ghost{display:inline-flex;align-items:center;gap:8px;font-weight:500;font-size:14px;text-decoration:none;border:0;background:none;padding:10px 4px;color:var(--muted)}
.ghost:hover{color:var(--ink)}
.hero .wrap{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,8fr);gap:48px;align-items:center;padding-block:40px 32px}
.hero.solo .wrap{grid-template-columns:minmax(0,1fr);padding-block:80px 56px}
.hero-copy{display:flex;flex-direction:column;gap:18px;min-width:0}
h1{margin:0;font-family:var(--f-display);font-weight:700;font-size:clamp(32px,4vw,52px);line-height:1;letter-spacing:-.035em;text-wrap:balance}
.hero-copy p{margin:0;color:var(--muted);max-width:34ch}
.hero-actions{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.viewer{position:relative;border-radius:30px;background:radial-gradient(ellipse 70% 60% at 55% 55%,#ffffff,var(--panel) 80%);overflow:hidden;min-width:0}
.viewer-top{position:absolute;top:18px;left:20px;right:20px;display:flex;justify-content:space-between;align-items:center;z-index:3;gap:12px}
.car-name{font-family:var(--f-display);font-weight:700;font-size:20px;letter-spacing:-.01em}
.car-name small{display:block;font-family:var(--f-body);font-weight:400;font-size:13px;color:var(--muted);letter-spacing:0}
.badge360{display:inline-flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:7px 12px;font-size:12px;font-weight:600;white-space:nowrap}
.badge360 .ico{width:16px;height:16px}
.stage{position:relative;margin-top:56px;height:clamp(340px,36vw,480px);touch-action:pan-y;cursor:grab;user-select:none;-webkit-user-select:none;perspective:1400px}
.stage.drag{cursor:grabbing}
.car{position:absolute;left:50%;bottom:16%;width:min(84%,820px);max-height:70%;transform:translateX(-50%);aspect-ratio:var(--ar,16/7);transition:opacity .45s}
.car .spin{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.stage.drag .car .spin{transition:none}
.car img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;-webkit-user-drag:none;user-select:none}
.car::after{content:"";position:absolute;left:6%;right:6%;bottom:-4%;height:10%;border-radius:50%;background:radial-gradient(closest-side,var(--floor),transparent);z-index:-1;filter:blur(5px)}
.car.enter{animation:enter .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes enter{from{opacity:0;transform:translateX(-42%) scale(.96)}}
.bubbles{position:absolute;inset:0;pointer-events:none;z-index:4}
.bubbles-m{display:none}
.bubble{position:absolute;z-index:4;pointer-events:auto;min-width:150px;max-width:210px;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:10px 13px;font-size:13px;line-height:1.35;box-shadow:0 14px 30px -16px var(--floor);transform:translate(var(--tx),calc(-100% - 16px));animation:pop .45s cubic-bezier(.2,1.3,.4,1) both;animation-delay:calc(var(--d) * 140ms + 250ms);transition:opacity .25s}
.bubble.down{transform:translate(var(--tx),16px)}
.bubble b{display:block;font-weight:600;font-size:13px}
.bubble span{color:var(--muted)}
.bubble::after{content:"";position:absolute;left:var(--tail);bottom:-7px;width:12px;height:12px;background:var(--surface);border-right:1px solid var(--line);border-bottom:1px solid var(--line);transform:translateX(-50%) rotate(45deg)}
.bubble.down::after{bottom:auto;top:-7px;transform:translateX(-50%) rotate(225deg)}
@keyframes pop{from{opacity:0;scale:.6}}
.stage.drag .bubble,.stage.turned .bubble{opacity:0}
.hint{position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;align-items:center;gap:10px;color:var(--muted);z-index:3;pointer-events:none}
.hint i{display:block;width:120px;height:3px;border-radius:3px;background:var(--line);position:relative;overflow:hidden}
.hint i::after{content:"";position:absolute;top:0;bottom:0;width:30%;left:var(--hp,35%);background:var(--ink);border-radius:3px;transition:left .2s}
.chips{display:flex;gap:8px;padding:0 0 4px;margin-top:14px;overflow-x:auto;scrollbar-width:none}
.chip{flex:none;display:flex;align-items:center;gap:10px;border:1px solid var(--line);background:var(--surface);border-radius:14px;padding:8px 14px 8px 8px;text-align:left}
.chip img{width:64px;height:28px;object-fit:contain}
.chip b{display:block;font-size:13px;font-weight:600}
.chip small{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums}
.chip[aria-pressed="true"]{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink)}
.stats .wrap{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));padding-block:16px 72px;gap:16px}
.stat{display:flex;align-items:center;gap:14px;background:var(--soft);border-radius:20px;padding:22px 24px;min-width:0}
.stat .ico{width:28px;height:28px;color:var(--muted)}
.stat small{display:block;color:var(--muted);font-size:12px}
.stat b{font-family:var(--f-display);font-weight:700;font-size:clamp(22px,2.2vw,30px);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
section{scroll-margin-top:84px}
.alt{background:var(--soft)}
.eyebrow{color:var(--muted);display:flex;gap:10px;align-items:center}
h2{margin:6px 0 4px;font-family:var(--f-display);font-weight:700;font-size:clamp(26px,3vw,38px);line-height:1;letter-spacing:-.03em;text-wrap:balance}
.lead{margin:0;color:var(--muted);max-width:44ch}
.sec-head{display:flex;flex-direction:column;gap:6px;max-width:640px;margin-bottom:44px}
.quote .wrap{display:block;padding-block:104px}
.quote-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:32px;align-items:start}
.budget{background:var(--surface);border:1px solid var(--line);border-radius:26px;padding:30px;display:grid;gap:24px;position:sticky;top:90px;box-shadow:0 20px 40px -30px var(--floor)}
.mode{display:flex;background:var(--soft);border-radius:999px;padding:4px}
.mode button{flex:1;border:0;background:none;border-radius:999px;padding:9px 10px;font-size:14px;font-weight:500;color:var(--muted)}
.mode button[aria-pressed="true"]{background:var(--surface);color:var(--ink);box-shadow:0 2px 8px -4px var(--floor)}
.amount{font-family:var(--f-display);font-weight:800;font-size:clamp(30px,3.2vw,40px);letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}
.amount small{display:block;font-family:var(--f-body);font-weight:400;font-size:13px;letter-spacing:0;color:var(--muted);margin-top:8px}
input[type=range].bar{-webkit-appearance:none;appearance:none;width:100%;height:14px;border-radius:999px;background:linear-gradient(90deg,var(--accent) 0 var(--p,50%),var(--bg) var(--p,50%));border:1px solid var(--line);margin:0;cursor:pointer}
input[type=range].bar::-webkit-slider-thumb{-webkit-appearance:none;width:28px;height:28px;border-radius:50%;background:var(--surface);border:2px solid var(--accent);box-shadow:0 4px 12px -4px var(--floor)}
input[type=range].bar::-moz-range-thumb{width:26px;height:26px;border-radius:50%;background:var(--surface);border:2px solid var(--accent)}
.scale{display:flex;justify-content:space-between;color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums;margin-top:12px}
.quick{display:flex;gap:8px;flex-wrap:wrap}
.quick button{border:1px solid var(--line);background:var(--soft);border-radius:999px;padding:7px 12px;font-size:13px;font-variant-numeric:tabular-nums}
.quick button:hover{border-color:var(--ink)}
.reach{background:var(--soft);border-radius:16px;padding:14px 16px;font-size:14px}
.reach b{font-variant-numeric:tabular-nums}
.results{display:grid;gap:14px}
.res-head{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:6px}
.res-head b{font-family:var(--f-display);font-size:20px}
.res{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:20px 22px;display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:10px 22px;align-items:center;transition:opacity .3s,border-color .3s;box-shadow:0 14px 30px -28px var(--floor)}
.res img{width:150px;height:56px;object-fit:contain;grid-row:span 2}
.res .nm{font-weight:600}
.res .nm small{display:block;font-weight:400;color:var(--muted);font-size:13px}
.res .pr{text-align:right;font-family:var(--f-display);font-weight:700;font-size:18px;font-variant-numeric:tabular-nums}
.res .pr small{display:block;font-family:var(--f-body);font-weight:400;font-size:12px;color:var(--muted)}
.res .track{grid-column:2/3;height:8px;border-radius:8px;background:var(--bg);overflow:hidden;position:relative}
.res .track i{position:absolute;left:0;top:0;bottom:0;width:var(--w);border-radius:8px;background:var(--ok);transition:width .5s cubic-bezier(.2,.8,.2,1),background .3s}
.res.over .track i{background:var(--warn)}
.res .verdict{font-size:13px;color:var(--ok);font-weight:500;white-space:nowrap}
.res.over .verdict{color:var(--warn)}
.res.over{opacity:.72}
.res .see{grid-column:2/4;justify-self:start;padding:2px 0}
.bento .wrap{display:block;padding-block:104px}
.feat-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:16px}
.fcard{background:var(--soft);border-radius:24px;padding:28px;display:flex;flex-direction:column;gap:10px;min-width:0}
.fcard b{font-family:var(--f-display);font-weight:700;font-size:20px;letter-spacing:-.01em;margin-top:8px}
.fcard span:last-child{color:var(--muted)}
.fic{width:44px;height:44px;border-radius:14px;background:var(--surface);border:1px solid var(--line);display:grid;place-items:center;color:var(--ink)}
.trade-row{display:grid;grid-template-columns:minmax(0,8fr) minmax(0,4fr);gap:16px}
.trade-row.solo{grid-template-columns:minmax(0,1fr)}
.tall{position:relative;border-radius:26px;overflow:hidden;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);align-items:center;gap:20px;padding:36px;background:linear-gradient(135deg,#eef1f6,#f8f9fb 60%,#e9edf3)}
.tall.noimg{grid-template-columns:minmax(0,1fr)}
.tall-copy{display:flex;flex-direction:column;gap:12px;align-items:flex-start;min-width:0}
.tall-copy h3{margin:0;font-family:var(--f-display);font-weight:700;font-size:clamp(26px,2.6vw,34px);line-height:1.05;letter-spacing:-.02em}
.tall-copy p{margin:0 0 6px;color:var(--muted)}
.tall-img{min-width:0}
.tall-img img{width:100%;height:auto;max-height:260px;object-fit:contain;display:block;filter:drop-shadow(0 22px 18px rgba(15,16,18,.22))}
.side{display:grid;gap:16px;min-width:0;grid-template-rows:repeat(3,1fr)}
.card{background:var(--soft);border-radius:22px;padding:22px 24px;display:flex;flex-direction:column;gap:6px;justify-content:center}
.card .ico{color:var(--muted)}
.card b{font-family:var(--f-display);font-weight:700;font-size:26px;letter-spacing:-.02em}
.card span{color:var(--muted);font-size:13px}
.book .wrap{display:block;padding-block:104px}
.book-grid{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,7fr);gap:32px;align-items:start}
.book-grid.solo{grid-template-columns:minmax(0,1fr);max-width:720px}
.where{margin:0;display:grid;gap:14px}
.where > div{background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:20px 22px;display:grid;grid-template-columns:auto 1fr;column-gap:16px;row-gap:2px;align-items:center}
.where .fic{grid-row:span 2}
.where .mono{color:var(--muted)}
form.form{background:var(--surface);border:1px solid var(--line);border-radius:26px;padding:32px;display:grid;grid-template-columns:1fr 1fr;gap:18px;box-shadow:0 20px 40px -30px var(--floor)}
.field{display:flex;flex-direction:column;gap:6px;min-width:0}
.full{grid-column:1/-1}
label.lbl{font-size:12px;font-weight:500;color:var(--muted)}
input:not([type=range]):not([type=checkbox]),select{font:inherit;color:var(--ink);background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:12px;width:100%;min-width:0}
input:focus,select:focus{outline:none;border-color:var(--accent)}
.check{display:flex;flex-direction:row;gap:10px;align-items:flex-start;font-size:13px;color:var(--muted)}
.check input{width:18px;height:18px;margin-top:2px;accent-color:var(--ink);flex:none}
.ok{background:var(--bg);border-radius:14px;padding:14px;font-size:14px}
.ok[hidden]{display:none}
footer{border-top:1px solid var(--line);color:var(--muted);font-size:13px}
footer .wrap{padding-block:32px;display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between}
@media (max-width:980px){
  header.top .wrap{grid-template-columns:auto 1fr auto}
  nav.links a{display:none}
  .brand{text-align:left;letter-spacing:.14em;font-size:12px;line-height:1.25;white-space:normal;text-overflow:clip}
  .hero .wrap{grid-template-columns:minmax(0,1fr)}
  .quote-grid,.book-grid{grid-template-columns:minmax(0,1fr)}
  .budget{position:static}
  .feat-row{grid-template-columns:minmax(0,1fr)}
  .trade-row{grid-template-columns:minmax(0,1fr)}
  .tall{grid-template-columns:minmax(0,1fr)}
  .side{grid-template-columns:repeat(3,minmax(0,1fr));grid-template-rows:auto}
}
@media (max-width:640px){
  .stage{height:300px}
  .car{width:94%;bottom:22%}
  .bubbles{display:none}
  .bubbles-m{display:flex;flex-direction:column;gap:10px;margin-top:14px}
  .bubbles-m .bubble{position:relative;transform:none;max-width:86%;animation:none}
  .bubbles-m .bubble:nth-child(even){align-self:flex-end}
  .bubbles-m .bubble::after,.bubbles-m .bubble.down::after{left:22px;top:auto;bottom:-7px;transform:rotate(45deg)}
  .bubbles-m .bubble:nth-child(even)::after{left:auto;right:16px}
  .stats .wrap{grid-template-columns:minmax(0,1fr);padding-bottom:48px;gap:10px}
  .res{grid-template-columns:96px minmax(0,1fr);padding:14px}
  .res img{width:96px;height:40px;grid-row:auto}
  .res .pr{grid-column:1/-1;text-align:left}
  .res .track,.res .see{grid-column:1/-1}
  .quote .wrap,.bento .wrap,.book .wrap{padding-block:72px}
  .sec-head{margin-bottom:28px}
  .side{grid-template-columns:minmax(0,1fr)}
  .tall{padding:24px}
  .budget{padding:22px}
  form.form{grid-template-columns:minmax(0,1fr);padding:20px}
  .viewer-top{top:14px;left:14px;right:14px}
}
.ticker{background:var(--ink);color:var(--on-ink);overflow:hidden;font-size:12px;font-weight:500;letter-spacing:.02em}
.tk-track{display:flex;width:max-content;animation:tk 34s linear infinite}
.tk-track span{padding:8px 28px;white-space:nowrap;position:relative}
.tk-track span::after{content:"";position:absolute;right:-3px;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:var(--accent)}
.ticker:hover .tk-track{animation-play-state:paused}
@keyframes tk{to{transform:translateX(-50%)}}
.promo-wrap .wrap{padding-block:8px 96px}
.promo{position:relative;overflow:hidden;isolation:isolate;border-radius:32px;background:#0f1012;color:#fff;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:center;gap:24px;padding:clamp(28px,4vw,56px);min-height:380px}
.promo.solo{grid-template-columns:minmax(0,1fr)}
.promo .glow{position:absolute;z-index:-1;width:520px;height:520px;border-radius:50%;left:var(--gx,70%);top:var(--gy,50%);transform:translate(-50%,-50%);background:radial-gradient(circle,color-mix(in srgb,var(--accent) 55%,transparent),transparent 62%);transition:left .25s ease-out,top .25s ease-out;pointer-events:none}
.promo .sweep{position:absolute;z-index:-1;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.08) 50%,transparent 60%);background-size:250% 100%;animation:sweep 5s ease-in-out infinite;pointer-events:none}
@keyframes sweep{from{background-position:120% 0}to{background-position:-120% 0}}
.promo-copy{display:flex;flex-direction:column;gap:16px;align-items:flex-start;min-width:0}
.promo-copy h3{margin:0;font-family:var(--f-display);font-weight:800;font-size:clamp(26px,3vw,38px);line-height:1;letter-spacing:-.03em;text-wrap:balance}
.promo-copy p{margin:0;color:#b9bec7;max-width:40ch}
.promo-tag{display:inline-flex;align-items:center;gap:8px;color:color-mix(in srgb,var(--accent) 40%,#fff)}
.promo-tag i{width:8px;height:8px;border-radius:50%;background:color-mix(in srgb,var(--accent) 70%,#fff);animation:blink 1.8s infinite}
@keyframes blink{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 70%,transparent)}70%{box-shadow:0 0 0 10px transparent}100%{box-shadow:0 0 0 0 transparent}}
.clock{display:flex;gap:10px}
.clock div{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:10px 12px;min-width:64px;text-align:center}
.clock b{display:block;font-family:var(--f-display);font-weight:800;font-size:26px;line-height:1;font-variant-numeric:tabular-nums}
.clock span{font-size:11px;color:#9aa0a8}
.pill.light{background:#fff;color:#0f1012}
.promo-art{position:relative;min-width:0;transform:perspective(900px) rotateY(var(--ry,0deg)) rotateX(var(--rx,0deg));transition:transform .3s ease-out}
.promo-art img{position:relative;width:100%;height:auto;max-height:320px;object-fit:contain;display:block;filter:drop-shadow(0 30px 24px rgba(0,0,0,.6));animation:drive 1.2s cubic-bezier(.2,.8,.2,1) both paused}
.promo.in .promo-art img,.promo.nofx .promo-art img{animation-play-state:running}
@keyframes drive{from{transform:translateX(60%);opacity:0}}
.promo-art .lines{position:absolute;left:-10%;right:30%;top:30%;height:40%;background:repeating-linear-gradient(180deg,transparent 0 14px,rgba(255,255,255,.12) 14px 15px);-webkit-mask-image:linear-gradient(90deg,transparent,#000 60%,transparent);mask-image:linear-gradient(90deg,transparent,#000 60%,transparent);animation:speed 1.2s linear infinite}
@keyframes speed{from{transform:translateX(30px)}to{transform:translateX(-30px)}}
.stamp{position:absolute;right:4%;top:-6%;width:96px;height:96px;border-radius:50%;background:var(--accent);color:var(--accent-on);display:grid;place-items:center;text-align:center;padding:6px;font-family:var(--f-display);font-weight:800;font-size:20px;transform:rotate(-12deg);animation:bob 3s ease-in-out infinite;box-shadow:0 14px 30px -10px color-mix(in srgb,var(--accent) 80%,transparent)}
@keyframes bob{50%{transform:rotate(-6deg) translateY(-8px)}}
.reveal.pre{opacity:0;transform:translateY(28px)}
.reveal{transition:opacity .8s cubic-bezier(.2,.8,.2,1),transform .8s cubic-bezier(.2,.8,.2,1)}
@media (max-width:980px){.promo{grid-template-columns:minmax(0,1fr)}.stamp{width:76px;height:76px;font-size:16px}}
@media (max-width:640px){.clock div{min-width:0;flex:1;padding:8px 6px}.clock b{font-size:22px}.promo-wrap .wrap{padding-bottom:64px}}
@media (prefers-reduced-motion:reduce){.tk-track,.promo .sweep,.promo-art .lines,.stamp,.promo-tag i,.bubble,.car.enter{animation:none}.promo-art img{animation:none}.reveal.pre{opacity:1;transform:none}.car .spin,.res .track i{transition:none}html{scroll-behavior:auto}}
`;

export type ShowroomRenderCtx = {
  businessName: string;
  trackingBasePath: string;
  preview?: boolean;
  leadSubmitted?: boolean;
  products: CatalogProduct[];
  edit?: boolean;
};

/** The page script's source: the client function applied to the page data. Hashed per page for the policy. */
export function showroomScript(): string {
  return `(${SHOWROOM_CLIENT_SOURCE})(JSON.parse(document.getElementById("site-data").textContent));`;
}

const ICON_KEYS_FOR_CLIENT = Object.keys(ICON_PATHS);

export function renderShowroom(content: ShowroomContent, ctx: ShowroomRenderCtx): string {
  const accent = /^#[0-9a-fA-F]{6}$/.test(content.brand.accent) ? content.brand.accent : "#3457ff";
  const accentOn = ensureContrast("#ffffff", accent, 4.5) === "#ffffff" ? "#ffffff" : "#0f1012";
  const previewQ = ctx.preview ? "&preview=1" : "";
  const href = (label: string) => `${ctx.trackingBasePath}/ir?label=${encodeURIComponent(label)}${previewQ}`;
  const registroAction = `${ctx.trackingBasePath}/registro${ctx.preview ? "?preview=1" : ""}`;

  const cps = clientProducts(ctx.products, { requirePhoto: true, max: 8 });
  const byId = new Map(content.items.map((i) => [i.productId, i]));
  const fallbackStats = (p: (typeof cps)[number]): [string, string, string][] => {
    const out: [string, string, string][] = [];
    if (p.price !== null) out.push(["tag", "Precio", formatMoney(p.price, p.currency)]);
    if (p.category) out.push(["box", "Categoría", p.category]);
    return out.slice(0, 3);
  };
  const cars = cps.map((p) => {
    const extra = byId.get(p.id);
    const stats = (extra?.stats ?? []).filter((s) => s.label && s.value).slice(0, 3).map((s) => [s.icon, s.label, s.value] as [string, string, string]);
    return {
      id: p.id,
      model: p.name,
      sub: extra?.sub ?? p.category ?? "",
      frames: p.frames,
      price: p.price,
      cur: p.currency,
      stats: stats.length ? stats : fallbackStats(p),
      bubbles: (extra?.bubbles ?? []).filter((b) => b.title).slice(0, 3).map((b) => ({ t: b.title, d: b.text })),
    };
  });
  const hasCars = cars.length > 0;
  const pricedCount = cars.filter((c) => c.price !== null).length;
  const showQuote = pricedCount >= 2;
  const heroPhoto = cars[0]?.frames[0] ?? null;
  const tradePhoto = (cars[1] ?? cars[0])?.frames[0] ?? null;
  const noun = content.noun || "producto";
  const brandWord = content.brand.name.trim() || ctx.businessName;

  const clientData: ShowroomClientData = {
    cars,
    icons: Object.fromEntries(ICON_KEYS_FOR_CLIENT.map((k) => [k, ICON_PATHS[k as keyof typeof ICON_PATHS]])),
    fin: { months: content.quote.months, rate: content.quote.ratePct ?? 0, down: content.quote.downPct },
    noun,
    months: MONTHS,
  };

  const ticker = content.ticker.map((t) => t.trim()).filter(Boolean).slice(0, 6);
  const tickerHtml = ticker.length
    ? `<div class="ticker" aria-label="Anuncios"><div class="tk-track">${ticker.map((t) => `<span>${esc(t)}</span>`).join("")}${ticker.map((t) => `<span aria-hidden="true">${esc(t)}</span>`).join("")}</div></div>`
    : "";

  const arrow = `<svg class="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h11M11 5l5 5-5 5"/></svg>`;
  const pr = content.promo;
  const clock = pr.countdown
    ? `<div class="clock" aria-label="Tiempo restante de la promoción">${[["d", "días"], ["h", "horas"], ["m", "min"], ["s", "seg"]].map(([k, l]) => `<div><b id="cd-${k}">00</b><span>${l}</span></div>`).join("")}</div>`
    : "";
  const promoArt = heroPhoto
    ? `<div class="promo-art" id="promoArt"><span class="lines" aria-hidden="true"></span><img src="${esc(heroPhoto)}" alt="" loading="lazy">${pr.stamp ? `<span class="stamp" aria-hidden="true">${esc(pr.stamp)}</span>` : ""}</div>`
    : "";
  const promoHtml = pr.title
    ? `<section class="promo-wrap" aria-label="Promoción del mes"><div class="wrap"><div class="promo reveal${promoArt ? "" : " solo"}" id="promo"><span class="glow" aria-hidden="true"></span><span class="sweep" aria-hidden="true"></span>
        <div class="promo-copy"><span class="mono promo-tag"><i></i><span>${withMonth(pr.tag)}</span></span><h3>${withMonth(pr.title)}</h3>${pr.text ? `<p>${esc(pr.text)}</p>` : ""}${clock}<a class="pill light" href="#prueba">${esc(pr.cta)} ${arrow}</a></div>
        ${promoArt}</div></div></section>`
    : "";

  const sv = content.services;
  const cards = sv.cards.filter((c) => c.title).slice(0, 3);
  const side = sv.side.filter((c) => c.value && c.label).slice(0, 3);
  const trade = sv.trade;
  const bentoHtml =
    cards.length || trade
      ? `<section class="bento" id="servicios"><div class="wrap">
        ${sv.title ? `<div class="reveal sec-head">${sv.kicker ? `<span class="mono eyebrow">${esc(sv.kicker)}</span>` : ""}<h2>${esc(sv.title)}</h2>${sv.text ? `<p class="lead">${esc(sv.text)}</p>` : ""}</div>` : ""}
        ${cards.length ? `<div class="feat-row">${cards.map((c) => `<article class="reveal fcard"><span class="fic">${iconSvg(c.icon)}</span><b>${esc(c.title)}</b><span>${esc(c.text)}</span></article>`).join("")}</div>` : ""}
        ${trade
          ? `<div class="trade-row${side.length ? "" : " solo"}"><div class="reveal tall${tradePhoto ? "" : " noimg"}"><div class="tall-copy">${trade.kicker ? `<span class="mono" style="color:var(--muted)">${esc(trade.kicker)}</span>` : ""}<h3>${esc(trade.title)}</h3>${trade.text ? `<p>${esc(trade.text)}</p>` : ""}<a class="pill" href="#prueba">${esc(trade.cta)} ${arrow}</a></div>${tradePhoto ? `<div class="tall-img"><img src="${esc(tradePhoto)}" alt="" loading="lazy"></div>` : ""}</div>
            ${side.length ? `<div class="side">${side.map((c) => `<div class="reveal card">${iconSvg(c.icon)}<b>${esc(c.value)}</b><span>${esc(c.label)}</span></div>`).join("")}</div>` : ""}</div>`
          : ""}
      </div></section>`
      : "";

  const vs = content.visit;
  const where = vs.where.filter((w) => w.label && w.text).slice(0, 3);
  const times = ["9:00 a. m.", "10:30 a. m.", "12:00 m.", "2:30 p. m.", "4:00 p. m.", "5:30 p. m."];
  const formHtml = ctx.leadSubmitted
    ? `<div class="reveal form" style="display:block"><p class="ok">¡Listo! Recibimos tu solicitud y te escribimos muy pronto.</p><p style="margin:16px 0 0"><a class="pill" href="${esc(href("registro-ok"))}">Escribir por WhatsApp</a></p></div>`
    : `<form class="reveal form" id="bookForm" method="POST" action="${esc(registroAction)}" novalidate>${HONEYPOT_HTML}
        <input type="hidden" name="message" id="f-msg" value="">
        ${hasCars ? `<div class="field full"><label class="lbl" for="f-car">${esc(noun.charAt(0).toUpperCase() + noun.slice(1))}</label><select id="f-car"></select></div>` : ""}
        <div class="field"><label class="lbl" for="f-date">Día</label><input id="f-date" type="date"></div>
        <div class="field"><label class="lbl" for="f-time">Hora preferida</label><select id="f-time">${times.map((t, i) => `<option${i === 2 ? " selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="field"><label class="lbl" for="f-name">Nombre</label><input id="f-name" name="name" type="text" autocomplete="name" placeholder="Nombre y apellido"></div>
        <div class="field"><label class="lbl" for="f-phone">Celular</label><input id="f-phone" name="contact" type="tel" inputmode="tel" autocomplete="tel" placeholder="300 000 0000"></div>
        ${showQuote ? `<div class="field full"><label class="lbl" for="f-bud">Presupuesto</label><input id="f-bud" type="text" readonly></div>` : ""}
        <label class="check full" for="f-ok"><input id="f-ok" name="consent" value="1" type="checkbox"><span>Autorizo el tratamiento de mis datos para que me contacten sobre esta solicitud (Ley 1581 de 2012).</span></label>
        <div class="full"><button class="pill" type="submit" style="width:100%;justify-content:center">${esc(vs.button)}</button></div>
        <div class="ok full" id="ok" hidden role="status"></div>
      </form>`;

  const num = (n: number) => String(n).padStart(2, "0");
  let n = 1;
  const quoteHtml = showQuote
    ? `<section class="quote alt" id="cotizador"><div class="wrap">
        <div class="reveal sec-head"><span class="mono eyebrow">${num(++n)} · ${esc(content.quote.kicker)}</span><h2>${esc(content.quote.title)}</h2><p class="lead">${esc(content.quote.text)}</p></div>
        <div class="quote-grid">
          <div class="reveal budget">
            <div class="mode" role="group" aria-label="Tipo de presupuesto"><button type="button" id="m-total" aria-pressed="true">Precio total</button><button type="button" id="m-cuota" aria-pressed="false">Cuota mensual</button></div>
            <div class="amount" id="amount" aria-live="polite"></div>
            <div><label class="mono" for="budget" style="color:var(--muted);display:block;margin-bottom:14px">Tu presupuesto</label><input class="bar" id="budget" type="range"><div class="scale"><span id="minTxt"></span><span id="maxTxt"></span></div></div>
            <div class="quick" id="quick" aria-label="Presupuestos frecuentes"></div>
            <div class="reach" id="reach"></div>
          </div>
          <div class="results" id="results" aria-live="polite"></div>
        </div></div></section>`
    : "";

  const heroViewer = hasCars
    ? `<div style="min-width:0"><div class="viewer"><div class="viewer-top"><div class="car-name" id="carName"></div><span class="badge360"><svg class="ico" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10a7 3.2 0 1 0 14 0a7 3.2 0 1 0 -14 0"/><path d="M14.5 6.2 17 7.2 15.8 9.5"/></svg>360°</span></div>
        <div class="stage" id="stage" tabindex="0" role="img" aria-roledescription="visor 360" aria-label="Producto en 360 grados. Arrastra o usa las flechas para girarlo."><div class="bubbles" id="bubbles"></div></div>
        <div class="hint mono"><span>Arrastra para girar</span><i id="hintBar"></i></div></div>
        <div class="bubbles-m" id="bubblesM" aria-label="Lo que trae"></div>
        <div class="chips" id="chips" role="group" aria-label="Elegir"></div></div>`
    : ctx.preview
      ? `<div class="viewer" style="min-height:300px;display:grid;place-items:center;padding:24px;text-align:center;color:var(--muted)">Aquí aparece el visor 360°. Carga tus productos con foto y precio en <b>Productos</b>.</div>`
      : "";

  const css = `${SHOWROOM_CSS}:root{--accent:${accent};--accent-on:${accentOn}}`;
  const fontsHref = `https://fonts.googleapis.com/css2?${TEMPLATE_FONTS.showroom.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800`).join("&")}&display=swap`;
  const script = showroomScript();
  const first = content.hero.title ? content.hero.title : brandWord;

  return `<!doctype html>
<html lang="es"${ctx.edit ? ' data-fx="off"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light">
<title>${esc(brandWord)} · ${esc(first)}</title>
<meta name="description" content="${esc(content.hero.text || brandWord)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(fontsHref)}">
<style>${css}</style>
</head>
<body>
<header class="top">
  ${tickerHtml}
  <div class="wrap">
    <nav class="links" aria-label="Secciones"><span class="logo-dot" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 4 L8 12 L13 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span>
      ${hasCars ? '<a href="#vitrina">Vitrina</a>' : ""}${showQuote ? '<a href="#cotizador">Cotizador</a>' : ""}${bentoHtml ? '<a href="#servicios">Servicios</a>' : ""}</nav>
    <a class="brand" href="#vitrina">${esc(brandWord)}</a>
    <a class="pill" href="#prueba">${esc(content.hero.secondaryCta)} ${arrow}</a>
  </div>
</header>
<main>
  <section class="hero${hasCars || ctx.preview ? "" : " solo"}" id="vitrina" aria-label="Vitrina"><div class="wrap">
    <div class="hero-copy"><h1>${esc(content.hero.title)}</h1><p>${esc(content.hero.text)}</p>
      <div class="hero-actions">${showQuote ? `<a class="pill" href="#cotizador">${esc(content.hero.primaryCta)} ${arrow}</a>` : `<a class="pill" href="#prueba">${esc(content.hero.secondaryCta)} ${arrow}</a>`}${showQuote ? `<a class="ghost" href="#prueba">${esc(content.hero.secondaryCta)} ${arrow}</a>` : ""}</div></div>
    ${heroViewer}
  </div></section>
  ${hasCars ? '<section class="stats" aria-label="Datos clave"><div class="wrap" id="stats"></div></section>' : ""}
  ${promoHtml}
  ${quoteHtml}
  ${bentoHtml}
  <section class="book alt" id="prueba"><div class="wrap">
    <div class="reveal sec-head"><span class="mono eyebrow">${num(++n)} · ${esc(vs.kicker)}</span><h2>${esc(vs.title)}</h2>${vs.text ? `<p class="lead">${esc(vs.text)}</p>` : ""}</div>
    <div class="book-grid${where.length ? "" : " solo"}">
      ${where.length ? `<div class="where">${where.map((w) => `<div><span class="fic">${iconSvg(w.icon)}</span><span class="mono">${esc(w.label)}</span><span>${esc(w.text)}</span></div>`).join("")}</div>` : ""}
      ${formHtml}
    </div></div></section>
</main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} ${esc(brandWord)}${content.footer ? ` · ${esc(content.footer)}` : ""}</span><a href="${esc(href("footer"))}">Escríbenos por WhatsApp</a></div></footer>
<noscript><style>.reveal.pre{opacity:1;transform:none}</style></noscript>
<script type="application/json" id="site-data">${jsonForHtml(clientData)}</script>
<script>${script}</script>
</body>
</html>`;
}

