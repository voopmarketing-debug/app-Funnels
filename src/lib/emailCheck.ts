"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAgencyAdmin } from "@/lib/authz";

export type EmailCheckResult = { ok: boolean; message: string };

/**
 * Agency-only: sends a real test email through the Apps Script webhook and
 * explains in plain words what Google answered, so a misconfigured
 * GOOGLE_APPS_SCRIPT_WEBHOOK_URL is obvious without reading logs.
 */
export async function sendTestEmail(): Promise<EmailCheckResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, message: "Inicia sesión de nuevo." };
  try {
    await requireAgencyAdmin(session.user.id);
  } catch {
    return { ok: false, message: "Solo la agencia puede hacer esto." };
  }
  const url = process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL?.trim();
  if (!url) return { ok: false, message: "Falta la variable GOOGLE_APPS_SCRIPT_WEBHOOK_URL en Vercel (o no se volvió a publicar después de crearla)." };
  if (!/\/exec(\?|$)/.test(url)) return { ok: false, message: "La URL de la variable no termina en /exec. Copia la 'URL de la aplicación web' de Apps Script." };
  if (!/[?&]key=/.test(url)) return { ok: false, message: "A la URL le falta ?key=… al final (la clave del script)." };

  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "email",
        to: me?.email,
        subject: "Prueba de correos de Funnels Labs ✅",
        html: "<p>Si lees esto, los correos de la plataforma están funcionando.</p>",
      }),
      signal: AbortSignal.timeout(15000),
    });
    const text = (await res.text()).slice(0, 2000);
    let json: { ok?: boolean; error?: string } | null = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (json?.ok) return { ok: true, message: `Google aceptó el envío. Revisa ${me?.email} (también Spam).` };
    if (json?.error === "no autorizado") return { ok: false, message: "El script rechazó la clave: la key de la URL en Vercel no coincide con CLAVE en el script." };
    if (/accounts\.google\.com|ServiceLogin|Iniciar sesión|Sign in/i.test(text)) {
      return { ok: false, message: "Google pide iniciar sesión: en Apps Script → Implementar → Administrar implementaciones, pon 'Quién tiene acceso: Cualquier usuario'." };
    }
    if (/Script function not found: doPost/i.test(text)) return { ok: false, message: "El script no tiene la función doPost: pega el código completo y vuelve a implementar." };
    const errorLine = text.match(/<div[^>]*>([^<]*(Exception|Error)[^<]*)<\/div>/i)?.[1];
    return { ok: false, message: `Google respondió ${res.status}${errorLine ? `: ${errorLine}` : ""}. Revisa en Apps Script → Ejecuciones el detalle.` };
  } catch (err) {
    return { ok: false, message: `No se pudo conectar con Google: ${err instanceof Error ? err.message : "error"}` };
  }
}
