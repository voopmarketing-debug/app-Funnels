// A checkup of everything on OUR side that "Conectar con Facebook" needs,
// plus what can be asked of Meta with the app's own credentials. Shown to the
// agency only (see /dashboard/meta). The steps that happen inside Meta's
// website (business verification, app review…) cannot be read from here, so
// they are listed as a manual checklist next to these results.

export type CheckStatus = "ok" | "fail" | "unknown";
export type SetupCheck = { id: string; label: string; status: CheckStatus; detail: string; fix?: string };

const GRAPH = "https://graph.facebook.com/v21.0";

export function webhookUrl(): string {
  return `https://${process.env.APP_HOST ?? "agente.funnelslabs.app"}/api/webhooks/whatsapp`;
}

const present = (name: string) => Boolean(process.env[name]?.trim());

/** The checks that only look at this server's own settings. */
export function envChecks(): SetupCheck[] {
  const rows: { name: string; label: string; fix: string; why: string }[] = [
    { name: "META_APP_ID", label: "ID de la app de Meta", why: "Identifica tu app en la ventana de Facebook.", fix: "En Vercel → Environment Variables, agrega META_APP_ID con el «Identificador de la app» (developers.facebook.com → tu app → Configuración → Básica)." },
    { name: "META_APP_SECRET", label: "Secreto de la app de Meta", why: "Firma y valida lo que Meta nos envía.", fix: "En Vercel agrega META_APP_SECRET con la «Clave secreta de la app» (la misma pantalla Básica)." },
    { name: "META_WA_CONFIG_ID", label: "Configuración de «WhatsApp Embedded Signup»", why: "Sin este ID el botón «Conectar con Facebook» no aparece para tus clientes.", fix: "En developers.facebook.com → tu app → Inicio de sesión de Facebook para empresas → Configuraciones → Crear configuración (plantilla de WhatsApp Embedded Signup). Copia su ID y guárdalo en Vercel como META_WA_CONFIG_ID." },
    { name: "WHATSAPP_VERIFY_TOKEN", label: "Token de verificación del webhook", why: "Meta lo usa para comprobar que el webhook es tuyo.", fix: "En Vercel agrega WHATSAPP_VERIFY_TOKEN con una frase larga que inventes, y pega esa misma en Meta al configurar el webhook." },
    { name: "TOKEN_ENCRYPTION_KEY", label: "Llave para guardar los tokens cifrados", why: "Protege los tokens de tus clientes en la base de datos.", fix: "En Vercel agrega TOKEN_ENCRYPTION_KEY (32 bytes en base64)." },
  ];
  return rows.map((r) => ({
    id: r.name,
    label: r.label,
    status: present(r.name) ? "ok" : "fail",
    detail: present(r.name) ? "Configurado en el servidor." : r.why,
    fix: present(r.name) ? undefined : r.fix,
  }));
}

type Subscription = { object?: string; callback_url?: string; active?: boolean; fields?: { name?: string }[] };

