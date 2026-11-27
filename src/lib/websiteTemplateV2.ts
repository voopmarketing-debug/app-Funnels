import { HONEYPOT_HTML } from "@/lib/honeypot";
import { SERIF_FONTS } from "@/lib/websiteContent";
import { readableTextColor, sanitizeHexColor, toEmbedUrl } from "@/lib/websiteTemplate";
import { eventDateOk, toIsoWithZone } from "@/lib/websiteBlocks";
import { LOOK_CSS, lookParts } from "@/lib/websiteLook";
import { SITE_SCRIPT } from "@/lib/siteScript";
import { ensureContrast } from "@/lib/colorContrast";
import {
  formatMoney,
  type CatalogProduct,
  type Section,
  type StyleKey,
  type WebsiteContentV2,
} from "@/lib/websiteContentV2";

// Renders a version-2 page (see websiteContentV2.ts). Static HTML + CSS
// only — public pages ship with `script-src 'none'` (securityHeaders.ts),
// so everything interactive here is CSS/HTML-native: <details> for FAQs,
// anchors for category tabs, scroll-snap for product rows.


// Motion and the interactive blocks (see siteScript.ts). Everything has a still,
// readable state without the script, and no movement when the visitor asked for less.
const FX_CSS = `
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.rv{transition:opacity .7s ease,transform .7s cubic-bezier(.2,.8,.2,1)}
.rv-hide{opacity:0;transform:translateY(26px)}
.rv-in{opacity:1;transform:none}
.feat-item.rv:nth-child(2),.pcard.rv:nth-child(2),.steps li.rv:nth-child(2){transition-delay:.07s}
.feat-item.rv:nth-child(3),.pcard.rv:nth-child(3),.steps li.rv:nth-child(3){transition-delay:.14s}
.feat-item.rv:nth-child(4),.pcard.rv:nth-child(4),.steps li.rv:nth-child(4){transition-delay:.21s}
.annc-run{padding:0;overflow:hidden;white-space:nowrap}
.annc-track{display:flex;width:max-content;animation:annc 38s linear infinite}
.annc-run:hover .annc-track{animation-play-state:paused}
.annc-set{display:flex;align-items:center;flex:none}
.annc-set span{padding:9px 18px}
.annc-set i{font-style:normal;opacity:.55;font-size:11px}
@keyframes annc{to{transform:translateX(-50%)}}
.promo-rich{padding:calc(var(--pad) * .7) 0;overflow:hidden}
.promo-rich-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:48px;align-items:center}
.promo-rich-grid.no-media{grid-template-columns:1fr}
.promo-rich .kicker{display:inline-flex;align-items:center;gap:9px;background:color-mix(in srgb,currentColor 12%,transparent);padding:6px 14px;border-radius:999px;color:inherit;opacity:1;margin-bottom:18px}
.promo-rich .kicker::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--primary);box-shadow:0 0 0 0 color-mix(in srgb,var(--primary) 60%,transparent);animation:pulse 1.8s infinite}
.promo-accent.promo-rich .kicker::before{background:var(--btn-text)}
@keyframes pulse{70%{box-shadow:0 0 0 10px transparent}100%{box-shadow:0 0 0 0 transparent}}
.promo-rich h2{font-size:clamp(30px,4.6vw,56px)}
.promo-rich .promo-copy>p{margin:0 0 6px;opacity:.82;max-width:52ch}
.cd{display:flex;gap:10px;margin:22px 0 26px}
.cd div{min-width:64px;text-align:center;padding:10px 8px;border-radius:14px;background:color-mix(in srgb,currentColor 11%,transparent);border:1px solid color-mix(in srgb,currentColor 14%,transparent)}
.cd b{display:block;font-family:var(--hf);font-size:calc(30px * var(--ts,1));line-height:1.1;font-variant-numeric:tabular-nums}
.cd span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;opacity:.7}
.promo-media{position:relative;transform:perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));transition:transform .25s ease;border-radius:var(--r);overflow:visible}
.promo-media img{width:100%;height:auto;border-radius:var(--r);box-shadow:0 36px 70px -34px rgba(0,0,0,.55);animation:popIn .9s cubic-bezier(.2,.8,.2,1) both}
.promo-media .glow{position:absolute;inset:0;border-radius:var(--r);pointer-events:none;background:radial-gradient(circle at var(--mx,50%) var(--my,30%),rgba(255,255,255,.34),transparent 55%);mix-blend-mode:soft-light;opacity:.9}
.seal{position:absolute;top:-16px;right:-8px;width:92px;height:92px;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;padding:8px;font-family:var(--hf);font-weight:800;font-size:19px;line-height:1.05;background:var(--primary);color:var(--btn-text);box-shadow:0 14px 30px -12px rgba(0,0,0,.5);animation:floaty 4.6s ease-in-out infinite}
@keyframes floaty{50%{transform:translateY(-9px) rotate(4deg)}}
@keyframes popIn{from{opacity:0;transform:translateY(30px) scale(.94)}}
.shw{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,.75fr);gap:28px;margin-top:36px;align-items:start}
.shw-stage{position:relative;aspect-ratio:16/11;border-radius:var(--r);background:radial-gradient(120% 90% at 50% 30%,color-mix(in srgb,var(--primary) 9%,var(--bg)),var(--surface));overflow:hidden;cursor:grab;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.shw-stage.drag{cursor:grabbing}
.shw-panel{margin:0;position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.shw-panel[hidden]{display:none}
.shw-panel img{max-width:76%;max-height:84%;width:auto;height:auto;object-fit:contain;filter:drop-shadow(0 26px 24px rgba(0,0,0,.18));pointer-events:none}
.shw-stage::after{content:"";position:absolute;left:18%;right:18%;bottom:7%;height:16px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.2),transparent);filter:blur(4px)}
.shw-hint{white-space:nowrap;position:absolute;left:50%;bottom:14px;transform:translateX(-50%);margin:0;z-index:3;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;color:var(--muted);background:color-mix(in srgb,var(--bg) 86%,transparent);padding:5px 12px;border-radius:999px}
.shw-bubbles{list-style:none;margin:0;padding:0}
.shw-bubbles li{position:absolute;left:var(--x);top:var(--y);z-index:2;max-width:210px;padding:10px 14px;border-radius:16px 16px 16px 4px;background:var(--bg);border:1px solid var(--line);box-shadow:0 14px 30px -18px rgba(0,0,0,.4);font-size:13px;line-height:1.35;opacity:0;transform:translateY(8px) scale(.96)}
.shw-bubbles b{display:block;font-size:13.5px}
.shw-bubbles span{color:var(--muted)}
.shw.in .shw-bubbles li{animation:bubble .55s var(--d) cubic-bezier(.2,.8,.2,1) forwards}
@keyframes bubble{to{opacity:1;transform:none}}
.shw-thumbs{display:flex;gap:10px;margin-top:14px;overflow-x:auto;padding-bottom:6px}
.shw-thumb{flex:none;display:grid;grid-template-columns:48px auto;grid-template-rows:auto auto;column-gap:10px;align-items:center;text-align:left;padding:8px 14px 8px 8px;border-radius:14px;border:1px solid var(--line);background:var(--bg);color:inherit;font:inherit;cursor:pointer;min-height:44px}
.shw-thumb img{grid-row:1/3;width:48px;height:48px;object-fit:contain;border-radius:10px;background:var(--surface)}
.shw-thumb span{font-weight:700;font-size:14px;line-height:1.2}
.shw-thumb small{color:var(--muted);font-size:12.5px}
.shw-thumb.on{border-color:var(--primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--primary) 25%,transparent)}
.shw-chat{display:none;list-style:none;margin:14px 0 0;padding:0;gap:8px}
.shw-chat li{max-width:88%;padding:10px 14px;border-radius:16px 16px 16px 4px;background:var(--surface);font-size:14px;line-height:1.35}
.shw-chat li:nth-child(even){justify-self:end;border-radius:16px 16px 4px 16px;background:color-mix(in srgb,var(--primary) 12%,var(--bg))}
.shw-chat b{display:block}.shw-chat span{color:var(--muted)}
.shw-info[hidden]{display:none}
.shw-info h3{font-size:26px;margin-bottom:8px}
.shw-desc{color:var(--muted);margin:0 0 10px}
.shw-facts{list-style:none;padding:0;margin:22px 0 0;display:grid;gap:10px}
.shw-facts li{display:flex;gap:12px;align-items:center;padding:12px 14px;border-radius:14px;background:var(--surface)}
.shw-facts .ico{width:24px;height:24px;color:var(--primary-ink);flex:none}
.shw-facts b{display:block;font-size:14px}
.shw-facts span{font-size:13px;color:var(--muted)}
.qt{margin-top:32px;padding:28px;border-radius:calc(var(--r) + 4px);background:var(--bg);border:1px solid var(--line)}
.qt-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
.qt-modes{display:inline-flex;padding:4px;border-radius:999px;background:var(--surface)}
.qt-modes button{font:inherit;font-weight:700;font-size:14px;padding:9px 18px;border:0;border-radius:999px;background:transparent;color:var(--muted);cursor:pointer;min-height:40px}
.qt-modes button.on{background:var(--text);color:var(--bg)}
.qt-count{margin:0;font-weight:700;color:var(--primary-ink)}
.qt-label{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:22px;font-weight:600;color:var(--muted)}
.qt-label output{font-family:var(--hf);font-size:30px;font-weight:700;color:var(--text);font-variant-numeric:tabular-nums}
.qt-range{width:100%;margin:12px 0 6px;accent-color:var(--primary);height:34px}
.qt-list{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:12px}
.qt-row{display:grid;grid-template-columns:64px 1fr auto;gap:16px;align-items:center;padding:12px 14px;border-radius:16px;border:1px solid var(--line);transition:border-color .2s,background .2s}
.qt-row>img,.qt-ph{width:64px;height:64px;border-radius:12px;object-fit:contain;background:var(--surface);display:flex;align-items:center;justify-content:center;font-family:var(--hf);font-size:24px}
.qt-info b{display:block;line-height:1.2}
.qt-info>span{color:var(--muted);font-size:14px;font-variant-numeric:tabular-nums}
.qt-bar{height:8px;border-radius:999px;background:var(--surface);margin:8px 0 4px;overflow:hidden}
.qt-bar i{display:block;height:100%;width:0;border-radius:999px;background:var(--primary);transition:width .25s ease,background .25s}
.qt-info p{margin:0;font-size:13px;font-weight:700}
.qt-row.fit .qt-bar i{background:#15803d}.qt-row.fit [data-qstate]{color:#15803d}
.qt-row.nofit .qt-bar i{background:#c2410c}.qt-row.nofit [data-qstate]{color:#c2410c}
.qt-row.nofit{opacity:.88}
.qt-note{margin:18px 0 0;font-size:13px;color:var(--muted)}
.fan{margin-top:34px}
.fan-stage{display:flex;gap:16px;overflow-x:auto;padding-bottom:10px;scroll-snap-type:x mandatory}
.fan-card{flex:none;width:min(240px,70vw);scroll-snap-align:start;border-radius:var(--r);background:var(--bg);border:1px solid var(--line);overflow:hidden}
.fan-card img{width:100%;aspect-ratio:4/5;object-fit:contain;padding:12px;background:var(--surface);pointer-events:none}
.fan-cap{padding:12px 14px}
.fan-cap b{display:block;line-height:1.2}
.fan-cap span{color:var(--muted);font-size:14px}
.fan-on .fan-stage{display:block;position:relative;height:clamp(360px,54vw,480px);overflow:hidden;padding:0;cursor:grab;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.fan-on .fan-card{position:absolute;left:50%;bottom:0;width:clamp(190px,26vw,250px);transform-origin:50% 330%;box-shadow:0 22px 40px -26px rgba(0,0,0,.45)}
.fan-sheet{max-width:640px;margin:22px auto 0;text-align:center}
.fan-info[hidden],[data-fpane][hidden]{display:none}
.fan-tabs{display:inline-flex;gap:4px;padding:4px;border-radius:999px;background:var(--bg);margin-bottom:16px}
.fan-tabs button{font:inherit;font-weight:700;font-size:14px;padding:8px 18px;border:0;border-radius:999px;background:transparent;color:var(--muted);cursor:pointer;min-height:40px}
.fan-tabs button.on{background:var(--text);color:var(--bg)}
.fan-info p{color:var(--muted)}
.fan-info .prow{justify-content:center}
.mq{padding:28px 0;overflow:hidden;border-block:1px solid var(--line)}
.mq-row{overflow:hidden;white-space:nowrap}
.mq-track{display:inline-flex;animation:mq 46s linear infinite}
.mq-row.rev .mq-track{animation-direction:reverse}
.mq-track span{font-family:var(--hf);font-weight:700;font-size:calc(clamp(22px,3vw,40px) * var(--ts,1));line-height:1.2;letter-spacing:-.01em;padding-right:1.2em;color:color-mix(in srgb,var(--text) 38%,transparent)}
.mq-row.rev .mq-track span{color:color-mix(in srgb,var(--text) 22%,transparent)}
@keyframes mq{to{transform:translateX(-50%)}}
.tv{padding:var(--pad) 0 0}
.tv-product{display:none}
.tv-stage{display:grid;gap:18px;margin-top:28px;padding:0 24px;max-width:var(--max);margin-inline:auto}
.tv-scene{display:grid;gap:14px;padding:20px;border-radius:var(--r);background:var(--surface)}
.tv-own{width:100%;max-height:320px;object-fit:contain}
.tv-n{font-family:var(--hf);font-size:34px;color:var(--primary-ink);line-height:1}
.tv-text h3{margin:6px 0 6px}
.tv-text p{margin:0;color:var(--muted)}
.tv-on{height:calc(var(--n) * 88vh)}
.tv-on .tv-stage{position:sticky;top:68px;height:calc(100vh - 68px);margin:0;padding:0;max-width:none;display:block;overflow:hidden;background:radial-gradient(70% 70% at 50% 45%,color-mix(in srgb,var(--primary) 10%,var(--bg)),var(--bg))}
.tv-on .tv-product{display:block;position:absolute;left:68%;top:50%;width:min(38vw,540px);height:auto;max-height:82%;object-fit:contain;transform:translate(-50%,-50%);filter:drop-shadow(0 34px 30px rgba(0,0,0,.2));will-change:transform,left,top;pointer-events:none}
.tv-on .tv-own{display:none}
.tv-on .tv-scene{position:absolute;inset:0;display:flex;align-items:center;padding:0;background:none;border-radius:0;opacity:var(--o,0);pointer-events:none}
.tv-on .tv-text{width:min(430px,38vw);margin-left:max(24px,calc((100vw - var(--max)) / 2 + 24px))}
.tv-on .tv-scene:nth-of-type(even) .tv-text{margin-left:auto;margin-right:max(24px,calc((100vw - var(--max)) / 2 + 24px))}
.tv-on .tv-text h3{font-size:clamp(30px,3.6vw,50px)}
.tv-on .tv-text p{font-size:18px}
@media (max-width:860px){
  .promo-rich-grid,.shw{grid-template-columns:minmax(0,1fr);gap:28px}
  .shw-stage{aspect-ratio:4/3}
  .shw-bubbles{display:none}
  .shw-chat{display:grid}
  .qt{padding:18px}
  .qt-row{grid-template-columns:52px 1fr;gap:12px}
  .qt-row>img,.qt-ph{width:52px;height:52px}
  .qt-row>.btn,.qt-row>.btn-soldout{grid-column:1/-1;width:100%}
  .cd div{min-width:58px}
  .seal{right:6px;width:78px;height:78px;font-size:16px}
}
@media (prefers-reduced-motion:reduce){
  .rv,.rv-hide{opacity:1!important;transform:none!important}
  .tv-product{transition:none!important}
  .annc-track,.mq-track,.seal,.promo-media img,.shw-bubbles li,.promo-rich .kicker::before{animation:none!important}
  .shw-bubbles li{opacity:1;transform:none}
  .promo-media{transform:none!important}
}
`;

