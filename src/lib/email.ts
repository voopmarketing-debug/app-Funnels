// Sends via the same Google Apps Script Web App used for the remarketing
// Sheet (src/lib/remarketingSheet.ts) — Apps Script sends mail through
// OAuth-authorized MailApp under the hood, so it works even on accounts
// where Google blocks creating a classic "App Password". See
// PROJECT_STATE.md for the Apps Script snippet and deployment steps.
const WEBHOOK_URL = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL;
const TIMEOUT_MS = 8000;

export async function sendEmail(options: { to: string; subject: string; html: string }): Promise<void> {
  if (!WEBHOOK_URL) {
    console.error("[email] GOOGLE_APPS_SCRIPT_WEBHOOK_URL not configured — email not sent:", options.to, options.subject);
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "email", ...options }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (error) {
    console.error("[email] failed to send", error);
  }
}
