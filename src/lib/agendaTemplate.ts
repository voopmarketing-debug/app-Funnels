import { HONEYPOT_HTML } from "@/lib/honeypot";
import { sanitizeHexColor, readableTextColor } from "@/lib/websiteTemplate";
import { ANY_PROFESSIONAL_ID } from "@/lib/agendaAvailability";
import { AGENDA_STYLE_DEFS, isAgendaStyle, type AgendaStyle } from "@/lib/agendaStyles";
import { durationLabel, type AgendaService } from "@/lib/agendaServices";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function formatDateLabel(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const label = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Short form ("Mié 23 sept") for the day-picker grid tiles, so each one
 * fits on a single line — the confirmation step and emails still use the
 * full formatDateLabel(). Built from two separate Intl calls instead of
 * one combined weekday+day+month format, which in es-CO inserts a comma
 * and "de" ("mié, 23 de sept") that made the short label barely shorter
 * than the long one.
 */
function formatDateLabelShort(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const weekday = new Intl.DateTimeFormat("es-CO", { weekday: "short", timeZone: "UTC" }).format(date).replace(/\./g, "");
  const month = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" }).format(date).replace(/\./g, "");
  const day = date.getUTCDate();
  const label = `${weekday} ${day} ${month}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function fontLink(def: { fontQuery: string }): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?${def.fontQuery}&display=swap" rel="stylesheet">`;
}

/** Only http(s) links reach an href/src: the owner types these, so nothing like "javascript:" gets through. */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || v.length > 500) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Link parameters for the step the visitor is on, kept in the URL so the page works with no client-side JS. */
function buildQuery(paramsObj: Record<string, string | undefined | null>): string {
  const pairs = Object.entries(paramsObj)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}