function esc(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https:\/\//.test(url) ? url : null;
}

// Each style is a set of shape/typography decisions layered on the AI's
// own colors and fonts, so two pages with the same palette still read as
// different design languages.
type StylePreset = {
  radius: string;
  btnRadius: string;
  headingWeight: number;
  headingTransform: "none" | "uppercase";
  headingTracking: string;
  h1: string;
  h2: string;
  sectionPad: string;
  cardBorder: boolean;
  cardShadow: boolean;
  heroDecor: "grid" | "glow" | "none" | "blob";
  maxWidth: string;
};

const STYLES: Record<StyleKey, StylePreset> = {
  editorial: { radius: "4px", btnRadius: "2px", headingWeight: 400, headingTransform: "none", headingTracking: "-0.02em", h1: "clamp(40px, 7vw, 84px)", h2: "clamp(28px, 4.2vw, 48px)", sectionPad: "112px", cardBorder: true, cardShadow: false, heroDecor: "none", maxWidth: "1160px" },
  bold: { radius: "0px", btnRadius: "0px", headingWeight: 700, headingTransform: "uppercase", headingTracking: "-0.03em", h1: "clamp(48px, 9vw, 124px)", h2: "clamp(32px, 5.5vw, 64px)", sectionPad: "96px", cardBorder: true, cardShadow: false, heroDecor: "none", maxWidth: "1200px" },
  tech: { radius: "14px", btnRadius: "10px", headingWeight: 700, headingTransform: "none", headingTracking: "-0.03em", h1: "clamp(38px, 6vw, 72px)", h2: "clamp(26px, 3.8vw, 44px)", sectionPad: "96px", cardBorder: true, cardShadow: false, heroDecor: "glow", maxWidth: "1140px" },
  clinico: { radius: "18px", btnRadius: "999px", headingWeight: 600, headingTransform: "none", headingTracking: "-0.015em", h1: "clamp(34px, 5vw, 58px)", h2: "clamp(24px, 3.4vw, 38px)", sectionPad: "88px", cardBorder: false, cardShadow: true, heroDecor: "blob", maxWidth: "1120px" },
  calido: { radius: "24px", btnRadius: "999px", headingWeight: 600, headingTransform: "none", headingTracking: "-0.015em", h1: "clamp(36px, 5.5vw, 64px)", h2: "clamp(26px, 3.6vw, 42px)", sectionPad: "96px", cardBorder: false, cardShadow: true, heroDecor: "blob", maxWidth: "1120px" },
  gourmet: { radius: "6px", btnRadius: "999px", headingWeight: 600, headingTransform: "none", headingTracking: "-0.01em", h1: "clamp(40px, 6.5vw, 80px)", h2: "clamp(28px, 4vw, 46px)", sectionPad: "104px", cardBorder: true, cardShadow: false, heroDecor: "none", maxWidth: "1160px" },
  producto: { radius: "20px", btnRadius: "999px", headingWeight: 700, headingTransform: "none", headingTracking: "-0.025em", h1: "clamp(34px, 5vw, 60px)", h2: "clamp(24px, 3.4vw, 38px)", sectionPad: "80px", cardBorder: true, cardShadow: false, heroDecor: "none", maxWidth: "1180px" },
  tienda: { radius: "16px", btnRadius: "999px", headingWeight: 700, headingTransform: "none", headingTracking: "-0.025em", h1: "clamp(38px, 6vw, 76px)", h2: "clamp(22px, 3vw, 32px)", sectionPad: "72px", cardBorder: false, cardShadow: false, heroDecor: "none", maxWidth: "1240px" },
  lanzamiento: { radius: "16px", btnRadius: "12px", headingWeight: 800, headingTransform: "none", headingTracking: "-0.03em", h1: "clamp(36px, 6vw, 70px)", h2: "clamp(26px, 3.8vw, 44px)", sectionPad: "96px", cardBorder: true, cardShadow: false, heroDecor: "glow", maxWidth: "1120px" },
  corporativo: { radius: "8px", btnRadius: "6px", headingWeight: 700, headingTransform: "none", headingTracking: "-0.02em", h1: "clamp(34px, 5vw, 58px)", h2: "clamp(24px, 3.4vw, 38px)", sectionPad: "88px", cardBorder: true, cardShadow: false, heroDecor: "grid", maxWidth: "1160px" },
  pop: { radius: "28px", btnRadius: "999px", headingWeight: 800, headingTransform: "none", headingTracking: "-0.02em", h1: "clamp(40px, 6.5vw, 80px)", h2: "clamp(28px, 4vw, 46px)", sectionPad: "88px", cardBorder: true, cardShadow: true, heroDecor: "blob", maxWidth: "1140px" },
  lujo: { radius: "2px", btnRadius: "2px", headingWeight: 400, headingTransform: "none", headingTracking: "0.01em", h1: "clamp(40px, 6.5vw, 80px)", h2: "clamp(28px, 4vw, 48px)", sectionPad: "120px", cardBorder: true, cardShadow: false, heroDecor: "none", maxWidth: "1120px" },
};

const ICONS: Record<string, string> = {
  truck: '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14-5l-2 2M4 13a8 8 0 0 0 14 5l2-2"/><path d="M4 4v4h4M20 20v-4h-4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.5 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  leaf: '<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19c3-3 6-5 9-7"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M12 9C9 9 7 4 10 4s2 5 2 5 0-5 2-5 1 5-2 5"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c.5-3 3-5 6-5s5.5 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14c2.5.2 4.2 1.8 4.7 4.5"/>',
  map: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
};

function icon(name: string): string {
  return `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ICONS.check}</svg>`;
}

