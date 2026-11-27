import { HONEYPOT_HTML } from "@/lib/honeypot";
import { sanitizeHexColor, readableTextColor } from "@/lib/websiteTemplate";
import { ANY_PROFESSIONAL_ID } from "@/lib/agendaAvailability";
import { AGENDA_STYLE_DEFS, agendaStyleOrDefault, type AgendaStyle } from "@/lib/agendaStyles";
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
  slotMinutes?: number; // length of an appointment when there are no services
  // The calendar: the month shown, today (in the business's zone) and which of its days can be booked.
  monthStr: string;
  todayStr: string;
  availableDates: string[];
  prevMonth: string | null;
  nextMonth: string | null;
  dateStr: string | null; // selected date ("YYYY-MM-DD")
  availableSlots: string[]; // this date's free "HH:mm" slots
  timeStr: string | null; // selected time, once picked — shows the booking form
  confirmed: { dateStr: string; timeStr: string } | null; // just booked
  bookingError: string | null; // the previous booking attempt failed (e.g. slot just taken)
  preview?: boolean;
  // The editor's unsaved settings, carried through every preview link so the look survives navigating the steps.
  draftParam?: string | null;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const ICON_CLOCK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
const ICON_PIN = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * Public booking page of an "agenda"-type Website: a month calendar with the bookable days, the free
 * times of the chosen day beside it, and a floating card with what is being booked. Before the
 * calendar, services and professionals are picked from a short list. Everything comes from the
 * AgendaConfig plus the step in the URL (service → professional → day → time → details), so it works
 * with no client-side JS.
 */
