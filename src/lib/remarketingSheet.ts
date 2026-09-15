// Best-effort sync of new client registrations to a Google Sheet, so the
// agency can build remarketing audiences (email lists for ads, follow-up
// campaigns) without needing DB access. Wired via the same Google Apps
// Script Web App used for password-reset emails (src/lib/email.ts) — no
// service-account credentials or App Passwords needed, just one webhook
// URL. See PROJECT_STATE.md for the Apps Script snippet and setup steps.
const WEBHOOK_URL = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL;
const TIMEOUT_MS = 5000;

export async function logRegistrationForRemarketing(data: {
  nombre: string;
  correo: string;
  telefono: string;
  negocio: string;
  industria: string;
}): Promise<void> {
  if (!WEBHOOK_URL) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "registration", ...data }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (error) {
    // Never let a Sheets/Apps Script hiccup block a real registration.
    console.error("[remarketing] failed to log registration to sheet", error);
  }
}
