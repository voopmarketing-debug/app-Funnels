import { sanitizeHexColor, readableTextColor } from "@/lib/websiteTemplate";
import { ANY_PROFESSIONAL_ID } from "@/lib/agendaAvailability";

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

function fontLink(): string {
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">`;
}

/**
 * Public booking page for an "agenda"-type Website — a lighter sibling of
 * lib/websiteTemplate.ts's renderWebsiteHtml. No AI-generated `content`
 * here: everything comes from the business's AgendaConfig (hours, slot
 * length, accent color) plus whichever step of day -> time -> form the
 * visitor is on, driven entirely by query params so it works with zero
 * client-side JS, same as the rest of this app's generated pages.
 */
function buildQuery(paramsObj: Record<string, string | undefined>): string {
  const pairs = Object.entries(paramsObj)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}

export function renderAgendaHtml(params: {
  businessName: string;
  primaryColor: string;
  trackingBasePath: string; // "/sitio/{slug}" or "" on a connected custom domain
  // Staff a visitor can pick to book with — empty on a single-provider
  // agenda, which skips the picker step entirely (unchanged behavior).
  professionals: { id: string; name: string; title: string | null }[];
  professionalId: string | null; // picked professional, once chosen
  upcomingDates: string[]; // shown when no date is selected yet
  dateStr: string | null; // selected date ("YYYY-MM-DD"), once picked
  availableSlots: string[]; // this date's free "HH:mm" slots, shown when a date but no time is selected
  timeStr: string | null; // selected time, once picked — shows the booking form
  confirmed: { dateStr: string; timeStr: string } | null; // just booked
  bookingError: string | null; // the previous booking attempt failed (e.g. slot just taken)
  preview?: boolean;
}): string {
  const primary = sanitizeHexColor(params.primaryColor, "#1f6feb");
  const btnText = readableTextColor(primary);
  const previewParam = params.preview ? "1" : undefined;
  const selectedProfessional = params.professionals.find((p) => p.id === params.professionalId) ?? null;
  // "any" resolves who actually gets the booking only at submission time
  // (see lib/agenda.ts's assignAnyProfessional) — until then there's no
  // name to show, just a chosen PATH through the picker, so it still needs
  // to carry through every link/hidden field like a real selection would.
  const isAnyProfessional = params.professionalId === ANY_PROFESSIONAL_ID;
  const effectiveProfessionalId = isAnyProfessional ? ANY_PROFESSIONAL_ID : selectedProfessional?.id;
  const needsProfessional = params.professionals.length > 0 && !selectedProfessional && !isAnyProfessional;

  const professionalHref = (id: string) =>
    `${params.trackingBasePath}${buildQuery({ professional: id, preview: previewParam })}`;
  const dayHref = (d: string) =>
    `${params.trackingBasePath}${buildQuery({ professional: effectiveProfessionalId, date: d, preview: previewParam })}`;
  const slotHref = (t: string) =>
    `${params.trackingBasePath}${buildQuery({ professional: effectiveProfessionalId, date: params.dateStr ?? undefined, time: t, preview: previewParam })}`;
  const backToProfessionalsHref = `${params.trackingBasePath}${buildQuery({ preview: previewParam })}`;
  const backToDaysHref = `${params.trackingBasePath}${buildQuery({ professional: effectiveProfessionalId, preview: previewParam })}`;
  const backToSlotsHref = `${params.trackingBasePath}${buildQuery({ professional: effectiveProfessionalId, date: params.dateStr ?? undefined, preview: previewParam })}`;
  const formAction = `${params.trackingBasePath}/reservar${buildQuery({ preview: previewParam })}`;
  const withProfessional = selectedProfessional ? ` con ${escapeHtml(selectedProfessional.name)}` : "";

  let stepHtml: string;

  if (params.confirmed) {
    stepHtml = `
      <div class="confirm">
        <div class="confirm-check" aria-hidden="true">✓</div>
        <h2>¡Listo, tu cita quedó confirmada!</h2>
        <p>${formatDateLabel(params.confirmed.dateStr)} a las ${escapeHtml(params.confirmed.timeStr)}${withProfessional}</p>
        <p class="muted">Te escribimos para confirmar. Si necesitas cambiarla, contáctanos.</p>
      </div>`;
  } else if (params.dateStr && params.timeStr) {
    stepHtml = `
      <a class="back" href="${escapeHtml(backToSlotsHref)}">‹ Elegir otro horario</a>
      <p class="selected-slot">${formatDateLabel(params.dateStr)} a las ${escapeHtml(params.timeStr)}${withProfessional}</p>
      ${params.bookingError ? `<p class="booking-error">${escapeHtml(params.bookingError)}</p>` : ""}
      <form class="booking-form" method="POST" action="${escapeHtml(formAction)}">
        <input type="hidden" name="date" value="${escapeHtml(params.dateStr)}">
        <input type="hidden" name="time" value="${escapeHtml(params.timeStr)}">
        ${effectiveProfessionalId ? `<input type="hidden" name="professional" value="${escapeHtml(effectiveProfessionalId)}">` : ""}
        <input type="text" name="name" placeholder="Tu nombre" maxlength="120" required>
        <input type="text" name="contact" placeholder="Tu WhatsApp o teléfono" maxlength="120" required>
        <input type="email" name="email" placeholder="Tu correo (opcional, para tu confirmación)" maxlength="180">
        <button class="btn" type="submit">Confirmar cita</button>
      </form>`;
  } else if (params.dateStr) {
    stepHtml = `
      <a class="back" href="${escapeHtml(backToDaysHref)}">‹ Elegir otro día</a>
      <p class="selected-day">${formatDateLabel(params.dateStr)}${withProfessional}</p>
      ${
        params.availableSlots.length === 0
          ? `<p class="muted">No quedan horarios libres este día — elige otro.</p>`
          : `<div class="slots">${params.availableSlots.map((t) => `<a class="slot" href="${escapeHtml(slotHref(t))}">${escapeHtml(t)}</a>`).join("")}</div>`
      }`;
  } else if (needsProfessional) {
    stepHtml = `<div class="days">
      <a class="day professional professional-any" href="${escapeHtml(professionalHref(ANY_PROFESSIONAL_ID))}">Cualquiera disponible<span class="professional-title">Te asignamos con quien tengas cupo más pronto</span></a>
      ${params.professionals
        .map(
          (p) =>
            `<a class="day professional" href="${escapeHtml(professionalHref(p.id))}">${escapeHtml(p.name)}${p.title ? `<span class="professional-title">${escapeHtml(p.title)}</span>` : ""}</a>`,
        )
        .join("")}
    </div>`;
  } else {
    stepHtml = `
      ${effectiveProfessionalId ? `<a class="back" href="${escapeHtml(backToProfessionalsHref)}">‹ Elegir otro profesional</a>` : ""}
      ${
        params.upcomingDates.length === 0
          ? `<p class="muted">Este negocio no tiene horarios disponibles configurados por ahora.</p>`
          : `<div class="days">${params.upcomingDates.map((d) => `<a class="day" href="${escapeHtml(dayHref(d))}">${formatDateLabelShort(d)}</a>`).join("")}</div>`
      }`;
  }

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agenda tu cita — ${escapeHtml(params.businessName)}</title>
${fontLink()}
<style>
  :root {
    --primary: ${primary};
    --btn-text: ${btnText};
    --bg: #ffffff;
    --text: #0a0a0a;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font-family: "Inter", sans-serif; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 680px; margin: 0 auto; padding: 0 24px; }
  header.top { padding: 20px 0; border-bottom: 1px solid color-mix(in srgb, var(--text) 10%, transparent); }
  .brand { font-weight: 700; font-size: 16px; }
  main { padding: 48px 0 64px; }
  h1 { font-size: clamp(24px, 5vw, 32px); line-height: 1.2; margin: 0 0 8px; text-wrap: balance; }
  .subheading { opacity: 0.75; margin: 0 0 32px; }
  h2 { font-size: 22px; margin: 0 0 8px; }
  .muted { opacity: 0.65; font-size: 14px; }
  a { color: inherit; }
  .back { display: inline-block; margin-bottom: 20px; font-size: 13px; color: color-mix(in srgb, var(--text) 65%, transparent); text-decoration: none; }
  .back:hover { text-decoration: underline; }
  .days { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 10px; }
  .day { display: block; padding: 14px 10px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border: 1px solid color-mix(in srgb, var(--text) 12%, transparent); border-radius: 12px; text-decoration: none; font-weight: 600; transition: border-color 0.15s ease, background 0.15s ease; }
  .day:hover { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 6%, transparent); }
  .professional { display: flex; flex-direction: column; gap: 2px; padding: 18px 14px; white-space: normal; }
  .professional-title { display: block; font-weight: 400; font-size: 12px; opacity: 0.65; white-space: normal; }
  .professional-any { border-style: dashed; }
  .selected-day, .selected-slot { font-weight: 700; font-size: 18px; margin: 0 0 16px; }
  .slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 10px; }
  .slot { display: block; padding: 10px 6px; text-align: center; border: 1px solid color-mix(in srgb, var(--text) 12%, transparent); border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; transition: border-color 0.15s ease, background 0.15s ease; }
  .slot:hover { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 6%, transparent); }
  .btn { display: inline-block; width: 100%; background: var(--primary); color: var(--btn-text); padding: 14px; border-radius: 10px; border: none; font-weight: 700; font-size: 15px; cursor: pointer; font-family: inherit; }
  .btn:hover { opacity: 0.92; }
  .booking-form { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
  .booking-form input { font: inherit; font-size: 15px; padding: 12px 14px; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--text) 20%, transparent); background: var(--bg); color: var(--text); }
  .booking-form input::placeholder { color: color-mix(in srgb, var(--text) 50%, transparent); }
  .booking-error { color: #b42318; font-size: 13px; font-weight: 600; margin: 0 0 8px; }
  .confirm { text-align: center; padding: 24px 0; }
  .confirm-check { width: 56px; height: 56px; border-radius: 999px; background: var(--primary); color: var(--btn-text); font-size: 28px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
  footer { padding: 24px 0; text-align: center; opacity: 0.55; font-size: 12px; }
  @media (max-width: 480px) { .wrap { padding: 0 16px; } }
</style>
</head>
<body>
  <header class="top"><div class="wrap"><span class="brand">${escapeHtml(params.businessName)}</span></div></header>
  <main>
    <div class="wrap">
      <h1>Agenda tu cita</h1>
      <p class="subheading">${needsProfessional ? "Elige con quién te quieres atender." : "Elige el día y la hora que mejor te queden."}</p>
      ${stepHtml}
    </div>
  </main>
  <footer><div class="wrap">Agenda creada con IA · <a href="https://funnelslabs.app" target="_blank" rel="noopener noreferrer">Funnels Labs</a></div></footer>
</body>
</html>`;
}
