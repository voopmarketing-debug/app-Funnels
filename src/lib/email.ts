import nodemailer from "nodemailer";

// Sends via the agency's own Gmail account (an "App Password", not the
// regular login password — see PROJECT_STATE.md for how to generate one).
// No new service to sign up for, since the agency already lives in Google
// Workspace for Drive/Sheets. Only needed for password-reset emails today.
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  transporter ??= nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
  return transporter;
}

export async function sendEmail(options: { to: string; subject: string; html: string }): Promise<void> {
  const client = getTransporter();
  if (!client) {
    console.error("[email] GMAIL_USER/GMAIL_APP_PASSWORD not configured — email not sent:", options.to, options.subject);
    return;
  }

  try {
    await client.sendMail({ from: `Funnels Labs <${GMAIL_USER}>`, ...options });
  } catch (error) {
    console.error("[email] failed to send", error);
  }
}