/** The checks that ask Meta, with the app's own credentials (read-only). */
export async function metaChecks(): Promise<SetupCheck[]> {
  const appId = process.env.META_APP_ID?.trim();
  const secret = process.env.META_APP_SECRET?.trim();
  if (!appId || !secret) {
    return [{ id: "meta-app", label: "Conexión con tu app de Meta", status: "unknown", detail: "No se puede consultar a Meta hasta que estén META_APP_ID y META_APP_SECRET." }];
  }
  const token = `${appId}|${secret}`;
  const out: SetupCheck[] = [];

  let appName: string | null = null;
  try {
    const res = await fetch(`${GRAPH}/${appId}?fields=name&access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { name?: string; error?: { message?: string } } | null;
    if (res.ok) appName = body?.name ?? "tu app";
    else out.push({ id: "meta-app", label: "Conexión con tu app de Meta", status: "fail", detail: body?.error?.message ?? `Meta respondió ${res.status}.`, fix: "Revisa que META_APP_ID y META_APP_SECRET en Vercel sean los de la misma app." });
  } catch {
    return [{ id: "meta-app", label: "Conexión con tu app de Meta", status: "unknown", detail: "No pudimos hablar con Meta ahora mismo. Vuelve a abrir esta página en un momento." }];
  }
  if (appName) out.push({ id: "meta-app", label: "Conexión con tu app de Meta", status: "ok", detail: `La app «${appName}» responde con las credenciales del servidor.` });

  try {
    const res = await fetch(`${GRAPH}/${appId}/subscriptions?access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { data?: Subscription[]; error?: { message?: string } } | null;
    if (!res.ok) {
      out.push({ id: "webhook", label: "Webhook de WhatsApp en Meta", status: "unknown", detail: body?.error?.message ?? `Meta respondió ${res.status}.` });
    } else {
      const wa = (body?.data ?? []).find((s) => s.object === "whatsapp_business_account");
      const expected = webhookUrl();
      const hasMessages = Boolean(wa?.fields?.some((f) => f.name === "messages"));
      if (!wa) {
        out.push({ id: "webhook", label: "Webhook de WhatsApp en Meta", status: "fail", detail: "Tu app todavía no tiene un webhook de WhatsApp.", fix: `En developers.facebook.com → tu app → WhatsApp → Configuración → Webhook: URL ${expected}, token de verificación = el de WHATSAPP_VERIFY_TOKEN. Luego suscribe el campo «messages».` });
      } else if (wa.callback_url !== expected) {
        out.push({ id: "webhook", label: "Webhook de WhatsApp en Meta", status: "fail", detail: `Apunta a otra dirección (${wa.callback_url ?? "ninguna"}).`, fix: `Cámbiala por ${expected}.` });
      } else if (!hasMessages) {
        out.push({ id: "webhook", label: "Webhook de WhatsApp en Meta", status: "fail", detail: "El webhook está, pero no recibe el campo «messages».", fix: "En el mismo lugar, suscribe el campo «messages»." });
      } else {
        out.push({ id: "webhook", label: "Webhook de WhatsApp en Meta", status: "ok", detail: "Apunta a esta plataforma y recibe los mensajes." });
      }
    }
  } catch {
    out.push({ id: "webhook", label: "Webhook de WhatsApp en Meta", status: "unknown", detail: "No pudimos consultarlo ahora." });
  }
  return out;
}

/** What only Meta's own website can confirm: done by hand, in this order. */
export const MANUAL_STEPS: { id: string; title: string; how: string; link?: { href: string; label: string } }[] = [
  {
    id: "verify-business",
    title: "Verifica tu negocio en Meta",
    how: "Configuración del negocio → Centro de seguridad → Verificación del negocio. Sube los documentos de tu empresa o de ti como persona; Meta tarda de unos días a varias semanas.",
    link: { href: "https://business.facebook.com/settings/security", label: "Abrir el Centro de seguridad" },
  },
  {
    id: "products",
    title: "Agrega los productos a tu app",
    how: "En tu app → Agregar producto: «WhatsApp» y «Inicio de sesión de Facebook para empresas».",
    link: { href: "https://developers.facebook.com/apps/", label: "Abrir mis apps" },
  },
  {
    id: "basic",
    title: "Completa los datos básicos y pásala a modo Live",
    how: "Configuración → Básica: ícono, política de privacidad, categoría y dominio agente.funnelslabs.app. Luego activa el interruptor «Modo de la app: Live».",
  },
  {
    id: "advanced-access",
    title: "Pide el acceso avanzado",
    how: "Revisión de la app → Permisos y funciones: pide «whatsapp_business_management» y «whatsapp_business_messaging» con un video corto del flujo (un cliente pulsando «Conectar con Facebook» y terminando). Meta responde en unos días.",
  },
  {
    id: "access-verification",
    title: "Completa la verificación de acceso (Tech Provider)",
    how: "Cuando aprueben el acceso avanzado: tu app → Configuración → Básica → «Verificación de acceso». Con eso podrás sumar clientes ajenos sin límite bajo.",
  },
  {
    id: "config",
    title: "Crea la configuración de «WhatsApp Embedded Signup»",
    how: "Inicio de sesión de Facebook para empresas → Configuraciones → Crear: plantilla de WhatsApp Embedded Signup, con los permisos de WhatsApp. Copia su ID a Vercel como META_WA_CONFIG_ID y agrega agente.funnelslabs.app en «Dominios permitidos para el SDK de JavaScript».",
  },
  {
    id: "webhook",
    title: "Configura el webhook",
    how: `WhatsApp → Configuración → Webhook: URL ${webhookUrl()}, token = el de WHATSAPP_VERIFY_TOKEN, y suscribe «messages».`,
  },
  {
    id: "payment",
    title: "Cada cliente agrega su método de pago",
    how: "Meta cobra las conversaciones. En WhatsApp Manager → Configuración de pagos, cada cliente agrega su tarjeta (la pantalla de conexión se lo recuerda al terminar).",
    link: { href: "https://business.facebook.com/wa/manage/home", label: "Abrir WhatsApp Manager" },
  },
];
