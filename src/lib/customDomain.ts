/**
 * Cleans and checks the hostname a client asks to connect to a page
 * ("pagina.tunegocio.com"). Only real subdomains of someone's own domain are
 * accepted: never this platform's own hosts (funnelslabs.app, vercel.app,
 * localhost), never an IP address, and the proxy serves whatever is saved
 * here on that hostname, so it has to be a well-formed DNS name.
 */
export type CustomDomainCheck = { ok: true; domain: string } | { ok: false; error: string };

const RESERVED_SUFFIXES = ["funnelslabs.app", "vercel.app", "vercel.com", "localhost", "local", "internal", "test", "invalid", "example"];
const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function checkCustomDomain(raw: string): CustomDomainCheck {
  const domain = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.$/, "");

  // Clearing the field is allowed: it disconnects the domain.
  if (!domain) return { ok: true, domain: "" };

  const labels = domain.split(".");
  if (labels.length < 3) {
    return { ok: false, error: "Pide un subdominio, no el dominio completo solo — ej: pagina.tunegocio.com, no tunegocio.com." };
  }
  const wellFormed = domain.length <= 253 && labels.every((l) => LABEL.test(l)) && /^[a-z]{2,24}$/.test(labels[labels.length - 1]);
  if (!wellFormed) {
    return { ok: false, error: "Ese dominio no parece válido. Escríbelo solo con letras, números y guiones, ej: pagina.tunegocio.com." };
  }
  if (RESERVED_SUFFIXES.some((s) => domain === s || domain.endsWith(`.${s}`))) {
    return { ok: false, error: "Ese dominio pertenece a la plataforma. Usa un subdominio de tu propio dominio, ej: pagina.tunegocio.com." };
  }
  return { ok: true, domain };
}
