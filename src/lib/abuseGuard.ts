import { isRateLimited, recordRateLimitEvent } from "@/lib/rateLimit";
import { HONEYPOT_FIELD } from "@/lib/honeypot";

// Shields for the public forms anyone can submit without an account (sign-up,
// a client page's lead form and booking): the hidden honeypot field (see
// lib/honeypot.ts) plus a per-IP rate limit.

export function isHoneypotFilled(formData: FormData): boolean {
  return String(formData.get(HONEYPOT_FIELD) ?? "").trim() !== "";
}

/** The visitor's IP as Vercel reports it (first hop of x-forwarded-for). */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Counts one attempt for `key` and says whether it's over `max` within
 * `windowMs`. Over the limit, the attempt isn't recorded again.
 */
export async function overLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  if (await isRateLimited(key, max, windowMs)) return true;
  await recordRateLimitEvent(key);
  return false;
}

// Lead or booking submissions from one IP to one page per hour: plenty for a
// real person, a wall for a bot.
const PUBLIC_FORM_MAX = 10;
const PUBLIC_FORM_WINDOW_MS = 60 * 60 * 1000;

/**
 * For a client page's public forms: "bot" when the honeypot is filled (the
 * caller pretends it worked and saves nothing), "limited" when this IP
 * already sent too many to this page, null when it may go through.
 */
export async function publicFormBlock(formData: FormData, headers: Headers, websiteId: string, kind: "lead" | "booking"): Promise<"bot" | "limited" | null> {
  if (isHoneypotFilled(formData)) return "bot";
  if (await overLimit(`${kind}:${websiteId}:${clientIpFrom(headers)}`, PUBLIC_FORM_MAX, PUBLIC_FORM_WINDOW_MS)) return "limited";
  return null;
}

/** The booking form's "no se pudo" outcome for a blocked submission. */
export function blockedBookingOutcome(block: "bot" | "limited", formData: FormData): { ok: false; dateStr: string; error: string } {
  return {
    ok: false,
    dateStr: String(formData.get("date") ?? ""),
    error:
      block === "limited"
        ? "Recibimos demasiadas reservas desde tu conexión. Inténtalo en una hora o escríbenos por WhatsApp."
        : "No pudimos registrar la reserva. Inténtalo de nuevo.",
  };
}
