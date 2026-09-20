import type { WebsiteContent } from "@/lib/websiteContent";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turns a YouTube/Vimeo watch/share URL into its embeddable iframe src — accepts whatever format a client pastes. */
function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (u.pathname.startsWith("/embed/")) return url;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    return null;
  } catch {
    return null;
  }
}

function fontLink(fonts: string[]): string {
  const families = fonts.map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700`).join("&");
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`;
}

export function renderWebsiteHtml(
  content: WebsiteContent,
  // trackingBasePath: "/sitio/{slug}" when served at that path, or "" when
  // served at the root of a connected custom domain (see proxy.ts) — either
  // way CTAs route through "{trackingBasePath}/ir?label=..." so a click is
  // logged (see app/sitio/[slug]/ir/route.ts) before redirecting to the
  // real target, which is resolved server-side there (never trusts a
  // client-supplied URL, so this can't be abused as an open redirect).
  ctx: { businessName: string; whatsappNumber: string; trackingBasePath: string; leadSubmitted?: boolean },
): string {
  const embedUrl = content.videoUrl ? toEmbedUrl(content.videoUrl) : null;
  const trackedHref = (label: string) => `${ctx.trackingBasePath}/ir?label=${encodeURIComponent(label)}`;
  const fonts = Array.from(new Set([content.theme.headingFont, content.theme.bodyFont]));

  const offerHtml = content.offer.items
    .map(
      (s) => `
      <div class="card">
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.description)}</p>
      </div>`,
    )
    .join("");

  const objectionsHtml = content.objections.items
    .map(
      (o) => `
      <div class="objection-card">
        <p class="objection-q">${escapeHtml(o.question)}</p>
        <p class="objection-a">${escapeHtml(o.answer)}</p>
      </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(ctx.businessName)}</title>
${fontLink(fonts)}
<style>
  :root {
    --primary: ${content.theme.primaryColor};
    --bg: ${content.theme.backgroundColor};
    --text: ${content.theme.textColor};
    --heading-font: "${content.theme.headingFont}", sans-serif;
    --body-font: "${content.theme.bodyFont}", sans-serif;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--body-font); line-height: 1.6; }
  h1, h2, h3 { font-family: var(--heading-font); line-height: 1.2; margin: 0 0 0.5em; }
  h1 { font-size: clamp(28px, 5vw, 48px); }
  h2 { font-size: clamp(22px, 3.5vw, 32px); }
  p { margin: 0 0 1em; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
  header.top { padding: 20px 0; }
  header.top .wrap { display: flex; align-items: center; justify-content: space-between; }
  .brand { font-family: var(--heading-font); font-weight: 700; font-size: 18px; }
  .btn { display: inline-block; background: var(--primary); color: #fff; padding: 14px 28px; border-radius: 999px; text-decoration: none; font-weight: 600; font-family: var(--body-font); }
  .btn:hover { opacity: 0.9; }
  section { padding: 56px 0; }
  .hero { padding: 72px 0; }
  .hero .subheading { font-size: 18px; opacity: 0.85; max-width: 60ch; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; margin-top: 24px; }
  .card { border: 1px solid color-mix(in srgb, var(--text) 15%, transparent); border-radius: 12px; padding: 24px; }
  .card h3 { font-size: 18px; }
  .video-wrap { position: relative; padding-top: 56.25%; border-radius: 12px; overflow: hidden; margin-top: 16px; }
  .video-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .objection-card { border-left: 3px solid var(--primary); padding: 4px 0 4px 20px; }
  .objection-q { font-weight: 600; margin-bottom: 0.3em; }
  .objection-a { opacity: 0.85; margin: 0; }
  .lead-section .wrap { max-width: 480px; text-align: center; }
  .lead-form { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; text-align: left; }
  .lead-form input, .lead-form textarea { font: inherit; font-family: var(--body-font); padding: 12px 14px; border-radius: 8px; border: 1px solid color-mix(in srgb, var(--text) 25%, transparent); background: color-mix(in srgb, var(--bg) 92%, var(--text)); color: var(--text); }
  .lead-form textarea { resize: vertical; }
  .lead-form button { align-self: center; border: none; cursor: pointer; }
  .lead-thanks { font-weight: 600; color: var(--primary); }
  footer { padding: 40px 0; text-align: center; opacity: 0.6; font-size: 13px; }
  footer a { color: inherit; }
  @media (max-width: 600px) { .wrap { padding: 0 16px; } section { padding: 40px 0; } }
</style>
</head>
<body>
  <header class="top">
    <div class="wrap">
      <span class="brand">${escapeHtml(ctx.businessName)}</span>
      <a class="btn" href="${escapeHtml(trackedHref("header"))}" target="_blank" rel="noopener noreferrer" style="padding:10px 20px;">WhatsApp</a>
    </div>
  </header>

  <section class="hero">
    <div class="wrap">
      <h1>${escapeHtml(content.hero.heading)}</h1>
      <p class="subheading">${escapeHtml(content.hero.subheading)}</p>
      <a class="btn" href="${escapeHtml(trackedHref("hero"))}" target="_blank" rel="noopener noreferrer">${escapeHtml(content.hero.ctaLabel)}</a>
    </div>
  </section>

  ${
    embedUrl
      ? `<section>
    <div class="wrap">
      <div class="video-wrap"><iframe src="${escapeHtml(embedUrl)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>
    </div>
  </section>`
      : ""
  }

  <section>
    <div class="wrap">
      <h2>${escapeHtml(content.offer.heading)}</h2>
      <div class="grid">${offerHtml}</div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <h2>${escapeHtml(content.objections.heading)}</h2>
      <div class="grid">${objectionsHtml}</div>
    </div>
  </section>

  <section>
    <div class="wrap" style="text-align:center;">
      <h2>${escapeHtml(content.contact.heading)}</h2>
      <p>${escapeHtml(content.contact.body)}</p>
      <a class="btn" href="${escapeHtml(trackedHref("contact"))}" target="_blank" rel="noopener noreferrer">${escapeHtml(content.hero.ctaLabel)}</a>
    </div>
  </section>

  <section class="lead-section">
    <div class="wrap">
      <h2>Déjanos tus datos</h2>
      ${
        ctx.leadSubmitted
          ? `<p class="lead-thanks">¡Listo! Ya tenemos tus datos, te contactamos muy pronto.</p>`
          : `<p>Te escribimos apenas los recibamos.</p>
      <form class="lead-form" method="POST" action="${escapeHtml(`${ctx.trackingBasePath}/registro`)}">
        <input type="text" name="name" placeholder="Tu nombre" maxlength="120" required>
        <input type="text" name="contact" placeholder="Tu WhatsApp o teléfono" maxlength="120" required>
        <textarea name="message" placeholder="Cuéntanos qué necesitas (opcional)" rows="2" maxlength="500"></textarea>
        <button class="btn" type="submit">Enviar</button>
      </form>`
      }
    </div>
  </section>

  <footer>
    <div class="wrap">Sitio creado con IA · <a href="https://funnelslabs.app" target="_blank" rel="noopener noreferrer">Funnels Labs</a></div>
  </footer>
</body>
</html>`;
}
