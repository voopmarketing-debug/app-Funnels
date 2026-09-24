// Click-to-chat link straight to the founder's personal WhatsApp — support
// is handled manually for now, not through the Cloud API/AI agent pipeline.
export const SUPPORT_WHATSAPP_LINK =
  "https://wa.me/573001680375?text=" + encodeURIComponent("Hola, necesito soporte con Funnels Labs");

// Meta's own per-message rate for a MARKETING-category template sent to a
// Colombia number, USD, as published on Meta's WhatsApp Business Platform
// pricing page (per-message billing, effective since July 2025). Only
// applies to broadcasts sent as an approved template ("Plantilla aprobada"
// in BroadcastDialog) — a free-form message within the 24h customer-service
// window ("Mensaje libre") isn't billed by Meta at all. This is a manually
// set estimate, not a live feed from Meta: update it here if the business's
// real invoice differs (a different market, a BSP markup on top of Meta's
// own rate, or Meta changes the rate) — see BroadcastDialog.tsx for where
// it's shown.
export const WHATSAPP_MARKETING_MESSAGE_COST_USD = 0.0125;