export type AgendaPageParams = {
  businessName: string;
  primaryColor: string;
  trackingBasePath: string; // "/sitio/{slug}" or "" on a connected custom domain
  style?: string;
  // Texts and data the owner fills in (all optional).
  title?: string | null;
  subtitle?: string | null;
  address?: string | null;
  mapUrl?: string | null;
  logoUrl?: string | null;
  whatsapp?: string | null; // digits, to link "Escríbenos por WhatsApp"
  askNote?: boolean;
  // What can be booked — empty on an agenda with one kind of appointment (that step is skipped).
  services?: AgendaService[];
  serviceId?: string | null;
  // Staff a visitor can pick to book with — empty on a single-provider agenda (that step is skipped).
  professionals: { id: string; name: string; title: string | null; photoUrl?: string | null }[];
  professionalId: string | null; // picked professional, once chosen
  upcomingDates: string[]; // shown when no date is selected yet
  dateStr: string | null; // selected date ("YYYY-MM-DD"), once picked
  availableSlots: string[]; // this date's free "HH:mm" slots, shown when a date but no time is selected
  timeStr: string | null; // selected time, once picked — shows the booking form
  confirmed: { dateStr: string; timeStr: string } | null; // just booked
  bookingError: string | null; // the previous booking attempt failed (e.g. slot just taken)
  preview?: boolean;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Public booking page of an "agenda"-type Website. Everything comes from the business's AgendaConfig
 * (look, texts, address, services, hours) plus the step the visitor is on:
 * service → professional → day → time → details, driven by query params.
 */
export function renderAgendaHtml(params: AgendaPageParams): string {
  const style: AgendaStyle = isAgendaStyle(params.style) ? params.style : "clasico";
  const def = AGENDA_STYLE_DEFS[style];
  const primary = sanitizeHexColor(params.primaryColor, "#1f6feb");
  const btnText = readableTextColor(primary);
  const previewParam = params.preview ? "1" : undefined;
  const services = params.services ?? [];
  const selectedService = services.find((x) => x.id === params.serviceId) ?? null;
  const needsService = services.length > 0 && !selectedService;
  const selectedProfessional = params.professionals.find((p) => p.id === params.professionalId) ?? null;
  // "any" resolves who actually gets the booking only at submission time (lib/agenda.ts), so it
  // still has to travel through every link and hidden field like a real selection.
  const isAnyProfessional = params.professionalId === ANY_PROFESSIONAL_ID;
  const effectiveProfessionalId = isAnyProfessional ? ANY_PROFESSIONAL_ID : selectedProfessional?.id;
  const hasProfessionals = params.professionals.length > 0;
  const needsProfessional = !needsService && hasProfessionals && !selectedProfessional && !isAnyProfessional;
  const serviceId = selectedService?.id;

  const href = (q: { service?: string | null; professional?: string | null; date?: string | null; time?: string | null }) =>
    `${params.trackingBasePath}${buildQuery({ service: q.service, professional: q.professional, date: q.date, time: q.time, preview: previewParam })}`;
  const serviceHref = (id: string) => href({ service: id });
  const professionalHref = (id: string) => href({ service: serviceId, professional: id });
  const dayHref = (d: string) => href({ service: serviceId, professional: effectiveProfessionalId, date: d });
  const slotHref = (t: string) => href({ service: serviceId, professional: effectiveProfessionalId, date: params.dateStr, time: t });
  const backToServicesHref = href({});
  const backToProfessionalsHref = href({ service: serviceId });
  const backToDaysHref = href({ service: serviceId, professional: effectiveProfessionalId });
  const backToSlotsHref = href({ service: serviceId, professional: effectiveProfessionalId, date: params.dateStr });
  const formAction = `${params.trackingBasePath}/reservar${buildQuery({ preview: previewParam })}`;
  const address = (params.address ?? "").trim();
  const mapUrl = safeHttpUrl(params.mapUrl);
  const logoUrl = safeHttpUrl(params.logoUrl);
  const whatsapp = (params.whatsapp ?? "").replace(/\D/g, "");

  // What the visitor has chosen so far, shown above each step.
  const chosen: string[] = [];
  if (selectedService) chosen.push(escapeHtml(selectedService.name));
  if (selectedProfessional) chosen.push(escapeHtml(selectedProfessional.name));
  else if (isAnyProfessional) chosen.push("Cualquiera disponible");
  if (params.dateStr) chosen.push(formatDateLabel(params.dateStr));
  if (params.timeStr) chosen.push(escapeHtml(params.timeStr));
  const summary = !params.confirmed && chosen.length > 0 ? `<p class="chosen">${chosen.map((c) => `<span>${c}</span>`).join("")}</p>` : "";
  const withProfessional = selectedProfessional ? ` con ${escapeHtml(selectedProfessional.name)}` : "";

  const avatar = (p: { name: string; photoUrl?: string | null }) => {
    const photo = safeHttpUrl(p.photoUrl);
    return photo ? `<img class="avatar" src="${escapeHtml(photo)}" alt="" loading="lazy">` : `<span class="avatar avatar-i" aria-hidden="true">${escapeHtml(initials(p.name))}</span>`;
  };

  let stepHtml: string;
  let heading: string;
  let sub: string;

  if (params.confirmed) {
    heading = "¡Cita confirmada!";
    sub = "";
    stepHtml = `
      <div class="confirm">
        <div class="confirm-check" aria-hidden="true">✓</div>
        <h2>¡Listo, tu cita quedó confirmada!</h2>
        <p class="confirm-when">${formatDateLabel(params.confirmed.dateStr)} a las ${escapeHtml(params.confirmed.timeStr)}${withProfessional}</p>
        ${selectedService ? `<p class="confirm-service">${escapeHtml(selectedService.name)} · ${durationLabel(selectedService.minutes)}</p>` : ""}
        ${address ? `<p class="confirm-where">${escapeHtml(address)}${mapUrl ? ` · <a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>` : ""}</p>` : ""}
        <p class="muted">Te escribimos para confirmar. Si necesitas cambiarla, contáctanos.</p>
      </div>`;
  } else if (params.dateStr && params.timeStr) {
    heading = "Tus datos";
    sub = "Un último paso para dejar tu cita lista.";
    stepHtml = `
      <a class="back" href="${escapeHtml(backToSlotsHref)}">‹ Elegir otro horario</a>
      ${summary}
      ${params.bookingError ? `<p class="booking-error">${escapeHtml(params.bookingError)}</p>` : ""}
      <form class="booking-form" method="POST" action="${escapeHtml(formAction)}">${HONEYPOT_HTML}
        <input type="hidden" name="date" value="${escapeHtml(params.dateStr)}">
        <input type="hidden" name="time" value="${escapeHtml(params.timeStr)}">
        ${effectiveProfessionalId ? `<input type="hidden" name="professional" value="${escapeHtml(effectiveProfessionalId)}">` : ""}
        ${serviceId ? `<input type="hidden" name="service" value="${escapeHtml(serviceId)}">` : ""}
        <label class="field"><span>Tu nombre</span><input type="text" name="name" maxlength="120" required autocomplete="name"></label>
        <label class="field"><span>Tu WhatsApp o teléfono</span><input type="text" name="contact" maxlength="120" required autocomplete="tel" inputmode="tel"></label>
        <label class="field"><span>Tu correo <em>(opcional, para tu confirmación)</em></span><input type="email" name="email" maxlength="180" autocomplete="email"></label>
        ${params.askNote !== false ? `<label class="field"><span>Motivo de la cita o algo que debamos saber <em>(opcional)</em></span><textarea name="note" rows="3" maxlength="500"></textarea></label>` : ""}
        <button class="btn" type="submit">Confirmar cita</button>
      </form>`;
  } else if (params.dateStr) {
    heading = "Elige la hora";
    sub = "Estos son los horarios libres de ese día.";
    stepHtml = `
      <a class="back" href="${escapeHtml(backToDaysHref)}">‹ Elegir otro día</a>
      ${summary}
      ${
        params.availableSlots.length === 0
          ? `<p class="muted">No quedan horarios libres este día — elige otro.</p>`
          : `<div class="slots">${params.availableSlots.map((t) => `<a class="slot" href="${escapeHtml(slotHref(t))}">${escapeHtml(t)}</a>`).join("")}</div>`
      }`;
  } else if (needsService) {
    heading = "¿Qué necesitas?";
    sub = "Elige el servicio que quieres agendar.";
    stepHtml = `<div class="options">${services
      .map(
        (x) =>
          `<a class="option" href="${escapeHtml(serviceHref(x.id))}"><span class="option-main"><span class="option-name">${escapeHtml(x.name)}</span>${x.description ? `<span class="option-desc">${escapeHtml(x.description)}</span>` : ""}</span><span class="option-meta"><span>${durationLabel(x.minutes)}</span>${x.price ? `<strong>${escapeHtml(x.price)}</strong>` : ""}</span></a>`,
      )
      .join("")}</div>`;
  } else if (needsProfessional) {
    heading = "¿Con quién?";
    sub = "Elige con quién te quieres atender.";
    stepHtml = `
      ${services.length > 0 ? `<a class="back" href="${escapeHtml(backToServicesHref)}">‹ Elegir otro servicio</a>` : ""}
      ${summary}
      <div class="options">
      <a class="option option-any" href="${escapeHtml(professionalHref(ANY_PROFESSIONAL_ID))}"><span class="avatar avatar-i" aria-hidden="true">★</span><span class="option-main"><span class="option-name">Cualquiera disponible</span><span class="option-desc">Te asignamos con quien tenga cupo más pronto</span></span></a>
      ${params.professionals
        .map(
          (p) =>
            `<a class="option" href="${escapeHtml(professionalHref(p.id))}">${avatar(p)}<span class="option-main"><span class="option-name">${escapeHtml(p.name)}</span>${p.title ? `<span class="option-desc">${escapeHtml(p.title)}</span>` : ""}</span></a>`,
        )
        .join("")}
      </div>`;
  } else {
    heading = "Elige el día";
    sub = "Elige el día y la hora que mejor te queden.";
    const backHref = hasProfessionals ? backToProfessionalsHref : services.length > 0 ? backToServicesHref : null;
    const backText = hasProfessionals ? "‹ Elegir otro profesional" : "‹ Elegir otro servicio";
    stepHtml = `
      ${backHref ? `<a class="back" href="${escapeHtml(backHref)}">${backText}</a>` : ""}
      ${summary}
      ${
        params.upcomingDates.length === 0
          ? `<p class="muted">Este negocio no tiene horarios disponibles configurados por ahora.</p>`
          : `<div class="days">${params.upcomingDates.map((d) => `<a class="day" href="${escapeHtml(dayHref(d))}">${formatDateLabelShort(d)}</a>`).join("")}</div>`
      }`;
  }

  const pageTitle = (params.title ?? "").trim() || "Agenda tu cita";
  const pageSub = (params.subtitle ?? "").trim();
  const dark = def.dark;

  const infoHtml = `
    <div class="brand">${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(params.businessName)}">` : ""}<span class="brand-name">${escapeHtml(params.businessName)}</span></div>
    <h1>${escapeHtml(pageTitle)}</h1>
    ${pageSub ? `<p class="subheading">${escapeHtml(pageSub)}</p>` : ""}
    ${
      address || whatsapp
        ? `<ul class="facts">${address ? `<li><span class="fact-label">Dónde</span><span>${escapeHtml(address)}${mapUrl ? ` <a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">Ver en el mapa</a>` : ""}</span></li>` : ""}${whatsapp ? `<li><span class="fact-label">WhatsApp</span><span><a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener noreferrer">Escríbenos</a></span></li>` : ""}</ul>`
        : ""
    }`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(pageTitle)} — ${escapeHtml(params.businessName)}</title>
${fontLink(def)}
<style>
  :root {
    --primary: ${primary};
    --btn-text: ${btnText};
    --bg: ${def.bg};
    --text: ${def.text};
    --surface: ${def.surface};
    --border: ${def.border};
    --radius: ${def.radius}px;
    --soft: color-mix(in srgb, var(--primary) ${dark ? 16 : 8}%, ${dark ? "var(--surface)" : "transparent"});
    --muted: color-mix(in srgb, var(--text) 62%, transparent);
    --head: "${def.headFont}", "${def.bodyFont}", system-ui, sans-serif;
    color-scheme: ${dark ? "dark" : "light"};
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: "${def.bodyFont}", system-ui, sans-serif; line-height: 1.55; -webkit-font-smoothing: antialiased; min-height: 100vh; display: flex; flex-direction: column; }
  a { color: inherit; }
  img { max-width: 100%; }
  .shell { flex: 1; width: 100%; max-width: ${def.split ? 1040 : 680}px; margin: 0 auto; padding: ${def.split ? "40px 24px 56px" : "32px 24px 56px"}; display: grid; align-content: start; gap: 28px; ${def.split ? "grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); align-items: start;" : ""} }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: ${def.split ? 28 : 20}px; }
  .logo { height: 44px; max-width: 160px; object-fit: contain; border-radius: calc(var(--radius) / 2); }
  .brand-name { font-weight: 700; font-size: 16px; }
  h1 { font-family: var(--head); font-size: clamp(26px, 5vw, ${def.split ? 36 : 34}px); line-height: 1.15; margin: 0 0 10px; text-wrap: balance; }
  .subheading { color: var(--muted); margin: 0 0 18px; max-width: 46ch; }
  .facts { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 14px; }
  .facts li { display: grid; grid-template-columns: 76px 1fr; gap: 10px; }
  .fact-label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); padding-top: 2px; }
  .facts a { color: var(--primary); font-weight: 600; text-underline-offset: 3px; }
  .flow { background: var(--surface); border: 1px solid var(--border); border-radius: calc(var(--radius) + 4px); padding: 24px; ${dark ? "" : "box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px -12px rgba(0,0,0,.12);"} }
  .step-head { margin: 0 0 16px; }
  .step-head h2 { font-family: var(--head); font-size: 20px; margin: 0; }
  .step-head p { margin: 2px 0 0; color: var(--muted); font-size: 14px; }
  .muted { color: var(--muted); font-size: 14px; }
  .back { display: inline-block; margin-bottom: 14px; font-size: 13px; color: var(--muted); text-decoration: none; }
  .back:hover { text-decoration: underline; }
  .chosen { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 16px; padding: 0; }
  .chosen span { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: var(--soft); }
  .options { display: grid; gap: 10px; }
  .option { display: flex; align-items: center; gap: 14px; justify-content: space-between; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius); text-decoration: none; transition: border-color .15s, background .15s; }
  .option:hover, .day:hover, .slot:hover { border-color: var(--primary); background: var(--soft); }
  .option-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .option-name { font-weight: 600; }
  .option-desc { font-size: 13px; color: var(--muted); }
  .option-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 13px; color: var(--muted); white-space: nowrap; }
  .option-meta strong { color: var(--text); font-size: 14px; }
  .option-any { border-style: dashed; }
  .avatar { width: 44px; height: 44px; border-radius: 999px; object-fit: cover; flex: none; }
  .avatar-i { display: inline-flex; align-items: center; justify-content: center; background: var(--soft); color: var(--primary); font-weight: 700; font-size: 15px; }
  .days { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
  .day { display: block; padding: 13px 8px; text-align: center; white-space: nowrap; border: 1px solid var(--border); border-radius: var(--radius); text-decoration: none; font-weight: 600; font-size: 14px; transition: border-color .15s, background .15s; }
  .slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 10px; }
  .slot { display: block; padding: 10px 6px; text-align: center; border: 1px solid var(--border); border-radius: var(--radius); text-decoration: none; font-weight: 600; font-size: 14px; transition: border-color .15s, background .15s; }
  .btn { display: inline-block; width: 100%; background: var(--primary); color: var(--btn-text); padding: 14px; border-radius: var(--radius); border: none; font-weight: 700; font-size: 15px; cursor: pointer; font-family: inherit; }
  .btn:hover { opacity: .92; }
  .booking-form { display: flex; flex-direction: column; gap: 12px; }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 600; }
  .field em { font-style: normal; font-weight: 400; color: var(--muted); }
  .field input, .field textarea { font: inherit; font-size: 15px; font-weight: 400; padding: 11px 13px; border-radius: var(--radius); border: 1px solid color-mix(in srgb, var(--text) 22%, transparent); background: var(--surface); color: var(--text); resize: vertical; }
  .field input:focus, .field textarea:focus, .option:focus-visible, .day:focus-visible, .slot:focus-visible, .btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  .booking-error { color: #d92d20; font-size: 13px; font-weight: 600; margin: 0 0 12px; }
  .confirm { text-align: center; padding: 16px 0; }
  .confirm h2 { font-family: var(--head); margin: 0 0 8px; font-size: 22px; }
  .confirm p { margin: 4px 0; }
  .confirm-when { font-weight: 700; font-size: 17px; }
  .confirm-service, .confirm-where { color: var(--muted); font-size: 14px; }
  .confirm-where a { color: var(--primary); font-weight: 600; }
  .confirm-check { width: 56px; height: 56px; border-radius: 999px; background: var(--primary); color: var(--btn-text); font-size: 28px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
  footer { padding: 20px 0 28px; text-align: center; color: var(--muted); font-size: 12px; }
  /* Per-style details */
  body[data-style="suave"] .btn, body[data-style="suave"] .slot, body[data-style="suave"] .day { border-radius: 999px; }
  body[data-style="suave"] .flow { box-shadow: 0 20px 50px -28px color-mix(in srgb, var(--primary) 45%, transparent); border-color: transparent; }
  body[data-style="suave"] { background: radial-gradient(1200px 420px at 50% -120px, color-mix(in srgb, var(--primary) 14%, #fbfaf8), #fbfaf8 70%); }
  body[data-style="editorial"] .shell { border-top: 4px solid var(--text); }
  body[data-style="editorial"] .flow { border: 1px solid var(--text); box-shadow: none; }
  body[data-style="editorial"] h1 { font-weight: 700; letter-spacing: -.01em; }
  body[data-style="editorial"] .option, body[data-style="editorial"] .day, body[data-style="editorial"] .slot { border-color: color-mix(in srgb, var(--text) 25%, transparent); }
  body[data-style="editorial"] .btn { text-transform: uppercase; letter-spacing: .08em; font-size: 13px; }
  body[data-style="oscuro"] .btn { box-shadow: 0 8px 24px -10px var(--primary); }
  body[data-style="compacto"] .shell { background: transparent; }
  body[data-style="compacto"] .slots { grid-template-columns: 1fr 1fr; }
  body[data-style="compacto"] .slot { text-align: left; padding: 12px 14px; }
  body[data-style="compacto"] .days { grid-template-columns: 1fr 1fr; }
  body[data-style="compacto"] .day { text-align: left; padding: 12px 14px; }
  body[data-style="compacto"] .info { position: sticky; top: 24px; }
  @media (max-width: 820px) { .shell { grid-template-columns: 1fr; padding: 24px 16px 48px; gap: 20px; } body[data-style="compacto"] .info { position: static; } .flow { padding: 18px; } }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body data-style="${style}">
  <main class="shell">
    <section class="info">${infoHtml}</section>
    <section class="flow" aria-live="polite">
      ${params.confirmed ? "" : `<div class="step-head"><h2>${escapeHtml(heading)}</h2>${sub ? `<p>${escapeHtml(sub)}</p>` : ""}</div>`}
      ${stepHtml}
    </section>
  </main>
  <footer>Agenda creada con <a href="https://funnelslabs.app" target="_blank" rel="noopener noreferrer">Funnels Labs</a></footer>
</body>
</html>`;
}
