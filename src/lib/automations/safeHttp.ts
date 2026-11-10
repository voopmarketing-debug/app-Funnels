import dns from "node:dns";
import https from "node:https";
import net from "node:net";

// Outbound calls to an address a customer typed in (the "Enviar a una URL"
// step). Without care, a flow could be pointed at our own network (cloud
// metadata, databases, localhost) and read what only the server can reach.
// So: https only, no credentials in the address, the default port, and the
// address is checked when the connection is made (not before), which also
// stops a name that changes its answer between the check and the call.

/** True for an address on the public internet; false for loopback, private, link-local, reserved and similar ranges. */
export function isPublicAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isPublicV4(ip.split(".").map(Number));
  if (net.isIPv6(ip)) return isPublicV6(ip);
  return false;
}

function isPublicV4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // shared address space (CGNAT)
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false; // multicast and reserved
  return true;
}

/** An IPv6 address as its 8 groups of 16 bits. */
function v6Groups(ip: string): number[] | null {
  let text = ip.toLowerCase().split("%")[0];
  // The tail can be an IPv4 address: ::ffff:1.2.3.4
  const v4 = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const p = v4[1].split(".").map(Number);
    text = text.slice(0, -v4[1].length) + ((p[0] << 8) | p[1]).toString(16) + ":" + ((p[2] << 8) | p[3]).toString(16);
  }
  const [head, tail] = text.split("::");
  const left = head ? head.split(":") : [];
  const right = tail !== undefined && tail ? tail.split(":") : [];
  if (tail === undefined ? left.length !== 8 : left.length + right.length > 7) return null;
  const parts = tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  const groups = parts.map((g) => parseInt(g || "0", 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

function isPublicV6(ip: string): boolean {
  const g = v6Groups(ip);
  if (!g) return false;
  const embeddedV4 = (hi: number, lo: number) => isPublicV4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  if (g.every((x) => x === 0)) return false; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return false; // ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return embeddedV4(g[6], g[7]); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return embeddedV4(g[6], g[7]); // NAT64 64:ff9b::/96
  if ((g[0] & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((g[0] & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((g[0] & 0xff00) === 0xff00) return false; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (g[0] === 0x2002) return embeddedV4(g[1], g[2]); // 6to4
  return true;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; error: string };

/** The checks that need no network: scheme, credentials, port and names that never point outside. */
export function checkOutboundUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "La dirección no es válida." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "La dirección debe empezar con https://." };
  if (url.username || url.password) return { ok: false, error: "La dirección no puede llevar usuario ni contraseña." };
  if (url.port && url.port !== "443") return { ok: false, error: "Solo se permite el puerto normal de https." };
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && !net.isIP(host)) {
    return { ok: false, error: "Esa dirección no es pública." };
  }
  if (net.isIP(host) && !isPublicAddress(host)) return { ok: false, error: "Esa dirección no es pública." };
  return { ok: true, url };
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void;

/** DNS lookup that refuses to hand back any address that isn't public. */
function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => !isPublicAddress(a.address))) {
      return callback(Object.assign(new Error("Esa dirección no es pública."), { code: "EBLOCKED" }) as NodeJS.ErrnoException, "");
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

const MAX_RESPONSE_BYTES = 64 * 1024;

/** Calls a public https address and returns the status. Redirects are not followed; the answer is read only up to a small limit. */
export function callPublicUrl(raw: string, opts: { method: "GET" | "POST"; body?: unknown; timeoutMs?: number }): Promise<{ status: number }> {
  const checked = checkOutboundUrl(raw);
  if (!checked.ok) return Promise.reject(new Error(checked.error));
  const { url } = checked;
  const payload = opts.method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: 443,
        path: `${url.pathname}${url.search}`,
        method: opts.method,
        headers: { "User-Agent": "FunnelsLabs-Flows/1.0", ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}) },
        lookup: guardedLookup as unknown as typeof dns.lookup,
        timeout: opts.timeoutMs ?? 8000,
      },
      (res) => {
        let read = 0;
        res.on("data", (chunk: Buffer) => {
          read += chunk.length;
          if (read > MAX_RESPONSE_BYTES) res.destroy();
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
        res.on("close", () => resolve({ status: res.statusCode ?? 0 }));
        res.on("error", () => resolve({ status: res.statusCode ?? 0 }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("La dirección tardó demasiado en responder.")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}