export function renderAgendaHtml(params: AgendaPageParams): string {
  const style: AgendaStyle = agendaStyleOrDefault(params.style);
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
  const listStep = needsService || needsProfessional;

  const draftParam = params.preview ? params.draftParam : null;
  type Q = { service?: string | null; professional?: string | null; date?: string | null; time?: string | null; month?: string | null };
  const href = (q: Q) =>
    `${params.trackingBasePath}${buildQuery({ service: q.service, professional: q.professional, date: q.date, time: q.time, month: q.month, preview: previewParam, draft: draftParam })}`;
  const baseQ: Q = { service: serviceId, professional: effectiveProfessionalId };
  const monthHref = (m: string) => href({ ...baseQ, month: m });
  const dayHref = (d: string) => href({ ...baseQ, date: d, month: params.monthStr });
  const slotHref = (t: string) => href({ ...baseQ, date: params.dateStr, time: t, month: params.monthStr });
  const backToSlotsHref = href({ ...baseQ, date: params.dateStr, month: params.monthStr });
  const formAction = `${params.trackingBasePath}/reservar${buildQuery({ preview: previewParam, draft: draftParam })}`;
  const address = (params.address ?? "").trim();
  const mapUrl = safeHttpUrl(params.mapUrl);
  const logoUrl = safeHttpUrl(params.logoUrl);
  const whatsapp = (params.whatsapp ?? "").replace(/\D/g, "");
  const duration = selectedService?.minutes ?? params.slotMinutes ?? 30;
  const withProfessional = selectedProfessional ? ` con ${escapeHtml(selectedProfessional.name)}` : "";

  const avatar = (p: { name: string; photoUrl?: string | null }) => {
    const photo = safeHttpUrl(p.photoUrl);
    return photo ? `<img class="avatar" src="${escapeHtml(photo)}" alt="" loading="lazy">` : `<span class="avatar avatar-i" aria-hidden="true">${escapeHtml(initials(p.name))}</span>`;
  };

  // ---- Floating card: what is being booked ----
  const pageTitle = (params.title ?? "").trim() || "Agenda tu cita";
  const pageSub = (params.subtitle ?? "").trim();
  const infoTitle = selectedService ? selectedService.name : pageTitle;
  const infoSub = selectedProfessional ? [selectedProfessional.name, selectedProfessional.title].filter(Boolean).join(" · ") : isAnyProfessional ? "Cualquiera disponible" : pageSub;
  const faces = selectedProfessional ? [selectedProfessional] : hasProfessionals && !isAnyProfessional ? params.professionals.slice(0, 3) : [];
  const infoHtml = `
    <div class="info-main">
      <h2>${escapeHtml(infoTitle)}</h2>
      ${infoSub ? `<p class="info-sub">${escapeHtml(infoSub)}</p>` : ""}
      <ul class="info-meta">
        <li>${ICON_CLOCK}<span>${durationLabel(duration)}</span></li>
        ${address ? `<li>${ICON_PIN}<span>${escapeHtml(address)}${mapUrl ? ` <a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>` : ""}</span></li>` : ""}
      </ul>
    </div>
    ${faces.length > 0 ? `<div class="avatars">${faces.map(avatar).join("")}</div>` : ""}`;

  // ---- What the visitor has chosen so far (list steps) ----
  const chosen: string[] = [];
  if (selectedService) chosen.push(escapeHtml(selectedService.name));
  if (selectedProfessional) chosen.push(escapeHtml(selectedProfessional.name));
  const summary = chosen.length > 0 ? `<p class="chosen">${chosen.map((c) => `<span>${c}</span>`).join("")}</p>` : "";

  // ---- Month calendar ----
  const [cy, cm] = params.monthStr.split("-").map(Number);
  const offset = (new Date(Date.UTC(cy, cm - 1, 1)).getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(cy, cm, 0)).getUTCDate();
  const available = new Set(params.availableDates);
  const locked = !!params.confirmed;
  const cells: string[] = Array.from({ length: offset }, () => `<span class="d d-blank"></span>`);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${params.monthStr}-${String(d).padStart(2, "0")}`;
    const selected = dateStr === (params.confirmed?.dateStr ?? params.dateStr);
    const today = dateStr === params.todayStr ? " d-today" : "";
    if (selected) cells.push(`<${locked ? "span" : `a href="${escapeHtml(dayHref(dateStr))}"`} class="d d-on d-sel${today}" aria-current="date">${d}</${locked ? "span" : "a"}>`);
    else if (available.has(dateStr) && !locked) cells.push(`<a class="d d-on${today}" href="${escapeHtml(dayHref(dateStr))}">${d}</a>`);
    else cells.push(`<span class="d d-off${today}">${d}</span>`);
  }
  const arrow = (dir: "prev" | "next", target: string | null) =>
    target && !locked
      ? `<a class="nav" href="${escapeHtml(monthHref(target))}" aria-label="${dir === "prev" ? "Mes anterior" : "Mes siguiente"}">${dir === "prev" ? "‹" : "›"}</a>`
      : `<span class="nav nav-off" aria-hidden="true">${dir === "prev" ? "‹" : "›"}</span>`;
  const calendarHtml = `
    <div class="cal">
      <h2 class="cal-title">${params.confirmed ? "Tu cita" : "Elige día y hora"}</h2>
      <div class="cal-nav">${arrow("prev", params.prevMonth)}<span class="cal-month">${escapeHtml(monthLabel(params.monthStr))}</span>${arrow("next", params.nextMonth)}</div>
      <div class="cal-grid">${WEEKDAYS.map((w) => `<span class="wd">${w}</span>`).join("")}${cells.join("")}</div>
    </div>`;

  // ---- Right column: times / form / confirmation ----
  let sideHtml: string;
  if (params.confirmed) {
    sideHtml = `
      <div class="confirm">
        <div class="pill pill-sel">${ICON_CHECK}<span>Cita confirmada</span></div>
        <p class="confirm-when">${formatDateLabel(params.confirmed.dateStr)}<br>${escapeHtml(params.confirmed.timeStr)}${withProfessional}</p>
        ${selectedService ? `<p class="confirm-line">${escapeHtml(selectedService.name)} · ${durationLabel(selectedService.minutes)}</p>` : ""}
        ${address ? `<p class="confirm-line">${escapeHtml(address)}${mapUrl ? ` · <a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">Cómo llegar</a>` : ""}</p>` : ""}
        <p class="muted">Te escribimos para confirmar. Si necesitas cambiarla, contáctanos.</p>
      </div>`;
  } else if (params.dateStr && params.timeStr) {
    sideHtml = `
      <a class="back" href="${escapeHtml(backToSlotsHref)}">‹ Elegir otra hora</a>
      <div class="pill pill-sel pill-time"><span>${formatDateLabelShort(params.dateStr)} · ${escapeHtml(params.timeStr)}</span></div>
      ${params.bookingError ? `<p class="booking-error">${escapeHtml(params.bookingError)}</p>` : ""}
      <form class="booking-form" method="POST" action="${escapeHtml(formAction)}">${HONEYPOT_HTML}
        <input type="hidden" name="date" value="${escapeHtml(params.dateStr)}">
        <input type="hidden" name="time" value="${escapeHtml(params.timeStr)}">
        ${effectiveProfessionalId ? `<input type="hidden" name="professional" value="${escapeHtml(effectiveProfessionalId)}">` : ""}
        ${serviceId ? `<input type="hidden" name="service" value="${escapeHtml(serviceId)}">` : ""}
        <label class="field"><span>Tu nombre</span><input type="text" name="name" maxlength="120" required autocomplete="name"></label>
        <label class="field"><span>Tu WhatsApp o teléfono</span><input type="text" name="contact" maxlength="120" required autocomplete="tel" inputmode="tel"></label>
        <label class="field"><span>Tu correo <em>(opcional)</em></span><input type="email" name="email" maxlength="180" autocomplete="email"></label>
        ${params.askNote !== false ? `<label class="field"><span>Motivo de la cita <em>(opcional)</em></span><textarea name="note" rows="2" maxlength="500"></textarea></label>` : ""}
        <button class="btn" type="submit">Confirmar cita</button>
      </form>`;
  } else {
    sideHtml = !params.dateStr
      ? `<p class="muted side-empty">Elige un día para ver los horarios.</p>`
      : params.availableSlots.length === 0
        ? `<p class="muted side-empty">No quedan horarios libres este día. Elige otro.</p>`
        : `<p class="side-date">${formatDateLabel(params.dateStr)}</p><div class="slots">${params.availableSlots.map((t) => `<a class="pill" href="${escapeHtml(slotHref(t))}">${escapeHtml(t)}</a>`).join("")}</div>`;
  }

  // ---- Short lists: service, professional ----
  let listHtml = "";
  if (needsService) {
    listHtml = `<h2 class="cal-title">¿Qué necesitas?</h2><p class="muted list-sub">Elige el servicio que quieres agendar.</p><div class="options">${services
      .map(
        (x) =>
          `<a class="option" href="${escapeHtml(href({ service: x.id }))}"><span class="option-main"><span class="option-name">${escapeHtml(x.name)}</span>${x.description ? `<span class="option-desc">${escapeHtml(x.description)}</span>` : ""}</span><span class="option-meta"><span>${durationLabel(x.minutes)}</span>${x.price ? `<strong>${escapeHtml(x.price)}</strong>` : ""}</span></a>`,
      )
      .join("")}</div>`;
  } else if (needsProfessional) {
    listHtml = `
      ${services.length > 0 ? `<a class="back" href="${escapeHtml(href({}))}">‹ Elegir otro servicio</a>` : ""}
      ${summary}
      <h2 class="cal-title">¿Con quién?</h2><p class="muted list-sub">Elige con quién te quieres atender.</p>
      <div class="options">
        <a class="option option-any" href="${escapeHtml(href({ service: serviceId, professional: ANY_PROFESSIONAL_ID }))}"><span class="avatar avatar-i" aria-hidden="true">★</span><span class="option-main"><span class="option-name">Cualquiera disponible</span><span class="option-desc">Te asignamos con quien tenga cupo más pronto</span></span></a>
        ${params.professionals
          .map(
            (p) =>
              `<a class="option" href="${escapeHtml(href({ service: serviceId, professional: p.id }))}">${avatar(p)}<span class="option-main"><span class="option-name">${escapeHtml(p.name)}</span>${p.title ? `<span class="option-desc">${escapeHtml(p.title)}</span>` : ""}</span></a>`,
          )
          .join("")}
      </div>`;
  }

  const backBar = !listStep && (hasProfessionals || services.length > 0) && !params.confirmed && !(params.dateStr && params.timeStr)
    ? `<a class="back back-top" href="${escapeHtml(hasProfessionals ? href({ service: serviceId }) : href({}))}">${hasProfessionals ? "‹ Elegir otro profesional" : "‹ Elegir otro servicio"}</a>`
    : "";
  const chips = !listStep && chosen.length > 0 && !params.confirmed ? summary : "";

  const cardHtml = listStep
    ? `<section class="card card-list">${listHtml}</section>`
    : `<section class="card card-cal">${backBar}${chips}<div class="split">${calendarHtml}<div class="side" aria-live="polite">${sideHtml}</div></div></section>`;

  const dark = def.dark;
  const isSky = style === "cielo";
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
    --day-radius: ${def.dayRadius}px;
    --tint: color-mix(in srgb, var(--primary) ${dark ? 20 : 13}%, ${dark ? "var(--surface)" : "#fff"});
    --tint-hover: color-mix(in srgb, var(--primary) ${dark ? 32 : 24}%, ${dark ? "var(--surface)" : "#fff"});
    --sel: linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 62%, #8b5cf6));
    --sel-text: ${btnText};
    --muted: color-mix(in srgb, var(--text) 58%, transparent);
    --head: "${def.headFont}", "${def.bodyFont}", system-ui, sans-serif;
    color-scheme: ${dark ? "dark" : "light"};
  }
  * { box-sizing: border-box; }
  html { min-height: 100%; }
  body { margin: 0; min-height: 100vh; background: ${isSky ? "linear-gradient(180deg, color-mix(in srgb, var(--primary) 9%, #fff) 0%, color-mix(in srgb, var(--primary) 30%, #fff) 55%, color-mix(in srgb, var(--primary) 62%, #fff) 100%) fixed" : "var(--bg)"}; color: var(--text); font-family: "${def.bodyFont}", system-ui, sans-serif; line-height: 1.5; -webkit-font-smoothing: antialiased; display: flex; flex-direction: column; }
  a { color: inherit; }
  img { max-width: 100%; }
  .stage { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; gap: 22px; }
  .brand { display: flex; align-items: center; gap: 12px; width: min(900px, 100%); }
  .logo { height: 40px; max-width: 160px; object-fit: contain; border-radius: 8px; }
  .brand-name { font-weight: 700; font-size: 17px; font-family: var(--head); }
  .wrap { position: relative; width: min(900px, 100%); }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 34px 36px 36px; ${dark ? "" : "box-shadow: 0 30px 70px -34px color-mix(in srgb, var(--primary) 55%, transparent), 0 2px 6px rgba(15,35,66,.06);"} }
  .card-list { max-width: 560px; margin: 0 auto; }
  .info { background: color-mix(in srgb, var(--surface) 94%, transparent); border: 1px solid var(--border); border-left: 6px solid var(--primary); border-radius: calc(var(--radius) * .8); padding: 20px 22px; display: flex; gap: 16px; align-items: flex-start; justify-content: space-between; ${dark ? "" : "box-shadow: 0 18px 44px -20px rgba(15,35,66,.28);"} backdrop-filter: blur(8px); }
  .info h2 { font-family: var(--head); font-size: 20px; line-height: 1.2; margin: 0; text-wrap: balance; }
  .info-sub { margin: 2px 0 0; color: var(--muted); font-size: 15px; }
  .info-meta { list-style: none; margin: 14px 0 0; padding: 12px 0 0; border-top: 1px solid var(--border); display: grid; gap: 8px; font-size: 14px; color: var(--muted); }
  .info-meta li { display: flex; gap: 9px; align-items: flex-start; }
  .info-meta svg { flex: none; margin-top: 1px; }
  .info-meta a { color: var(--primary); font-weight: 600; }
  .avatars { display: flex; flex: none; }
  .avatars .avatar { border: 3px solid var(--surface); margin-left: -12px; width: 52px; height: 52px; }
  .avatars .avatar:first-child { margin-left: 0; }
  .avatar { width: 44px; height: 44px; border-radius: 999px; object-fit: cover; flex: none; }
  .avatar-i { display: inline-flex; align-items: center; justify-content: center; background: var(--tint); color: var(--primary); font-weight: 700; font-size: 15px; }
  .wrap-cal .info { position: relative; z-index: 2; width: min(380px, 100%); margin: 0 -26px -54px auto; }
  .wrap-cal .card { padding-top: 80px; }
  .wrap-list .info { max-width: 560px; margin: 0 auto 16px; }
  .split { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: 0; }
  .cal { padding-right: 34px; }
  .cal-title { font-family: var(--head); font-size: 24px; font-weight: 800; margin: 0 0 18px; text-align: center; text-wrap: balance; }
  .list-sub { text-align: center; margin: -8px 0 18px; }
  .cal-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 18px; }
  .cal-month { font-weight: 700; font-size: 16px; min-width: 150px; text-align: center; }
  .nav { width: 42px; height: 42px; border-radius: 999px; background: var(--tint); color: var(--text); display: inline-flex; align-items: center; justify-content: center; font-size: 22px; text-decoration: none; line-height: 1; }
  .nav:hover { background: var(--tint-hover); }
  .nav-off { opacity: .35; }
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px 6px; justify-items: center; }
  .wd { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); padding-bottom: 4px; }
  .d { width: 100%; max-width: 54px; aspect-ratio: 1; border-radius: var(--day-radius); display: inline-flex; align-items: center; justify-content: center; font-weight: 600; font-size: 16px; text-decoration: none; position: relative; }
  .d-off { color: color-mix(in srgb, var(--text) 30%, transparent); font-weight: 500; }
  .d-on { background: var(--tint); color: var(--text); transition: background .15s, transform .15s; }
  a.d-on:hover { background: var(--tint-hover); transform: translateY(-1px); }
  .d-sel { background: var(--sel) !important; color: var(--sel-text) !important; box-shadow: 0 10px 22px -10px var(--primary); }
  .d-today::after { content: ""; position: absolute; bottom: 7px; width: 5px; height: 5px; border-radius: 999px; background: currentColor; opacity: .7; }
  .side { padding-left: 34px; border-left: 1px solid var(--border); min-height: 280px; display: flex; flex-direction: column; gap: 12px; }
  .side-date { margin: 0; font-weight: 700; font-size: 15px; }
  .side-empty { margin: auto 0; text-align: center; }
  .slots { display: flex; flex-direction: column; gap: 10px; max-height: 420px; overflow-y: auto; padding: 2px 4px 2px 0; }
  .pill { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 13px 16px; border-radius: calc(var(--radius) * .5); background: var(--tint); color: var(--text); font-weight: 700; font-size: 16px; text-decoration: none; transition: background .15s; }
  a.pill:hover { background: var(--tint-hover); }
  .pill-sel { background: var(--sel); color: var(--sel-text); box-shadow: 0 12px 26px -14px var(--primary); }
  .pill-time { justify-content: center; }
  .btn { display: inline-block; width: 100%; background: var(--sel); color: var(--sel-text); padding: 14px; border-radius: calc(var(--radius) * .5); border: none; font-weight: 700; font-size: 15px; cursor: pointer; font-family: inherit; }
  .btn:hover { filter: brightness(1.05); }
  .booking-form { display: flex; flex-direction: column; gap: 10px; }
  .field { display: flex; flex-direction: column; gap: 3px; font-size: 13px; font-weight: 600; }
  .field em { font-style: normal; font-weight: 400; color: var(--muted); }
  .field input, .field textarea { font: inherit; font-size: 15px; font-weight: 400; padding: 10px 12px; border-radius: calc(var(--radius) * .4); border: 1px solid color-mix(in srgb, var(--text) 20%, transparent); background: var(--surface); color: var(--text); resize: vertical; }
  .field input:focus, .field textarea:focus, a:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
  .booking-error { color: #d92d20; font-size: 13px; font-weight: 600; margin: 0; }
  .back { display: inline-block; font-size: 13px; color: var(--muted); text-decoration: none; }
  .back:hover { text-decoration: underline; }
  .back-top { margin-bottom: 8px; }
  .muted { color: var(--muted); font-size: 14px; }
  .chosen { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; padding: 0; }
  .chosen span { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 999px; background: var(--tint); }
  .options { display: grid; gap: 10px; }
  .option { display: flex; align-items: center; gap: 14px; justify-content: space-between; padding: 14px 16px; border: 1px solid var(--border); border-radius: calc(var(--radius) * .6); text-decoration: none; transition: border-color .15s, background .15s; }
  .option:hover { border-color: var(--primary); background: var(--tint); }
  .option-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .option-name { font-weight: 700; }
  .option-desc { font-size: 13px; color: var(--muted); }
  .option-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 13px; color: var(--muted); white-space: nowrap; }
  .option-meta strong { color: var(--text); font-size: 14px; }
  .option-any { border-style: dashed; }
  .confirm { display: flex; flex-direction: column; gap: 10px; ${isSky ? "" : ""} }
  .confirm p { margin: 0; }
  .confirm-when { font-weight: 700; font-size: 17px; line-height: 1.35; }
  .confirm-line { color: var(--muted); font-size: 14px; }
  .confirm-line a { color: var(--primary); font-weight: 600; }
  footer { padding: 14px 0 26px; text-align: center; color: ${isSky ? "color-mix(in srgb, var(--text) 60%, transparent)" : "var(--muted)"}; font-size: 12px; }
  ${style === "editorial" ? ".card { border-width: 1.5px; } .pill, .d-on, .nav { border-radius: 2px; } .d-off, .d-on { border-radius: 2px; } .cal-title, .info h2 { font-weight: 700; } .btn { text-transform: uppercase; letter-spacing: .08em; font-size: 13px; }" : ""}
  ${style === "suave" ? "body { background: radial-gradient(1100px 420px at 50% -120px, color-mix(in srgb, var(--primary) 14%, #fbfaf8), #fbfaf8 70%); } .card { border-color: transparent; }" : ""}
  @media (max-width: 860px) {
    .stage { justify-content: flex-start; padding: 24px 14px; }
    .wrap-cal .info { width: 100%; margin: 0 0 14px; }
    .card, .wrap-cal .card { padding: 22px 16px 24px; }
    .split { grid-template-columns: 1fr; gap: 22px; }
    .cal { padding-right: 0; }
    .side { padding-left: 0; padding-top: 22px; border-left: 0; border-top: 1px solid var(--border); min-height: 0; }
    .slots { max-height: none; display: grid; grid-template-columns: repeat(2, 1fr); }
    .d { font-size: 15px; }
  }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body data-style="${style}">
  <main class="stage">
    ${logoUrl || params.businessName ? `<div class="brand">${logoUrl ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="">` : ""}<span class="brand-name">${escapeHtml(params.businessName)}</span></div>` : ""}
    <div class="wrap ${listStep ? "wrap-list" : "wrap-cal"}">
      <aside class="info">${infoHtml}</aside>
      ${cardHtml}
    </div>
    ${whatsapp ? `<p class="muted"><a href="https://wa.me/${whatsapp}" target="_blank" rel="noopener noreferrer">¿Dudas? Escríbenos por WhatsApp</a></p>` : ""}
  </main>
  <footer>Agenda creada con <a href="https://funnelslabs.app" target="_blank" rel="noopener noreferrer">Funnels Labs</a></footer>
</body>
</html>`;
}