function fontLink(fonts: string[]): string {
  const families = fonts.map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&");
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type RenderV2Context = {
  businessName: string;
  trackingBasePath: string;
  preview?: boolean;
  // The builder's click-to-edit preview: marks every editable text, image and
  // section with data-* attributes (the builder's own script reads them from
  // the same-origin iframe). Never set on the public page.
  edit?: boolean;
  leadSubmitted?: boolean;
  heroImageUrl?: string | null;
  photos?: string[];
  products?: CatalogProduct[];
};

export function renderWebsiteHtmlV2(content: WebsiteContentV2, ctx: RenderV2Context): string {
  // "Subir mi HTML": the page is only the owner's own page inside its isolated frame, which fills the
  // whole screen and scrolls by itself (so a long page is never cut and nothing depends on measuring
  // its height). The builder's preview shows the same thing, plus a button to edit the code.
  if (content.fullHtml) {
    const at = content.sections.findIndex((s, i) => s.type === "html" && s.code.trim() !== "" && !(content.hidden ?? []).includes(i));
    if (at >= 0) {
      const src = `${ctx.trackingBasePath}/bloque/${at}${ctx.preview ? "?preview=1" : ""}`;
      const first = content.sections[0];
      const title = esc(first && first.type === "hero" && first.heading ? first.heading : ctx.businessName);
      const editBtn = ctx.edit
        ? `<button type="button" data-code-edit="${at}" style="all:unset;box-sizing:border-box;cursor:pointer;position:fixed;top:0;left:0;right:0;height:46px;z-index:5;background:#b5ff2b;color:#0a0a0a;font:800 15px/46px system-ui,sans-serif;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.35)">&lt;/&gt; Editar el código de mi página &rsaquo;</button>`
        : "";
      return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title}</title>
<style>html,body{margin:0;padding:0;height:100%;overflow:hidden;background:#fff}iframe{position:fixed;top:${ctx.edit ? 46 : 0}px;left:0;width:100%;height:${ctx.edit ? "calc(100% - 46px)" : "100%"};border:0;display:block}</style></head>
<body><iframe title="${title}" src="${esc(src)}" data-htmlframe sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals" referrerpolicy="no-referrer"></iframe>${editBtn}
<script>${SITE_SCRIPT}</script></body></html>`;
    }
  }
  // Showroom / Scroll Story pages saved before the template builder: one standard look. Clean sans
  // type for titles and text, black, white and gray, the accent only on buttons and small details.
  const neutral = content.pageType === "showroom" || content.pageType === "historia";
  const baseStyle = STYLES[content.style] ?? STYLES.editorial;
  const style: StylePreset = neutral
    ? { ...baseStyle, headingWeight: 700, headingTransform: "none", headingTracking: "-0.03em", h1: "clamp(32px, 4vw, 52px)", h2: "clamp(24px, 3vw, 36px)", sectionPad: "88px", cardBorder: true, cardShadow: false, heroDecor: "none" }
    : baseStyle;
  const theme: WebsiteContentV2["theme"] = neutral
    ? { ...content.theme, textColor: "#111214", backgroundColor: "#ffffff", surfaceColor: "#f5f6f8", headingFont: "Inter", bodyFont: "Inter" }
    : content.theme;
  const products = ctx.products ?? [];
  const productById = new Map(products.map((p) => [p.id, p]));
  const photos = (ctx.photos ?? []).map(safeUrl).filter((u): u is string => !!u);
  const heroImage = safeUrl(ctx.heroImageUrl) ?? photos[0] ?? null;

  const edit = !!(ctx.preview && ctx.edit);
  // data-edit="sections.2.heading": the path of the text in the stored content.
  const ed = (path: string) => (edit ? ` data-edit="${esc(path)}"` : "");
  // Safe inside url('…'): only the characters that could end the url or the string are encoded.
  // (Then HTML-escaped, since it lands in a style="" attribute: an "&" stays an "&" for the browser.)
  const cssUrl = (u: string) => esc(u.replace(/['()\s"\\<>]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`));

  const previewQ = ctx.preview ? "&preview=1" : "";
  const href = (label: string) => `${ctx.trackingBasePath}/ir?label=${encodeURIComponent(label)}${previewQ}`;
  const orderHref = (p: CatalogProduct) =>
    `${ctx.trackingBasePath}/ir?label=${encodeURIComponent(`pedido:${p.name}`.slice(0, 80))}&p=${encodeURIComponent(p.id)}${previewQ}`;
  // A page with a form sends its buttons to the form; otherwise they go through the tracked button link.
  const formAnchor = content.sections.some((s) => s.type === "leadForm") ? "#registro" : content.sections[0]?.type === "hero" && content.sections[0].showLeadForm ? "#inicio" : null;
  const ctaHref = (label: string) => formAnchor ?? href(label);
  const registroAction = `${ctx.trackingBasePath}/registro${ctx.preview ? "?preview=1" : ""}`;

  const primary = sanitizeHexColor(theme.primaryColor, "#1f6feb");
  const bg = sanitizeHexColor(theme.backgroundColor, "#fafaf7");
  const surface = sanitizeHexColor(theme.surfaceColor, "#f1f0eb");
  // The AI's own colors are corrected when they would not read: text on the background at 7:1, and the
  // accent used AS TEXT (kickers, highlights, prices) at 4.5:1. Buttons keep the exact brand color.
  const textColor = ensureContrast(sanitizeHexColor(theme.textColor, "#141414"), bg, 7);
  const primaryInk = ensureContrast(primary, bg, 4.5);
  const fonts = Array.from(new Set<string>([theme.headingFont, theme.bodyFont, ...content.sections.flatMap((x) => [x.look?.headingFont, x.look?.bodyFont]).filter((f): f is string => !!f)]));
  const fontStack = (f: string) => `"${f}", ${SERIF_FONTS.has(f) ? "Georgia, serif" : "system-ui, sans-serif"}`;

  const hidden = new Set(content.hidden ?? []);
  const sections = content.sections.map((s, i) => ({ s, i })).filter(({ i }) => !hidden.has(i));

  const priceHtml = (p: CatalogProduct) => {
    if (p.price === null) return `<span class="price">Consultar precio</span>`;
    const compare =
      p.compareAtPrice && p.compareAtPrice > p.price
        ? `<span class="compare">${esc(formatMoney(p.compareAtPrice, p.currency))}</span><span class="off">-${Math.round((1 - p.price / p.compareAtPrice) * 100)}%</span>`
        : "";
    return `<span class="price">${esc(formatMoney(p.price, p.currency))}</span>${compare}`;
  };

  // Pictures that are not picked on the page itself: in the editing preview they explain where they are changed.
  const note = (text: string) => (edit ? ` data-note="${esc(text)}"` : "");
  const productImage = (p: CatalogProduct, cls = "") => {
    const url = safeUrl(p.imageUrl);
    return url
      ? `<img class="${cls}" src="${esc(url)}" alt="${esc(p.name)}" loading="lazy"${note("La foto de cada producto se cambia en Productos.")}>`
      : `<div class="img-ph ${cls}" aria-hidden="true">${esc(p.name.slice(0, 1).toUpperCase())}</div>`;
  };

  // Sold out (inventory at zero): a plain "Agotado" instead of the order link.
  const orderButton = (p: CatalogProduct, cls: string, label: string, editPath?: string) =>
    p.soldOut
      ? `<span class="${cls} btn-soldout" aria-disabled="true">Agotado</span>`
      : `<a class="${cls}" href="${esc(orderHref(p))}"${editPath ? ed(editPath) : ""}>${esc(label)}</a>`;
  const badgeHtml = (p: CatalogProduct) =>
    p.soldOut ? `<span class="pbadge pbadge-soldout">Agotado</span>` : p.badge ? `<span class="pbadge">${esc(p.badge)}</span>` : "";

  const productCard = (p: CatalogProduct, featured = false) => `
    <article class="pcard${featured ? " pcard-featured" : ""}${p.soldOut ? " pcard-soldout" : ""}">
      <div class="pcard-media">
        ${badgeHtml(p)}
        ${productImage(p)}
      </div>
      <div class="pcard-body">
        ${p.category ? `<p class="pcat">${esc(p.category)}</p>` : ""}
        <h3>${esc(p.name)}</h3>
        ${featured && p.description ? `<p class="pdesc">${esc(p.description)}</p>` : ""}
        <div class="prow">${priceHtml(p)}</div>
        ${orderButton(p, "btn btn-sm", p.isService ? "Agendar por WhatsApp" : "Pedir por WhatsApp")}
      </div>
    </article>`;

  // "{mes}" becomes the current month (the page script keeps it right as the months go by); the editor sees the raw token.
  const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const rich = (text: string) => (edit ? esc(text) : esc(text).replace(/\{mes\}/g, `<span data-month>${MONTHS[new Date().getMonth()]}</span>`));
  // "02 / 08": a small mono counter before the label of each section, when the template asks for it.
  const visibleOrder = new Map(sections.map(({ i }, n) => [i, n + 1]));
  let currentNo = 0;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const kickerHtml = (k: string | null | undefined, path?: string) => {
    if (!k) return "";
    const p = `<p class="kicker"${path ? ed(path) : ""}>${rich(k)}</p>`;
    return content.counters && currentNo > 0 ? `<div class="k-row"><span class="k-n" aria-hidden="true">${pad2(currentNo)} / ${pad2(sections.length)}</span>${p}</div>` : p;
  };

  // Paints the AI-chosen words of the headline in the accent color.
  const headline = (heading: string, highlight: string | null | undefined) => {
    const h = highlight?.trim();
    const at = h ? heading.toLowerCase().indexOf(h.toLowerCase()) : -1;
    if (!h || at < 0) return esc(heading);
    return `${esc(heading.slice(0, at))}<span class="hl">${esc(heading.slice(at, at + h.length))}</span>${esc(heading.slice(at + h.length))}`;
  };

  const leadFormHtml = (buttonLabel: string) =>
    ctx.leadSubmitted
      ? `<p class="lead-ok">¡Listo! Recibimos tus datos y te escribimos muy pronto.</p>`
      : `<form class="lead-form" method="POST" action="${esc(registroAction)}">${HONEYPOT_HTML}
          <input type="text" name="name" placeholder="Tu nombre" maxlength="120" required>
          <input type="text" name="contact" placeholder="Tu WhatsApp o teléfono" maxlength="120" required>
          <textarea name="message" placeholder="Cuéntanos qué necesitas (opcional)" rows="2" maxlength="500"></textarea>
          <label class="consent"><input type="checkbox" name="consent" value="1" required><span>Autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012.</span></label>
          <button class="btn" type="submit">${esc(buttonLabel)}</button>
        </form>`;

  const renderSection = (s: Section, index: number): string => {
    currentNo = visibleOrder.get(index) ?? 0;
    // Path of a field of this section, and the marker of its main picture.
    const fp = (field: string) => `sections.${index}.${field}`;
    const imgMark = edit ? ` data-img="${index}"` : "";
    // The owner's own photo wins over the automatic one.
    const mainImage = safeUrl(s.image) ?? heroImage;
    // A fine frame where a photo goes, only while the owner is looking at the page in the library or the editor:
    // the published page never shows an empty frame (it simply lays out without the photo).
    const photoSlot = (cls: string) => `<div class="ph-photo ${cls}"${imgMark} role="img" aria-label="Aquí va tu foto"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.500A2.500 2.500 0 0 1 6.500 6h1.300l1.100-1.600A1.500 1.500 0 0 1 10.100 3.700h3.800a1.500 1.500 0 0 1 1.200.700L16.200 6h1.300A2.500 2.500 0 0 1 20 8.500v8A2.500 2.500 0 0 1 17.500 19h-11A2.500 2.500 0 0 1 4 16.500v-8Z"/><circle cx="12" cy="12.500" r="3.200"/></svg><span>Tu foto aquí</span></div>`;
    switch (s.type) {
      case "html": {
        if (!s.code.trim()) return ctx.preview ? `<section class="sec"><div class="wrap"><div class="empty-note">Aquí aparecerá tu código HTML. Elige este bloque en <strong>Bloques</strong> y pégalo.</div></div></section>` : "";
        const src = `${ctx.trackingBasePath}/bloque/${index}${ctx.preview ? "?preview=1" : ""}`;
        const h = s.height > 0 ? `${s.height}px` : "320px";
        const editBtn = edit ? `<button type="button" data-code-edit="${index}" style="all:unset;box-sizing:border-box;cursor:pointer;display:block;width:100%;padding:8px 12px;background:#111827;color:#fff;font:600 12px/1.2 system-ui,sans-serif;text-align:center">&lt;/&gt; Editar código de este bloque</button>` : "";
        return `<section class="htmlw">${editBtn}<iframe class="htmlw-frame" src="${esc(src)}" title="Contenido" loading="lazy" data-htmlframe sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals" referrerpolicy="no-referrer"${s.height > 0 ? "" : " data-autoheight"} style="height:${h}"></iframe></section>`;
      }

      case "hero": {
        if (s.variant === "blank") return ctx.preview ? `<section class="sec"><div class="wrap"><div class="empty-note">Página en blanco: arrastra bloques desde <strong>Bloques</strong> o pega tu propio código con el bloque <strong>Código HTML</strong>.</div></div></section>` : "";
        const product = s.productId ? productById.get(s.productId) : undefined;
        const primaryBtn = `<a class="btn" href="${esc(href("hero"))}"${ed(fp("ctaLabel"))}>${esc(s.ctaLabel)}</a>`;
        const secondaryBtn = s.secondaryCtaLabel
          ? `<a class="btn btn-ghost" href="#${products.length > 0 ? "productos" : "detalles"}"${ed(fp("secondaryCtaLabel"))}>${esc(s.secondaryCtaLabel)}</a>`
          : "";
        const eyebrow = s.eyebrow ? `<p class="eyebrow"${ed(fp("eyebrow"))}>${esc(s.eyebrow)}</p>` : "";
        const badge = s.badge ? `<span class="hero-badge"${ed(fp("badge"))}>${esc(s.badge)}</span>` : "";
        const chips = (s.chips ?? []).slice(0, 3);
        const chipsHtml = chips.length ? `<ul class="chips">${chips.map((c, ci) => `<li${ed(fp(`chips.${ci}`))}>${esc(c)}</li>`).join("")}</ul>` : "";
        const h1 = (cls = "") => `<h1${cls ? ` class="${cls}"` : ""}${ed(fp("heading"))}>${headline(s.heading, s.highlight)}</h1>`;
        const heroBg = safeUrl(s.bgImage);

        // Event / lead-capture hero (refs: webinar pages): copy + chips on
        // one side, the registration form right there on the other.
        if (s.showLeadForm) {
          return `<section class="hero hero-form" id="inicio"><div class="decor" aria-hidden="true"></div><div class="wrap hero-split-grid">
            <div>${eyebrow}${h1()}<p class="lead"${ed(fp("subheading"))}>${esc(s.subheading)}</p>${chipsHtml}${badge}</div>
            <div class="form-card">${mainImage ? `<img class="form-card-img" src="${esc(mainImage)}" alt=""${imgMark}>` : ""}<p class="form-card-title"${ed(fp("ctaLabel"))}>${esc(s.ctaLabel)}</p>${leadFormHtml(s.ctaLabel)}</div>
          </div></section>`;
        }

        if (s.variant === "product" && product) {
          return `<section class="hero hero-product" id="inicio"><div class="wrap hero-product-grid">
            <div class="hero-product-media">${badgeHtml(product)}${productImage(product, "hero-product-img")}</div>
            <div class="hero-product-info">
              ${eyebrow}
              ${h1()}
              <p class="lead"${ed(fp("subheading"))}>${esc(s.subheading)}</p>
              <div class="prow prow-lg">${priceHtml(product)}</div>
              ${chipsHtml}
              <div class="hero-actions">${orderButton(product, "btn btn-block", s.ctaLabel, fp("ctaLabel"))}${secondaryBtn}</div>
              ${badge}
            </div>
          </div></section>`;
        }
        if (s.variant === "wordmark") {
          const name = ctx.businessName;
          const size = name.length <= 8 ? "wm-xl" : name.length <= 14 ? "wm-lg" : "wm-md";
          return `<section class="hero hero-wm" id="inicio"><div class="wrap">
            <div class="wm-top">${s.eyebrow ? `<span${ed(fp("eyebrow"))}>${esc(s.eyebrow)}</span>` : "<span></span>"}<span aria-hidden="true">${esc(content.counters ? "01 / " + pad2(sections.length) : "Inicio")}</span></div>
            <p class="wm ${size}" aria-hidden="true">${esc(name)}</p>
            ${h1("wm-h1")}
            <div class="wm-row"><div><p class="lead"${ed(fp("subheading"))}>${esc(s.subheading)}</p>${chipsHtml}</div><div class="hero-actions">${primaryBtn}${secondaryBtn}</div></div>
            ${heroBg ?? mainImage ? `<img class="wm-img" src="${esc((heroBg ?? mainImage) as string)}" alt=""${imgMark}>` : ""}
            <p class="scroll-hint" aria-hidden="true">Desliza para explorar ↓</p>${badge}
          </div></section>`;
        }
        // A background photo chosen by the owner turns the portada into the full-photo one.
        const fullImage = heroBg ?? (s.variant === "fullbleed" ? mainImage : null);
        if (fullImage) {
          return `<section class="hero hero-full" id="inicio" style="background-image:linear-gradient(90deg, rgba(0,0,0,.72), rgba(0,0,0,.25)), url('${cssUrl(fullImage)}')">
            <div class="wrap"><div class="hero-full-inner">${eyebrow}${h1()}<p class="lead"${ed(fp("subheading"))}>${esc(s.subheading)}</p>${chipsHtml}<div class="hero-actions">${primaryBtn}${secondaryBtn}</div>${badge}</div></div>
          </section>`;
        }
        if (s.variant === "giant") {
          return `<section class="hero hero-giant" id="inicio"><div class="wrap">
            ${eyebrow}${h1("giant")}
            <div class="giant-row">
              ${mainImage ? `<img class="giant-img" src="${esc(mainImage)}" alt=""${imgMark}>` : ""}
              <div class="giant-copy"><p class="lead"${ed(fp("subheading"))}>${esc(s.subheading)}</p>${chipsHtml}<div class="hero-actions">${primaryBtn}${secondaryBtn}</div>${badge}</div>
            </div>
          </div></section>`;
        }
        // Product-led pages show the real product in the portada (whole, on a soft panel), never a stock photo.
        const productLed = ["showroom", "historia", "producto", "tienda"].includes(content.pageType);
        const heroProduct = !safeUrl(s.image) && productLed ? products.find((p) => safeUrl(p.imageUrl)) : undefined;
        if (s.variant === "split" && heroProduct) {
          return `<section class="hero hero-split" id="inicio"><div class="decor" aria-hidden="true"></div><div class="wrap hero-split-grid">
            <div>${eyebrow}${h1()}<p class="lead"${ed(fp("subheading"))}>${esc(s.subheading)}</p>${chipsHtml}<div class="hero-actions">${primaryBtn}${secondaryBtn}</div>${badge}</div>
            <div class="hero-stage"><img src="${esc(safeUrl(heroProduct.imageUrl) ?? "")}" alt="${esc(heroProduct.name)}"${note("La foto de la portada es la de tu primer producto. Cámbiala en Productos.")}><p class="hero-stage-cap"><b>${esc(heroProduct.name)}</b>${heroProduct.price !== null ? `<span>${esc(formatMoney(heroProduct.price, heroProduct.currency))}</span>` : ""}</p></div>
          </div></section>`;
        }
        if (s.variant === "split" && (mainImage || ctx.preview)) {
          return `<section class="hero hero-split" id="inicio"><div class="decor" aria-hidden="true"></div><div class="wrap hero-split-grid">
            <div>${eyebrow}${h1()}<p class="lead"${ed(fp("subheading"))}>${esc(s.subheading)}</p>${chipsHtml}<div class="hero-actions">${primaryBtn}${secondaryBtn}</div>${badge}</div>
            <div class="hero-media">${mainImage ? `<img src="${esc(mainImage)}" alt=""${imgMark}>` : photoSlot("ph-4x3")}</div>
          </div></section>`;
        }
        return `<section class="hero hero-centered" id="inicio"><div class="decor" aria-hidden="true"></div><div class="wrap narrow">
          ${eyebrow}${h1()}<p class="lead"${ed(fp("subheading"))}>${esc(s.subheading)}</p>${chipsHtml}<div class="hero-actions center">${primaryBtn}${secondaryBtn}</div>${badge}
          ${s.variant === "centered" ? (mainImage ? `<img class="hero-wide" src="${esc(mainImage)}" alt=""${imgMark}>` : ctx.preview ? photoSlot("ph-wide") : "") : ""}
        </div></section>`;
      }

      case "trustBar":
        if (s.variant === "ticker" && !edit) {
          const titles = s.items.slice(0, 4).map((it) => it.title).filter(Boolean);
          if (titles.length === 0) return "";
          const run = Array.from({ length: 6 }, () => titles.map((t) => `<span>${esc(t)}</span>`).join("")).join("");
          return `<section class="mq mq-trust"><ul class="sr-only">${titles.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><div class="mq-row" aria-hidden="true"><div class="mq-track">${run}</div></div></section>`;
        }
        return `<section class="trust"><div class="wrap trust-grid">${s.items
          .slice(0, 4)
          .map((it, ii) => `<div class="trust-item">${icon(it.icon)}<div><p class="t-title"${ed(fp(`items.${ii}.title`))}>${esc(it.title)}</p><p class="t-desc"${ed(fp(`items.${ii}.description`))}>${esc(it.description)}</p></div></div>`)
          .join("")}</div></section>`;

      case "features": {
        const list = s.items.slice(0, s.variant === "bento" ? 6 : 6);
        const item = (it: (typeof list)[number], ii: number) => {
          const t = `<h3${ed(fp(`items.${ii}.title`))}>${esc(it.title)}</h3>`;
          const d = `<p${ed(fp(`items.${ii}.description`))}>${esc(it.description)}</p>`;
          if (s.variant === "numbered") return `<div class="feat-item"><span class="feat-num" aria-hidden="true">${pad2(ii + 1)}</span>${t}${d}</div>`;
          return `<div class="feat-item">${s.variant !== "list" ? `<span class="feat-ico">${icon(it.icon)}</span>` : `<span class="feat-check">${icon("check")}</span>`}<div>${t}${d}</div></div>`;
        };
        return `<section class="sec" id="${index === 1 ? "detalles" : `s${index}`}"><div class="wrap">
          ${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2>${s.intro ? `<p class="intro"${ed(fp("intro"))}>${esc(s.intro)}</p>` : ""}
          <div class="feat feat-${s.variant}" data-n="${list.length}">${list.map(item).join("")}</div>
        </div></section>`;
      }

      case "steps":
        return `<section class="sec alt" id="como-funciona"><div class="wrap">
          ${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2>
          <ol class="steps steps-${s.variant ?? "row"}">${s.items
            .slice(0, 4)
            .map((it, i) => `<li><span class="step-n">${String(i + 1).padStart(2, "0")}</span><h3${ed(fp(`items.${i}.title`))}>${esc(it.title)}</h3><p${ed(fp(`items.${i}.description`))}>${esc(it.description)}</p></li>`)
            .join("")}</ol>
        </div></section>`;

      case "productGrid": {
        const chosen = (s.productIds.length > 0 ? s.productIds.map((id) => productById.get(id)).filter((p): p is CatalogProduct => !!p) : products).slice(0, 48);
        if (chosen.length === 0) {
          return ctx.preview
            ? `<section class="sec"><div class="wrap"><div class="empty-note">Aquí aparecerán tus productos. Agrégalos en <strong>Productos</strong> dentro de la plataforma.</div></div></section>`
            : "";
        }
        const head = `${kickerHtml(s.kicker, fp("kicker"))}<div class="sec-head"><h2${ed(fp("heading"))}>${esc(s.heading)}</h2></div>`;
        if (s.showCategoryFilter) {
          const cats = Array.from(new Set(chosen.map((p) => p.category ?? "Otros")));
          if (cats.length > 1) {
            return `<section class="sec" id="productos"><div class="wrap">${head}
              <nav class="cat-tabs" aria-label="Categorías">${cats.map((c) => `<a href="#cat-${esc(slugify(c))}">${esc(c)}</a>`).join("")}</nav>
              ${cats
                .map(
                  (c) => `<div class="cat-group" id="cat-${esc(slugify(c))}"><h3 class="cat-title">${esc(c)}</h3><div class="pgrid">${chosen
                    .filter((p) => (p.category ?? "Otros") === c)
                    .map((p) => productCard(p))
                    .join("")}</div></div>`,
                )
                .join("")}
            </div></section>`;
          }
        }
        if (s.variant === "row") {
          return `<section class="sec" id="productos"><div class="wrap">${head}<div class="prow-scroll">${chosen.map((p) => productCard(p)).join("")}</div></div></section>`;
        }
        if (s.variant === "featured") {
          return `<section class="sec" id="productos"><div class="wrap">${head}<div class="pgrid pgrid-featured">${chosen.slice(0, 6).map((p) => productCard(p, true)).join("")}</div></div></section>`;
        }
        return `<section class="sec" id="productos"><div class="wrap">${head}<div class="pgrid">${chosen.map((p) => productCard(p)).join("")}</div></div></section>`;
      }

      case "productSpotlight": {
        const p = productById.get(s.productId) ?? products[0];
        if (!p) return "";
        const specs = s.specs.slice(0, 8);
        return `<section class="sec alt" id="producto"><div class="wrap spot">
          <div class="spot-media">${productImage(p, "spot-img")}</div>
          <div class="spot-info">
            <h2${ed(fp("heading"))}>${esc(s.heading)}</h2>
            <ul class="spot-bullets">${s.bullets.slice(0, 4).map((b, bi) => `<li>${icon(b.icon)}<div><strong${ed(fp(`bullets.${bi}.title`))}>${esc(b.title)}</strong><span${ed(fp(`bullets.${bi}.description`))}>${esc(b.description)}</span></div></li>`).join("")}</ul>
            ${specs.length ? `<dl class="specs">${specs.map((sp) => `<div><dt>${esc(sp.label)}</dt><dd>${esc(sp.value)}</dd></div>`).join("")}</dl>` : ""}
            <div class="prow prow-lg">${priceHtml(p)}</div>
            ${orderButton(p, "btn", p.isService ? "Agendar por WhatsApp" : "Pedir por WhatsApp")}
          </div>
        </div></section>`;
      }

      case "promo": {
        const promoImg = safeUrl(s.image) ?? safeUrl(products.find((p) => p.imageUrl)?.imageUrl) ?? null;
        if (!s.countdown && !promoImg && !s.seal) {
          return `<section class="promo promo-${s.tone}"><div class="wrap promo-inner">
          <div>${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${rich(s.heading)}</h2><p${ed(fp("body"))}>${esc(s.body)}</p></div>
          <a class="btn ${s.tone === "accent" ? "btn-invert" : ""}" href="${esc(href("promo"))}"${ed(fp("ctaLabel"))}>${esc(s.ctaLabel)}</a>
        </div></section>`;
        }
        const cd = s.countdown
          ? `<div class="cd" data-countdown role="timer" aria-label="Tiempo que queda de la oferta">${[["d", "días"], ["h", "horas"], ["m", "min"], ["s", "seg"]].map(([k, l]) => `<div><b data-cd="${k}">00</b><span>${l}</span></div>`).join("")}</div>`
          : "";
        const media = promoImg
          ? `<div class="promo-media rv" data-tilt><img src="${esc(promoImg)}" alt="" loading="lazy"${imgMark}>${s.seal ? `<span class="seal"${ed(fp("seal"))}>${esc(s.seal)}</span>` : ""}<i class="glow" aria-hidden="true"></i></div>`
          : "";
        return `<section class="promo promo-rich promo-${s.tone}" id="oferta"><div class="wrap promo-rich-grid${promoImg ? "" : " no-media"}">
          <div class="promo-copy">${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${rich(s.heading)}</h2><p${ed(fp("body"))}>${esc(s.body)}</p>${cd}
          <a class="btn ${s.tone === "accent" ? "btn-invert" : ""}" href="${esc(href("promo"))}"${ed(fp("ctaLabel"))}>${esc(s.ctaLabel)}</a></div>
          ${media}
        </div></section>`;
      }

      case "showroom": {
        const pool = s.productIds.length > 0 ? s.productIds.map((id) => productById.get(id)).filter((p): p is CatalogProduct => !!p) : products;
        const list = pool.filter((p) => safeUrl(p.imageUrl)).slice(0, 6);
        if (list.length === 0) {
          return ctx.preview ? `<section class="sec"><div class="wrap"><div class="empty-note">Aquí aparecerá el visor. Agrega productos con foto en <strong>Productos</strong>.</div></div></section>` : "";
        }
        const spots = [["4%", "10%"], ["58%", "6%"], ["2%", "62%"], ["60%", "70%"]];
        const bubbles = s.bubbles.slice(0, 4).map((b, bi) => `<li style="--x:${spots[bi][0]};--y:${spots[bi][1]};--d:${(0.5 + bi * 0.45).toFixed(2)}s"><b${ed(fp(`bubbles.${bi}.title`))}>${esc(b.title)}</b><span${ed(fp(`bubbles.${bi}.description`))}>${esc(b.description)}</span></li>`).join("");
        const factIcons = ["shield", "truck", "chat"];
        return `<section class="sec" id="visor"><div class="wrap">
          ${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2>
          <div class="shw rv" data-showroom>
            <div class="shw-main">
              <div class="shw-stage" data-viewer tabindex="0" role="group" aria-label="Visor del producto: arrastra para girarlo o usa las flechas del teclado">
                ${list
                  .map((p, i) => {
                    // 3+ photos of the same product from other angles: the viewer turns through them all.
                    const frames = [safeUrl(p.imageUrl), ...(p.galleryUrls ?? []).map(safeUrl)].filter((u): u is string => !!u).map((u) => u.replace(/\|/g, "%7C"));
                    return `<figure class="shw-panel" data-stage="${i}"${i > 0 ? " hidden" : ""}><img src="${esc(safeUrl(p.imageUrl) ?? "")}" alt="${esc(p.name)}" draggable="false"${frames.length >= 3 ? ` data-frames="${esc(frames.join("|"))}"` : ""}></figure>`;
                  })
                  .join("")}
                ${bubbles ? `<ol class="shw-bubbles">${bubbles}</ol>` : ""}
                <p class="shw-hint" aria-hidden="true">↔ Arrastra para girar</p>
              </div>
              ${s.bubbles.length ? `<ol class="shw-chat" aria-label="Características">${s.bubbles.slice(0, 4).map((b) => `<li><b>${esc(b.title)}</b><span>${esc(b.description)}</span></li>`).join("")}</ol>` : ""}
              <div class="shw-thumbs">${list.map((p, i) => `<button type="button" class="shw-thumb" data-thumb="${i}" data-pid="${esc(p.id)}" aria-pressed="${i === 0 ? "true" : "false"}"><img src="${esc(safeUrl(p.imageUrl) ?? "")}" alt=""><span>${esc(p.name)}</span><small>${p.price !== null ? esc(formatMoney(p.price, p.currency)) : "Consultar"}</small></button>`).join("")}</div>
            </div>
            <div class="shw-side">
              ${list.map((p, i) => `<div class="shw-info" data-info="${i}"${i > 0 ? " hidden" : ""}>${p.category ? `<p class="pcat">${esc(p.category)}</p>` : ""}<h3>${esc(p.name)}</h3>${p.description ? `<p class="shw-desc">${esc(p.description.slice(0, 220))}</p>` : ""}<div class="prow prow-lg">${priceHtml(p)}</div>${orderButton(p, "btn btn-block", p.isService ? "Agendar por WhatsApp" : "Pedir por WhatsApp")}</div>`).join("")}
              ${s.facts.length ? `<ul class="shw-facts">${s.facts.slice(0, 3).map((f, fi) => `<li>${icon(factIcons[fi] ?? "check")}<div><b${ed(fp(`facts.${fi}.title`))}>${esc(f.title)}</b><span${ed(fp(`facts.${fi}.description`))}>${esc(f.description)}</span></div></li>`).join("")}</ul>` : ""}
            </div>
          </div>
        </div></section>`;
      }

      case "quoter": {
        const pool = (s.productIds.length > 0 ? s.productIds.map((id) => productById.get(id)).filter((p): p is CatalogProduct => !!p) : products).filter((p) => p.price !== null && p.price > 0).slice(0, 8);
        if (pool.length < 2) {
          return ctx.preview ? `<section class="sec"><div class="wrap"><div class="empty-note">Aquí aparecerá el cotizador. Necesita al menos 2 productos con precio en <strong>Productos</strong>.</div></div></section>` : "";
        }
        const months = s.months || 48;
        const cur = pool[0].currency;
        const prices = pool.map((p) => p.price as number);
        const nice = (v: number, up: boolean) => {
          const step = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(v, 1))) - 1));
          return (up ? Math.ceil(v / step) : Math.floor(v / step)) * step;
        };
        const tmin = nice(Math.min(...prices) * 0.6, false);
        const tmax = nice(Math.max(...prices) * 1.15, true);
        const cmin = nice(tmin / months, false);
        const cmax = nice(tmax / months, true);
        const hasShowroom = sections.some(({ s: x }) => x.type === "showroom");
        return `<section class="sec alt" id="cotizador"><div class="wrap narrow-lg">
          ${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2>${s.intro ? `<p class="intro"${ed(fp("intro"))}>${esc(s.intro)}</p>` : ""}
          <div class="qt rv" data-quoter data-cur="${esc(cur)}" data-months="${months}" data-tmin="${tmin}" data-tmax="${tmax}" data-cmin="${cmin}" data-cmax="${cmax}">
            <div class="qt-head">
              <div class="qt-modes" role="group" aria-label="Cómo quieres comparar"><button type="button" class="on" data-mode="total" aria-pressed="true">Precio total</button><button type="button" data-mode="cuota" aria-pressed="false">Cuota mensual</button></div>
              <p class="qt-count" data-qcount aria-live="polite">${pool.length} productos</p>
            </div>
            <label class="qt-label" for="qt-range-${index}"><span data-qunit>Tu presupuesto total</span><output data-qbudget>${esc(formatMoney(Math.round((tmin + tmax) / 2), cur))}</output></label>
            <input id="qt-range-${index}" class="qt-range" type="range" min="${tmin}" max="${tmax}" step="${Math.max(1, Math.round((tmax - tmin) / 200))}" value="${Math.round(tmin + (tmax - tmin) * 0.55)}" aria-label="Tu presupuesto">
            <ul class="qt-list">${pool
              .map(
                (p) => `<li class="qt-row" data-qprice="${p.price}">${p.imageUrl && safeUrl(p.imageUrl) ? `<img src="${esc(safeUrl(p.imageUrl) ?? "")}" alt="" loading="lazy">` : `<span class="qt-ph" aria-hidden="true">${esc(p.name.slice(0, 1))}</span>`}
                <div class="qt-info"><b>${esc(p.name)}</b><span data-qcost>${esc(formatMoney(p.price as number, p.currency))}</span><div class="qt-bar"><i data-qbar></i></div><p data-qstate></p></div>
                ${hasShowroom ? `<a class="btn btn-ghost btn-sm" href="#visor" data-view="${esc(p.id)}">Verlo en el visor</a>` : orderButton(p, "btn btn-sm", p.isService ? "Agendar" : "Pedir")}</li>`,
              )
              .join("")}</ul>
            <p class="qt-note">${esc(s.note || `Simulación de referencia${months ? `: la cuota divide el precio en ${months} meses, sin intereses` : ""}. Las condiciones reales las confirmamos contigo.`)}</p>
          </div>
        </div></section>`;
      }

      case "fan": {
        const pool = (s.productIds.length > 0 ? s.productIds.map((id) => productById.get(id)).filter((p): p is CatalogProduct => !!p) : products).filter((p) => safeUrl(p.imageUrl)).slice(0, 10);
        if (pool.length === 0) {
          return ctx.preview ? `<section class="sec"><div class="wrap"><div class="empty-note">Aquí aparecerá la colección. Agrega productos con foto en <strong>Productos</strong>.</div></div></section>` : "";
        }
        return `<section class="sec alt" id="coleccion"><div class="wrap">
          ${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2>${s.intro ? `<p class="intro"${ed(fp("intro"))}>${esc(s.intro)}</p>` : ""}
          <div class="fan rv" data-fan>
            <div class="fan-stage">${pool.map((p, i) => `<article class="fan-card" data-fcard="${i}"><img src="${esc(safeUrl(p.imageUrl) ?? "")}" alt="${esc(p.name)}" draggable="false" loading="lazy"><div class="fan-cap"><b>${esc(p.name)}</b><span>${p.price !== null ? esc(formatMoney(p.price, p.currency)) : "Consultar"}</span></div></article>`).join("")}</div>
            <div class="fan-sheet">${pool
              .map(
                (p, i) => `<div class="fan-info" data-finfo="${i}"${i > 0 ? " hidden" : ""}>
                  <div class="fan-tabs" role="tablist"><button type="button" role="tab" class="on" aria-selected="true" data-ftab="que">Qué es</button><button type="button" role="tab" aria-selected="false" data-ftab="inv">Inversión</button></div>
                  <div data-fpane="que"><h3>${esc(p.name)}</h3><p>${esc(p.description ? p.description.slice(0, 260) : p.category ?? "")}</p></div>
                  <div data-fpane="inv" hidden><div class="prow prow-lg">${priceHtml(p)}</div>${orderButton(p, "btn", p.isService ? "Agendar por WhatsApp" : "Pedir por WhatsApp")}</div>
                </div>`,
              )
              .join("")}</div>
          </div>
        </div></section>`;
      }

      case "traveler": {
        const p = productById.get(s.productId);
        const img = p ? safeUrl(p.imageUrl) : null;
        const scenes = s.scenes.slice(0, 4);
        if (!p || !img || scenes.length < 2) {
          return ctx.preview ? `<section class="sec"><div class="wrap"><div class="empty-note">Aquí aparecerá el producto viajero. Elige un producto con foto en <strong>Productos</strong>.</div></div></section>` : "";
        }
        return `<section class="tv" id="historia"><div class="wrap">${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2></div>
          <div class="tv-track" data-traveler style="--n:${scenes.length}">
            <div class="tv-stage">
              <img class="tv-product" src="${esc(img)}" alt="${esc(p.name)}" draggable="false">
              ${scenes
                .map(
                  (c, ci) => `<article class="tv-scene" data-tvs="${ci}"><img class="tv-own" src="${esc(img)}" alt="${esc(p.name)}" loading="lazy"><div class="tv-text"><span class="tv-n">${String(ci + 1).padStart(2, "0")}</span><h3${ed(fp(`scenes.${ci}.title`))}>${esc(c.title)}</h3><p${ed(fp(`scenes.${ci}.description`))}>${esc(c.description)}</p></div></article>`,
                )
                .join("")}
            </div>
          </div>
        </section>`;
      }

      case "marquee": {
        const lines = s.lines.filter(Boolean).slice(0, 2);
        if (lines.length === 0) return "";
        const row = (text: string, rev: boolean) => `<div class="mq-row${rev ? " rev" : ""}" aria-hidden="true"><div class="mq-track">${Array.from({ length: 8 }, () => `<span>${esc(text)}</span>`).join("")}</div></div>`;
        return `<section class="mq"><p class="sr-only">${esc(lines.join(". "))}</p>${lines.map((l, li) => row(l, li % 2 === 1)).join("")}</section>`;
      }

      case "event": {
        const has = !!(s.when.trim() || s.date.trim());
        if (!has && !edit) return ctx.preview ? `<section class="sec"><div class="wrap"><div class="empty-note">Aquí aparecerá la fecha de tu evento. Elige este bloque en <strong>Bloques</strong> y escribe la fecha.</div></div></section>` : "";
        const until = s.date.trim() && eventDateOk(s.date.trim()) ? toIsoWithZone(s.date.trim()) : "";
        const cd = until
          ? `<div class="cd" data-countdown data-until="${esc(until)}" role="timer" aria-label="Tiempo que falta">${[["d", "días"], ["h", "horas"], ["m", "min"], ["s", "seg"]].map(([k, l]) => `<div><b data-cd="${k}">00</b><span>${l}</span></div>`).join("")}</div>`
          : "";
        const whenHtml = s.when.trim() || edit ? `<p class="ev-when"${ed(fp("when"))}>${esc(s.when || "Escribe la fecha y la hora")}</p>` : "";
        const whereHtml = s.where.trim() || edit ? `<p class="ev-where"${ed(fp("where"))}>${esc(s.where || "Escribe el lugar o la modalidad")}</p>` : "";
        return `<section class="sec alt" id="fecha"><div class="wrap narrow-lg"><div class="ev-card">
          ${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2>${whenHtml}${whereHtml}${cd}
          <a class="btn btn-lg" href="${esc(ctaHref("evento"))}"${ed(fp("ctaLabel"))}>${esc(s.ctaLabel)}</a>
        </div></div></section>`;
      }

      case "offer": {
        const incl = s.includes.filter((l) => l.trim());
        const priceHtml2 = s.price.trim() || edit ? `<p class="of-price"${ed(fp("price"))}>${esc(s.price || "Escribe el precio")}</p>${s.priceNote || edit ? `<p class="of-note"${ed(fp("priceNote"))}>${esc(s.priceNote ?? "Aclaración del precio (opcional)")}</p>` : ""}` : "";
        return `<section class="sec" id="oferta-caja"><div class="wrap narrow-lg"><div class="of-card">
          ${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2><p class="intro"${ed(fp("body"))}>${esc(s.body)}</p>
          ${incl.length ? `<ul class="of-list">${s.includes.map((l, li) => (l.trim() ? `<li>${icon("check")}<span${ed(fp(`includes.${li}`))}>${esc(l)}</span></li>` : "")).join("")}</ul>` : ""}
          ${priceHtml2}
          <a class="btn btn-lg" href="${esc(ctaHref("oferta"))}"${ed(fp("ctaLabel"))}>${esc(s.ctaLabel)}</a>
        </div></div></section>`;
      }

      case "guarantee":
        return `<section class="sec alt" id="garantia"><div class="wrap narrow-lg"><div class="gu-card">${icon("shield")}<div><h2${ed(fp("heading"))}>${esc(s.heading)}</h2><p${ed(fp("body"))}>${esc(s.body)}</p></div></div></div></section>`;

      case "testimonials": {
        const list = s.items.map((t, ti) => ({ t, ti })).filter(({ t }) => t.quote.trim());
        if (list.length === 0 && !edit) return "";
        return `<section class="sec" id="testimonios"><div class="wrap">${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2>
          <div class="tm-grid">${list.map(({ t, ti }) => `<figure class="tm"><blockquote${ed(fp(`items.${ti}.quote`))}>${esc(t.quote)}</blockquote><figcaption>${t.name.trim() ? `<b${ed(fp(`items.${ti}.name`))}>${esc(t.name)}</b>` : ""}${t.role.trim() ? ` <span${ed(fp(`items.${ti}.role`))}>${esc(t.role)}</span>` : ""}</figcaption></figure>`).join("")}</div>
        </div></section>`;
      }

      case "video": {
        const embed = toEmbedUrl(s.url);
        if (!embed && !ctx.preview) return "";
        const intro = s.intro ? `<p class="intro"${ed(fp("intro"))}>${esc(s.intro)}</p>` : "";
        const frame = embed
          ? `<div class="vid-frame"><iframe src="${esc(embed)}" title="${esc(s.heading)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
          : edit
            ? `<div class="vid-frame vid-empty"><span class="vid-ph" data-ph="Toca aquí y pega el enlace de tu video (YouTube, Vimeo, Wistia o Loom)"${ed(fp("url"))}></span></div>`
            : `<div class="vid-frame vid-empty"><p>Aquí irá tu video.</p></div>`;
        const linkEditor = edit && embed ? `<p class="vid-link">Enlace del video: <span${ed(fp("url"))}>${esc(s.url)}</span></p>` : "";
        return `<section class="sec" id="video"><div class="wrap narrow-lg center">${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2>${intro}${frame}${linkEditor}</div></section>`;
      }

      case "comparison":
        return `<section class="sec"><div class="wrap narrow-lg">
          <h2${ed(fp("heading"))}>${esc(s.heading)}</h2>
          <div class="cmp-wrap"><table class="cmp"><thead><tr><th></th><th class="us"${ed(fp("usLabel"))}>${esc(s.usLabel)}</th><th${ed(fp("othersLabel"))}>${esc(s.othersLabel)}</th></tr></thead>
          <tbody>${s.rows.slice(0, 6).map((r, ri) => `<tr><th scope="row"${ed(fp(`rows.${ri}.label`))}>${esc(r.label)}</th><td class="us" data-label="${esc(s.usLabel)}"${ed(fp(`rows.${ri}.us`))}>${esc(r.us)}</td><td data-label="${esc(s.othersLabel)}"${ed(fp(`rows.${ri}.others`))}>${esc(r.others)}</td></tr>`).join("")}</tbody></table></div>
        </div></section>`;

      case "agenda":
        return `<section class="sec alt" id="agenda"><div class="wrap">
          ${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2>
          <div class="agenda">${s.items
            .slice(0, 6)
            .map((it, i) => `<article class="ag-item"><div class="ag-num">${String(i + 1).padStart(2, "0")}</div><div><p class="ag-when"${ed(fp(`items.${i}.when`))}>${esc(it.when)}</p><h3${ed(fp(`items.${i}.title`))}>${esc(it.title)}</h3><p${ed(fp(`items.${i}.description`))}>${esc(it.description)}</p></div></article>`)
            .join("")}</div>
          <div class="center mt"><a class="btn" href="${esc(href("agenda"))}">Quiero participar</a></div>
        </div></section>`;

      case "host": {
        const hostImage = safeUrl(s.image) ?? (heroImage ? (photos[1] ?? heroImage) : null);
        const hostSlot = !hostImage && ctx.preview;
        return `<section class="sec" id="nosotros"><div class="wrap host${hostImage || hostSlot ? "" : " host-noimg"}">
          ${hostImage ? `<img class="host-img" src="${esc(hostImage)}" alt=""${imgMark}>` : hostSlot ? photoSlot("ph-4x3") : ""}
          <div>${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2><p class="host-name"><span class="host-n"${ed(fp("name"))}>${esc(s.name)}</span>${s.role ? ` <span>· <span${ed(fp("role"))}>${esc(s.role)}</span></span>` : ""}</p><p class="host-body"${ed(fp("body"))}>${esc(s.body)}</p></div>
        </div></section>`;
      }

      case "objections": {
        const faqList = `<div class="faq">${s.items
          .slice(0, 6)
          .map((o, i) => `<details${i === 0 ? " open" : ""}><summary><span${ed(fp(`items.${i}.question`))}>${esc(o.question)}</span><span class="faq-plus" aria-hidden="true">+</span></summary><p${ed(fp(`items.${i}.answer`))}>${esc(o.answer)}</p></details>`)
          .join("")}</div>`;
        if (s.variant === "split") {
          return `<section class="sec" id="preguntas"><div class="wrap faq-split"><div class="faq-head">${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2></div>${faqList}</div></section>`;
        }
        return `<section class="sec" id="preguntas"><div class="wrap narrow-lg">
          ${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2>
          ${faqList}
        </div></section>`;
      }

      case "stats":
        return `<section class="stats"><div class="wrap stats-grid">${s.items
          .slice(0, 4)
          .map((it, ii) => `<div><p class="stat-v"${ed(fp(`items.${ii}.value`))}>${esc(it.value)}</p><p class="stat-l"${ed(fp(`items.${ii}.label`))}>${esc(it.label)}</p></div>`)
          .join("")}</div></section>`;

      case "gallery": {
        if (photos.length === 0) return "";
        const layout = s.layout === "mosaic" || s.layout === "carousel" ? s.layout : "grid";
        const tip = note("La galería muestra tus fotos más recientes. Sube más desde “Imagen de fondo” de cualquier bloque.");
        const pics = (n: number) => photos.slice(0, n).map((u) => `<img src="${esc(u)}" alt="" loading="lazy"${tip}>`).join("");
        const grid =
          layout === "carousel"
            ? `<div class="gal-slider" data-slider>${pics(12)}</div>`
            : layout === "mosaic"
              ? `<div class="gal-mosaic">${pics(12)}</div>`
              : `<div class="gallery g${Math.min(photos.length, 8)}">${pics(8)}</div>`;
        return `<section class="sec"><div class="wrap">${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2>
          ${grid}</div></section>`;
      }

      case "leadForm":
        return `<section class="sec alt" id="registro"><div class="wrap narrow">
          ${kickerHtml(s.kicker, fp("kicker"))}<h2${ed(fp("heading"))}>${esc(s.heading)}</h2><p class="intro"${ed(fp("body"))}>${esc(s.body)}</p>
          ${leadFormHtml(s.buttonLabel)}
        </div></section>`;

      case "cta":
        if (s.variant === "giant") {
          return `<section class="final-cta final-giant"><div class="wrap">
          <h2${ed(fp("heading"))}>${esc(s.heading)}</h2>
          <div class="final-row"><p class="intro"${ed(fp("body"))}>${esc(s.body)}</p><a class="btn btn-lg" href="${esc(href("cta-final"))}"${ed(fp("ctaLabel"))}>${esc(s.ctaLabel)}</a></div>
        </div></section>`;
        }
        return `<section class="final-cta"><div class="wrap narrow center">
          <h2${ed(fp("heading"))}>${esc(s.heading)}</h2><p class="intro"${ed(fp("body"))}>${esc(s.body)}</p>
          <a class="btn btn-lg" href="${esc(href("cta-final"))}"${ed(fp("ctaLabel"))}>${esc(s.ctaLabel)}</a>
        </div></section>`;
    }
  };

  // Adds the builder markers and the owner's background photo to a rendered
  // section: the photo goes behind it with a dark veil, and the section's own
  // colors flip to light text so everything stays readable. (The portada in
  // its full-photo form already has its own background.)
  const decorate = (html: string, s: Section, index: number): string =>
    html.replace(/^(\s*)<section\b([^>]*)>/, (_m, lead: string, attrs: string) => {
      const bgUrl = safeUrl(s.bgImage);
      const photoBg = !!bgUrl || /class="hero hero-full"/.test(attrs);
      const classes: string[] = [];
      const styles: string[] = [];
      if (bgUrl && !/class="hero hero-full"/.test(attrs)) {
        classes.push("has-bg");
        styles.push(`--bgimg:url('${cssUrl(bgUrl)}')`);
      }
      const look = lookParts(s.look, { photoBg, showAll: edit });
      classes.push(...look.classes);
      styles.push(...Object.entries(look.vars).map(([k, v]) => `${k}:${v}`));
      let a = attrs;
      if (classes.length) a = /class="/.test(a) ? a.replace(/class="([^"]*)"/, `class="$1 ${classes.join(" ")}"`) : `${a} class="${classes.join(" ")}"`;
      if (styles.length) a = /style="/.test(a) ? a.replace(/style="([^"]*)"/, (_x, css: string) => `style="${css};${styles.join(";")}"`) : `${a} style="${styles.join(";")}"`;
      return `${lead}<section${a}${edit ? ` data-sec="${index}" data-type="${s.type}"` : ""}>`;
    });
  // The elements the owner added under a block's title (a text, a button).
  const withExtras = (html: string, s: Section, index: number): string => {
    const list = s.extras ?? [];
    if (list.length === 0) return html;
    const extrasHtml = `<div class="extras">${list
      .map((x, k) =>
        x.type === "text"
          ? `<p class="extra-text"${ed(`sections.${index}.extras.${k}.text`)}>${esc(x.text)}</p>`
          : x.type === "image"
            ? `<img class="extra-img" src="${esc(x.url)}" alt="" loading="lazy">`
            : `<a class="btn extra-btn" href="${esc(x.url || href("boton-extra"))}"${/^https?:/.test(x.url) ? ' target="_blank" rel="noopener"' : ""}${ed(`sections.${index}.extras.${k}.label`)}>${esc(x.label)}</a>`,
      )
      .join("")}</div>`;
    const at = html.search(/<\/h[12]>/);
    if (at < 0) return html.replace(/<\/section>\s*$/, `${extrasHtml}</section>`);
    const end = at + 5;
    return html.slice(0, end) + extrasHtml + html.slice(end);
  };
  const body = sections
    .map(({ s, i }) => withExtras(decorate(renderSection(s, i), s, i), s, i))
    .join("\n")
    // Blocks that rise into view as the page scrolls (what is on screen at load never starts hidden: see siteScript).
    .replace(/class="(feat-item|pcard[^"]*|ag-item|trust-item|stat-v|host-img)"/g, 'class="$1 rv"')
    .replace(/<li><span class="step-n">/g, '<li class="rv"><span class="step-n">');
  const firstHero = content.sections.find((s) => s.type === "hero");
  const navLinks: { href: string; label: string }[] = [];
  if (sections.some(({ s }) => s.type === "productGrid") && products.length > 0) navLinks.push({ href: "#productos", label: "Productos" });
  if (sections.some(({ s }) => s.type === "agenda")) navLinks.push({ href: "#agenda", label: "Agenda" });
  if (sections.some(({ s }) => s.type === "steps")) navLinks.push({ href: "#como-funciona", label: "Cómo funciona" });
  if (sections.some(({ s }) => s.type === "objections")) navLinks.push({ href: "#preguntas", label: "Preguntas" });
  const isShop = content.pageType === "producto" || content.pageType === "tienda";

  const decor =
    style.heroDecor === "grid"
      ? `background-image: linear-gradient(color-mix(in srgb, var(--text) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--text) 8%, transparent) 1px, transparent 1px); background-size: 44px 44px; mask-image: radial-gradient(ellipse at top, #000 30%, transparent 75%);`
      : style.heroDecor === "glow"
        ? `background: radial-gradient(50% 60% at 70% 20%, color-mix(in srgb, var(--primary) 35%, transparent), transparent 70%);`
        : style.heroDecor === "blob"
          ? `background: radial-gradient(40% 50% at 85% 30%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 70%), radial-gradient(30% 40% at 10% 90%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 70%);`
          : "display:none;";

  // The top bar: phrases separated by "·" or "✦" scroll continuously (paused on hover); the editor sees it still so it can be edited.
  const phrases = (content.announcement ?? "").split(/\s*[·✦|]\s*/).map((t) => t.trim()).filter(Boolean);
  const announcementHtml = !content.announcement
    ? ""
    : edit || phrases.length === 0
      ? `<div class="annc"${ed("announcement")}>${esc(content.announcement)}</div>`
      : `<div class="annc annc-run" role="marquee" aria-label="${esc(phrases.join(". "))}"><div class="annc-track" aria-hidden="true">${Array.from({ length: 2 }, () => `<div class="annc-set">${Array.from({ length: Math.max(2, Math.ceil(6 / phrases.length)) }, () => phrases.map((t) => `<span>${esc(t)}</span><i>✦</i>`).join("")).join("")}</div>`).join("")}</div></div>`;

  return `<!doctype html>
<html lang="es"${edit ? ' data-fx="off"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(ctx.businessName)}${firstHero && firstHero.type === "hero" ? ` · ${esc(firstHero.heading)}` : ""}</title>
<meta name="description" content="${esc(firstHero && firstHero.type === "hero" ? firstHero.subheading : ctx.businessName)}">
${fontLink(fonts)}
<style>
:root{color-scheme:light;--primary:${primary};--primary-base:${primary};--primary-ink:${primaryInk};--primary-on-dark:color-mix(in srgb,${primary} 50%,#fff);--btn-text:${readableTextColor(primary)};--bg:${bg};--surface:${surface};--text:${textColor};
--muted:color-mix(in srgb,var(--text) 64%,transparent);--line:color-mix(in srgb,var(--text) 12%,transparent);
--hf:${fontStack(theme.headingFont)};--bf:${fontStack(theme.bodyFont)};
--r:${style.radius};--br:${style.btnRadius};--pad:${style.sectionPad};--max:${style.maxWidth}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--bf);font-size:17px;line-height:1.65;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
h1,h2,h3{font-family:var(--hf);font-weight:${style.headingWeight};letter-spacing:${style.headingTracking};text-transform:${style.headingTransform};line-height:1.06;margin:0 0 .5em;text-wrap:balance}
h1{font-size:calc(${style.h1} * var(--ts,1))}
h2{font-size:calc(${style.h2} * var(--ts,1));line-height:1.1}
h3{font-size:19px;line-height:1.25;letter-spacing:-.01em;text-transform:none}
p{margin:0 0 1em}
a{color:inherit}
a:focus-visible,button:focus-visible,summary:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--primary);outline-offset:3px}
.wrap{max-width:var(--max);margin:0 auto;padding:0 24px}
.narrow{max-width:760px}.narrow-lg{max-width:900px}
.center{text-align:center}.mt{margin-top:32px}
.extras{margin:6px 0 20px;display:flex;flex-direction:column;align-items:flex-start;gap:12px}
.extra-text{max-width:64ch;margin:0;font-size:1.08em;color:var(--muted,var(--text));white-space:pre-line}
.extra-btn{margin-top:4px}
.extra-img{display:block;max-width:100%;width:min(100%,720px);height:auto;max-height:70vh;object-fit:contain;border-radius:var(--r);background:var(--surface)}
.lk-a-center .extras{align-items:center}.lk-a-center .extra-text{margin-inline:auto}.lk-a-right .extras{align-items:flex-end}
.kicker,.eyebrow{font-family:var(--bf);font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--primary-ink);margin:0 0 14px}
.intro,.lead{color:var(--muted);font-size:19px;max-width:60ch}
.center .intro,.center .lead{margin-inline:auto}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--primary);color:var(--btn-text);border:1px solid var(--primary);padding:15px 30px;border-radius:var(--br);text-decoration:none;font-weight:700;font-family:var(--bf);font-size:16px;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,opacity .15s ease}
.btn:hover{transform:translateY(-1px);box-shadow:0 10px 24px -10px color-mix(in srgb,var(--primary) 70%,transparent)}
.btn-ghost{background:transparent;color:var(--text);border-color:var(--line)}
.btn-ghost:hover{border-color:var(--text);box-shadow:none}
.btn-sm{padding:10px 16px;font-size:14px;width:100%}
.btn-soldout{opacity:.5;cursor:not-allowed;filter:grayscale(1)}
.pbadge-soldout{background:#b42318!important;color:#fff!important}
.pcard-soldout .pcard-media img{filter:grayscale(.7);opacity:.75}
.btn-lg{padding:18px 38px;font-size:18px}
.btn-block{width:100%}
.btn-invert{background:var(--btn-text);color:var(--primary-ink);border-color:var(--btn-text)}
.annc{background:var(--text);color:var(--bg);text-align:center;font-size:14px;font-weight:600;padding:9px 16px}
header.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;gap:24px;height:68px}
.brand{font-family:var(--hf);font-weight:700;font-size:20px;letter-spacing:-.02em;text-decoration:none;text-transform:none}
.nav{display:flex;gap:22px;margin-left:auto;font-size:15px}
.nav a{text-decoration:none;color:var(--muted)}
.nav a:hover{color:var(--text)}
header.top .btn{padding:10px 18px;font-size:14px}
section{position:relative}
.sec{padding:var(--pad) 0}
.sec.alt,.trust{background:var(--surface)}
.sec-head{display:flex;align-items:end;justify-content:space-between;gap:16px}
.hero{padding:calc(var(--pad) * .9) 0 var(--pad);overflow:hidden}
.hero .decor{position:absolute;inset:0;pointer-events:none;${decor}}
.hero .wrap{position:relative}
.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.hero-actions.center{justify-content:center}
.hero-badge{display:inline-block;margin-top:22px;background:color-mix(in srgb,var(--primary) 14%,transparent);color:var(--primary-ink);font-weight:700;font-size:14px;padding:7px 14px;border-radius:999px}
.hl{color:var(--primary-ink)}
.chips{list-style:none;display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:22px 0 0}
.chips li{border:1px solid var(--line);border-radius:999px;padding:7px 14px;font-size:14px;font-weight:600;background:color-mix(in srgb,var(--bg) 70%,transparent)}
.hero-centered .chips{justify-content:center}
.form-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:28px;box-shadow:0 30px 60px -36px color-mix(in srgb,var(--text) 50%,transparent)}
.form-card-img{width:100%;height:auto;max-height:420px;object-fit:contain;background:var(--surface);border-radius:calc(var(--r) * .7);margin-bottom:18px}
.form-card-title{font-family:var(--hf);font-weight:700;font-size:22px;margin:0}
.form-card .lead-form{margin-top:14px}
.hero-centered{text-align:center}
.hero-centered .lead{margin-inline:auto}
.hero-wide{margin-top:56px;border-radius:var(--r);width:100%;height:auto;max-height:560px;object-fit:contain;background:var(--surface)}
.hero-split-grid{display:grid;grid-template-columns:1.05fr 1fr;gap:56px;align-items:center}
.hero-media img{width:100%;height:auto;max-height:72vh;object-fit:contain;background:var(--surface);border-radius:var(--r);${style.cardShadow ? "box-shadow:0 30px 60px -30px color-mix(in srgb,var(--text) 45%,transparent);" : ""}}
.hero-stage{position:relative;border-radius:var(--r);background:radial-gradient(120% 90% at 50% 30%,color-mix(in srgb,var(--primary) 9%,var(--bg)),var(--surface));aspect-ratio:5/4;display:flex;align-items:center;justify-content:center;overflow:hidden}
.hero-stage img{max-width:84%;max-height:80%;width:auto;height:auto;object-fit:contain;filter:drop-shadow(0 28px 26px rgba(0,0,0,.2))}
.hero-stage-cap{position:absolute;left:16px;bottom:14px;margin:0;display:flex;gap:10px;align-items:baseline;background:color-mix(in srgb,var(--bg) 88%,transparent);padding:7px 14px;border-radius:999px;font-size:14px}
.hero-stage-cap span{color:var(--muted)}
.hero-full{min-height:min(88vh,760px);display:flex;align-items:center;background-size:cover;background-position:center;color:#fff}
.hero-full .lead{color:rgba(255,255,255,.85)}
.hero-full-inner{max-width:640px}
.hero-full .btn-ghost{color:#fff;border-color:rgba(255,255,255,.5)}
.giant{font-size:clamp(64px,15vw,220px)!important;line-height:.98;margin-bottom:.25em}
.giant-row{display:grid;grid-template-columns:1.4fr 1fr;gap:40px;align-items:end}
.giant-img{width:100%;height:auto;max-height:620px;object-fit:contain;background:var(--surface);border-radius:var(--r)}
.hero-product-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:56px;align-items:center}
.hero-product-media{position:relative;background:var(--surface);border-radius:var(--r);aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden}
.hero-product-img{width:86%;height:86%;object-fit:contain}
.prow{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px;margin:6px 0 14px}
.price{font-weight:700;font-size:18px}
.prow-lg .price{font-size:34px;color:var(--primary-ink);font-family:var(--hf)}
.compare{text-decoration:line-through;color:var(--muted);font-size:15px}
.off{background:color-mix(in srgb,var(--primary) 15%,transparent);color:var(--primary-ink);font-size:13px;font-weight:700;padding:3px 8px;border-radius:999px}
.trust{padding:30px 0;border-block:1px solid var(--line)}
.trust-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:24px}
.trust-item{display:flex;gap:14px;align-items:flex-start}
.trust-item .ico{width:30px;height:30px;flex:none;color:var(--primary-ink)}
.t-title{font-weight:700;margin:0;font-size:15px}
.t-desc{margin:0;color:var(--muted);font-size:14px}
.feat{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:22px;margin-top:40px}
.feat-item{display:flex;flex-direction:column;gap:14px}
.feat-cards .feat-item{padding:30px;border-radius:var(--r);background:var(--surface);${style.cardBorder ? "border:1px solid var(--line);" : ""}${style.cardShadow ? "box-shadow:0 16px 40px -28px color-mix(in srgb,var(--text) 40%,transparent);" : ""}}
.feat-list{grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr))}
.feat-list .feat-item{flex-direction:row;padding:18px 0;border-bottom:1px solid var(--line)}
.feat-ico{width:52px;height:52px;border-radius:calc(var(--r) * .7 + 6px);background:color-mix(in srgb,var(--primary) 13%,transparent);color:var(--primary-ink);display:flex;align-items:center;justify-content:center}
.feat-ico .ico{width:26px;height:26px}
.feat-check .ico{width:24px;height:24px;color:var(--primary-ink);flex:none}
.feat-item h3{margin-bottom:6px}
.feat-item p{margin:0;color:var(--muted);font-size:16px}
.steps{list-style:none;padding:0;margin:44px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:32px;counter-reset:s}
.steps li{border-top:2px solid var(--text);padding-top:20px}
.step-n{display:block;font-family:var(--hf);font-size:44px;font-weight:700;color:var(--primary-ink);line-height:1;margin-bottom:14px}
.steps p{color:var(--muted);margin:0}
.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:22px;margin-top:28px}
.pgrid-featured{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.prow-scroll{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(240px,1fr);gap:20px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:12px;margin-top:28px}
.prow-scroll>*{scroll-snap-align:start}
.pcard{display:flex;flex-direction:column;border-radius:var(--r);${style.cardBorder ? "border:1px solid var(--line);" : ""}background:var(--bg);overflow:hidden;transition:transform .2s ease,box-shadow .2s ease}
.pcard:hover{transform:translateY(-3px);box-shadow:0 22px 40px -28px color-mix(in srgb,var(--text) 55%,transparent)}
.pcard-media{position:relative;aspect-ratio:1/1;background:var(--surface);display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:${style.cardBorder ? "0" : "var(--r)"}}
.pcard-media img{width:100%;height:100%;object-fit:contain;transition:transform .4s ease}
.pcard:hover .pcard-media img{transform:scale(1.04)}
.img-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--hf);font-size:64px;color:color-mix(in srgb,var(--text) 22%,transparent)}
.pbadge{position:absolute;top:12px;left:12px;z-index:1;background:var(--text);color:var(--bg);font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px}
.pcard-body{padding:16px 16px 18px;display:flex;flex-direction:column;flex:1}
.pcard-body h3{font-size:17px;margin:0 0 4px}
.pcard-body .btn{margin-top:auto}
.pcat{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 4px}
.pdesc{color:var(--muted);font-size:15px;margin:0 0 8px}
.cat-tabs{display:flex;gap:10px;overflow-x:auto;margin-top:24px;padding-bottom:6px}
.cat-tabs a{flex:none;text-decoration:none;font-weight:600;font-size:15px;padding:9px 18px;border-radius:999px;border:1px solid var(--line)}
.cat-tabs a:hover{background:var(--text);color:var(--bg)}
.cat-group{scroll-margin-top:90px;margin-top:40px}
.cat-title{font-size:22px}
.spot{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.spot-media{background:var(--bg);border-radius:var(--r);aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;overflow:hidden}
.spot-img{width:100%;height:100%;object-fit:contain}
.spot-bullets{list-style:none;padding:0;margin:20px 0;display:grid;gap:16px}
.spot-bullets li{display:flex;gap:14px}
.spot-bullets .ico{width:26px;height:26px;color:var(--primary-ink);flex:none}
.spot-bullets strong{display:block}
.spot-bullets span{color:var(--muted);font-size:15px}
.specs{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:0 0 20px;border-top:1px solid var(--line)}
.specs div{padding:10px 0;border-bottom:1px solid var(--line)}
.specs dt{font-size:13px;color:var(--muted)}
.specs dd{margin:0;font-weight:600}
.promo{padding:calc(var(--pad) * .65) 0}
.promo-dark{background:var(--text);color:var(--bg)}
.promo-dark .kicker{color:var(--primary-ink)}
.promo-dark .btn{background:var(--bg);color:var(--text);border-color:var(--bg)}
.promo-accent{background:var(--primary);color:var(--btn-text)}
.promo-accent .kicker{color:var(--btn-text);opacity:.8}
.promo-soft{background:color-mix(in srgb,var(--primary) 12%,var(--bg))}
.promo-inner{display:flex;align-items:center;justify-content:space-between;gap:32px}
.promo h2{margin-bottom:.25em}
.promo p{margin:0;opacity:.8;max-width:56ch}
.k-row{display:flex;align-items:baseline;gap:14px;margin:0 0 14px}
.k-row .kicker{margin:0}
.k-n{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;font-weight:600;letter-spacing:.14em;color:var(--muted)}
.hero-wm{padding:calc(var(--pad) * .55) 0 var(--pad);overflow:hidden}
.wm-top{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--line);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.wm{font-family:var(--hf);font-weight:${style.headingWeight};line-height:.98;letter-spacing:-.045em;margin:.1em 0 .06em;color:var(--text);overflow-wrap:anywhere;text-wrap:balance}
.wm-xl{font-size:clamp(72px,22vw,320px)}.wm-lg{font-size:clamp(56px,15vw,240px)}.wm-md{font-size:clamp(40px,10vw,170px)}
.wm-h1{font-size:clamp(22px,3.2vw,40px)!important;max-width:26ch;margin:.25em 0 .6em!important;line-height:1.15!important;letter-spacing:-.01em!important}
.wm-row{display:flex;gap:32px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap}
.wm-row .lead{max-width:46ch;margin-bottom:0}
.wm-img{display:block;width:100%;height:auto;max-height:560px;object-fit:contain;background:var(--surface);border-radius:var(--r);margin-top:44px}
.scroll-hint{margin:26px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:var(--muted)}
.mq-trust{padding:16px 0}
.mq-trust .mq-track span{font-family:var(--bf);font-weight:700;font-size:clamp(14px,1.5vw,18px);letter-spacing:.04em;text-transform:uppercase;color:var(--text);padding-right:2.4em}
.mq-trust .mq-track span::after{content:"✦";margin-left:2.4em;color:var(--primary-ink)}
.feat-bento{grid-template-columns:repeat(6,minmax(0,1fr));grid-auto-rows:minmax(150px,auto)}
.feat-bento .feat-item{grid-column:span 2;padding:26px;border-radius:var(--r);background:var(--surface);border:1px solid var(--line);justify-content:space-between}
.feat-bento .feat-item:nth-child(1){grid-column:span 3;grid-row:span 2;background:color-mix(in srgb,var(--primary) 12%,var(--surface))}
.feat-bento .feat-item:nth-child(2),.feat-bento .feat-item:nth-child(3){grid-column:span 3}
.feat-bento[data-n="4"] .feat-item:nth-child(4){grid-column:span 6}
.feat-bento[data-n="5"] .feat-item:nth-child(4),.feat-bento[data-n="5"] .feat-item:nth-child(5){grid-column:span 3}
.feat-bento[data-n="3"] .feat-item:nth-child(n+2){grid-column:span 3}
.feat-bento .feat-item:nth-child(1) h3{font-size:clamp(22px,2.6vw,30px)}
.feat-numbered{grid-template-columns:1fr;gap:0}
.feat-numbered .feat-item{display:grid;grid-template-columns:72px minmax(0,1fr) minmax(0,1.4fr);gap:20px;align-items:baseline;padding:26px 0;border-top:1px solid var(--line)}
.feat-numbered .feat-item:last-child{border-bottom:1px solid var(--line)}
.feat-num{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;font-weight:600;letter-spacing:.1em;color:var(--primary-ink)}
.feat-numbered h3{margin:0;font-size:clamp(20px,2.4vw,28px)}
.steps-timeline{grid-template-columns:1fr;gap:0}
.steps-timeline li{display:grid;grid-template-columns:minmax(72px,150px) minmax(0,1fr);column-gap:24px;padding:28px 0;border-top:1px solid var(--line)}
.steps-timeline li:last-child{border-bottom:1px solid var(--line)}
.steps-timeline .step-n{grid-row:span 2;font-size:clamp(40px,6vw,76px);margin:0}
.steps-timeline h3{margin:0 0 6px}
.steps-big{grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:20px}
.steps-big li{border:1px solid var(--line);border-radius:var(--r);padding:28px;background:var(--bg)}
.steps-big .step-n{font-size:clamp(64px,9vw,112px);color:transparent;-webkit-text-stroke:1.5px var(--primary-ink);margin-bottom:8px}
.faq-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.7fr);gap:clamp(28px,5vw,72px);align-items:start}
.faq-split .faq-head{position:sticky;top:96px}
.faq-split .faq{margin-top:0}
.final-giant{text-align:left}
.final-giant h2{font-size:clamp(40px,8.5vw,132px);line-height:1;letter-spacing:-.04em;max-width:14ch;margin:0 0 .4em}
.final-row{display:flex;gap:32px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.final-row .intro{margin:0;max-width:44ch}
@media (max-width:760px){
  .feat-bento{grid-template-columns:1fr}
  .feat-bento .feat-item,.feat-bento .feat-item:nth-child(n){grid-column:1!important;grid-row:auto!important}
  .feat-numbered .feat-item{grid-template-columns:44px minmax(0,1fr);row-gap:6px}
  .feat-numbered .feat-item p{grid-column:2}
  .faq-split{grid-template-columns:1fr}
  .faq-split .faq-head{position:static}
  .steps-timeline li{grid-template-columns:56px minmax(0,1fr);column-gap:16px}
}
.ev-card,.of-card{text-align:center;padding:clamp(28px,5vw,56px);border-radius:calc(var(--r) + 6px);background:var(--bg);border:1px solid var(--line)}
.ev-when{font-family:var(--hf);font-size:clamp(26px,4.4vw,44px);line-height:1.1;font-weight:${style.headingWeight};margin:18px 0 6px}
.ev-where{color:var(--muted);margin:0 0 6px;font-size:17px}
.ev-card .cd{margin:22px auto;justify-content:center}.ev-card .btn{margin-top:14px}
.of-card{text-align:left}
.of-list{list-style:none;padding:0;margin:20px 0;display:grid;gap:10px}
.of-list li{display:flex;gap:12px;align-items:flex-start}.of-list .ico{width:22px;height:22px;flex:none;color:var(--primary-ink);margin-top:2px}
.of-price{font-family:var(--hf);font-size:clamp(34px,5.4vw,56px);line-height:1;font-weight:${style.headingWeight};margin:22px 0 4px}
.of-note{color:var(--muted);margin:0 0 18px}
.gu-card{display:flex;gap:22px;align-items:flex-start;padding:clamp(24px,4vw,40px);border-radius:calc(var(--r) + 4px);background:var(--bg);border:1px solid var(--line)}
.gu-card .ico{width:44px;height:44px;flex:none;color:var(--primary-ink)}
.gu-card h2{font-size:clamp(22px,3vw,30px);margin:0 0 8px}.gu-card p{margin:0;color:var(--muted)}
.tm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:20px;margin-top:32px}
.tm{margin:0;padding:26px;border-radius:var(--r);background:var(--surface);border:1px solid var(--line);display:flex;flex-direction:column;gap:16px}
.tm blockquote{margin:0;font-size:18px;line-height:1.5}.tm figcaption{color:var(--muted);font-size:14px}.tm figcaption b{color:var(--text)}
.sticky-cta{display:none}
@media (max-width:760px){
  .sticky-cta{display:block;position:fixed;z-index:40;left:0;right:0;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-top:1px solid var(--line)}
  .sticky-cta .btn{width:100%}
  body.has-sticky{padding-bottom:76px}
  .gu-card{flex-direction:column}
}
.htmlw{padding:0}
.htmlw-frame{display:block;width:100%;border:0;background:transparent}
.vid-frame{position:relative;aspect-ratio:16/9;width:100%;margin-top:28px;border-radius:var(--radius);overflow:hidden;background:#0b0b0f;box-shadow:0 24px 60px -24px rgba(0,0,0,.45)}
.vid-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.vid-empty{display:flex;align-items:center;justify-content:center;color:#fff;opacity:.85}
.vid-link{margin-top:12px;font-size:13px;opacity:.75}
.vid-ph{display:inline-block;max-width:90%;min-width:12em;padding:14px 22px;border:2px dashed rgba(255,255,255,.65);border-radius:12px;font-size:15px;line-height:1.4;cursor:text;word-break:break-all}
.vid-ph:empty::before{content:attr(data-ph);opacity:.85}
.cmp-wrap{overflow-x:auto;margin-top:32px}
.cmp{width:100%;border-collapse:collapse;font-size:16px}
.cmp th,.cmp td{padding:16px;border-bottom:1px solid var(--line);text-align:left}
.cmp thead th{font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.cmp .us{background:color-mix(in srgb,var(--primary) 9%,transparent);font-weight:600}
.cmp thead .us{color:var(--primary-ink)}
@media (max-width:640px){
  .cmp-wrap{overflow:visible}
  .cmp thead{display:none}
  .cmp,.cmp tbody,.cmp tr,.cmp th,.cmp td{display:block;width:100%}
  .cmp tr{padding:14px 0;border-bottom:1px solid var(--line)}
  .cmp tbody th,.cmp td{border:0;padding:4px 0}
  .cmp tbody th{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding-bottom:6px}
  .cmp td::before{content:attr(data-label);display:block;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
  .cmp td.us{padding:10px 12px;border-radius:10px;margin-bottom:6px}
  .cmp td.us::before{color:var(--primary-ink)}
}
.agenda{display:grid;gap:18px;margin-top:36px}
.ag-item{display:grid;grid-template-columns:auto 1fr;gap:24px;padding:26px;border-radius:var(--r);background:var(--bg);border:1px solid var(--line)}
.ag-num{font-family:var(--hf);font-size:46px;font-weight:700;line-height:1;color:var(--primary-ink)}
.ag-when{font-size:14px;font-weight:700;color:var(--primary-ink);margin:0 0 6px;text-transform:uppercase;letter-spacing:.06em}
.ag-item p{color:var(--muted);margin:0}
.host{display:grid;grid-template-columns:.9fr 1.1fr;gap:56px;align-items:center}
.host-noimg{grid-template-columns:1fr}
.ph-photo{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;border:1px solid color-mix(in srgb,var(--text) 16%,transparent);border-radius:var(--r);background:linear-gradient(145deg,color-mix(in srgb,var(--text) 4%,transparent),color-mix(in srgb,var(--primary) 7%,transparent));color:color-mix(in srgb,var(--text) 38%,transparent);font-size:12px;letter-spacing:.04em}
.ph-4x3{aspect-ratio:4/3}
.ph-wide{aspect-ratio:16/6;margin-top:56px}
.host-img{width:100%;height:auto;max-height:72vh;object-fit:contain;background:var(--surface);border-radius:var(--r)}
.host-name{font-weight:700;font-size:18px}
.host-name span{font-weight:400;color:var(--muted)}
.host-body{color:var(--muted);white-space:pre-line}
.faq{margin-top:28px;border-top:1px solid var(--line)}
.faq details{border-bottom:1px solid var(--line)}
.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:16px;padding:22px 0;font-weight:700;font-size:18px}
.faq summary::-webkit-details-marker{display:none}
.faq-plus{font-size:24px;line-height:1;color:var(--primary-ink);transition:transform .2s ease}
.faq details[open] .faq-plus{transform:rotate(45deg)}
.faq details p{color:var(--muted);margin:0 0 22px;max-width:70ch}
.stats{padding:56px 0;border-block:1px solid var(--line)}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:24px;text-align:center}
.stat-v{font-family:var(--hf);font-size:clamp(36px,5vw,56px);font-weight:700;margin:0;color:var(--primary-ink)}
.stat-l{margin:0;color:var(--muted)}
.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:28px}
.gallery.g1{grid-template-columns:minmax(0,640px);justify-content:center}
.gallery.g2,.gallery.g4{grid-template-columns:repeat(2,minmax(0,1fr))}
.gallery.g7,.gallery.g8{grid-template-columns:repeat(4,minmax(0,1fr))}
.gallery img{width:100%;aspect-ratio:4/3;object-fit:contain;object-position:center;background:var(--surface);border-radius:var(--r);padding:6px;box-sizing:border-box}
.gal-mosaic{column-count:3;column-gap:14px;margin-top:28px}
.gal-mosaic img{display:block;width:100%;height:auto;margin:0 0 14px;border-radius:var(--r);break-inside:avoid;background:var(--surface)}
.gal-slider{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;margin-top:28px;scrollbar-width:none}
.gal-slider::-webkit-scrollbar{display:none}
.gal-slider img{flex:none;scroll-snap-align:center;height:clamp(240px,46vw,460px);width:auto;max-width:88%;object-fit:contain;background:var(--surface);border-radius:var(--r)}
@media(max-width:640px){.gal-mosaic{column-count:2}}
@media(max-width:640px){.gallery,.gallery.g3,.gallery.g5,.gallery.g6,.gallery.g7,.gallery.g8{grid-template-columns:repeat(2,minmax(0,1fr))}.gallery.g1{grid-template-columns:minmax(0,1fr)}.gallery:not(.g1) img:last-child:nth-child(odd){grid-column:1/-1}}
.lead-form{display:grid;gap:12px;margin-top:24px}
.lead-form input,.lead-form textarea{font:inherit;padding:15px 16px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--text)}
.consent{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.4;color:var(--muted);cursor:pointer}
.consent input{width:20px;height:20px;flex:none;margin:1px 0 0;accent-color:var(--primary)}
.lead-ok{padding:18px;border-radius:12px;background:color-mix(in srgb,var(--primary) 14%,transparent);font-weight:600}
.final-cta{padding:var(--pad) 0;background:var(--surface)}
.empty-note{padding:28px;border:2px dashed var(--line);border-radius:var(--r);text-align:center;color:var(--muted)}
.has-bg{background-color:#000!important;background-image:linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,.6)),var(--bgimg)!important;background-size:cover!important;background-position:center!important;color:#fff;--text:#fff;--muted:rgba(255,255,255,.82);--line:rgba(255,255,255,.24);--surface:rgba(255,255,255,.1);--bg:rgba(0,0,0,.32)}
.has-bg{--primary:color-mix(in srgb,var(--primary-base) 50%,#fff)}
.has-bg,.promo-dark,.hero-full{--primary-ink:var(--primary-on-dark)}
.has-bg .btn{background:var(--primary-base);color:var(--btn-text);border-color:var(--primary-base)}
.has-bg .btn-ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.5)}
footer.foot{padding:40px 0;border-top:1px solid var(--line);font-size:14px;color:var(--muted)}
footer.foot .wrap{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px}
.ico{width:22px;height:22px}
.mbar{display:none}
@media (max-width:860px){
  body{font-size:16px}
  .nav{display:none}
  header.top .wrap{height:60px;gap:12px}
  .brand{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1}
  .giant{font-size:clamp(40px,11.5vw,72px)!important;line-height:1.04;letter-spacing:-.02em;overflow-wrap:anywhere}
  header.top .btn{padding:8px 14px;font-size:13px;white-space:nowrap;margin-left:auto}
  .hero-split-grid,.hero-product-grid,.giant-row,.spot,.host{grid-template-columns:minmax(0,1fr);gap:32px}
  .hero-split-grid>*,.hero-product-grid>*,.giant-row>*,.spot>*,.host>*{min-width:0}
  .hero-media img{aspect-ratio:4/3}
  .trust-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .trust-item>div{min-width:0;overflow-wrap:anywhere}
  .promo-inner{flex-direction:column;align-items:flex-start}
  .pgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .pcard-body{padding:12px}
  .btn-sm{padding:9px 10px;font-size:13px}
  .ag-item{grid-template-columns:1fr;gap:8px}
  .specs{grid-template-columns:1fr}
  ${isShop ? ".mbar{display:block;position:sticky;bottom:0;z-index:30;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(8px);border-top:1px solid var(--line)} .mbar .btn{width:100%}" : ""}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important;scroll-behavior:auto!important}}
${FX_CSS}
${LOOK_CSS}
</style>
</head>
<body class="st-${content.style} pt-${content.pageType}${content.sticky ? " has-sticky" : ""}">
${announcementHtml}
${content.plain ? "" : `<header class="top"><div class="wrap">
  <a class="brand" href="#inicio">${esc(ctx.businessName)}</a>
  <nav class="nav" aria-label="Secciones">${navLinks.map((l) => `<a href="${l.href}">${esc(l.label)}</a>`).join("")}</nav>
  <a class="btn" href="${esc(href("header"))}">${isShop ? "Pedir por WhatsApp" : "Escríbenos"}</a>
</div></header>`}
<main>
${body}
</main>
${content.plain ? "" : `<footer class="foot"><div class="wrap"><span>© ${esc(ctx.businessName)}</span><a href="${esc(href("footer"))}">Escríbenos por WhatsApp</a></div></footer>`}
${content.sticky && firstHero && firstHero.type === "hero" ? `<div class="sticky-cta"><a class="btn" href="${esc(ctaHref("barra-fija"))}">${esc(firstHero.ctaLabel)}</a></div>` : ""}
${isShop ? `<div class="mbar"><a class="btn" href="${esc(href("barra-movil"))}">Pedir por WhatsApp</a></div>` : ""}
<script>${SITE_SCRIPT}</script>
</body>
</html>`;
}
