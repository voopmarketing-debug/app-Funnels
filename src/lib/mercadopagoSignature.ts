import { createHmac, timingSafeEqual } from "crypto";

// Mercado Pago signs each webhook with the app's secret key ("clave
// secreta" of the webhook, in Tus integraciones → Webhooks):
//   x-signature: ts=<unix ms>,v1=<hex HMAC-SHA256>
// over the manifest "id:<data.id>;request-id:<x-request-id>;ts:<ts>;", where
// data.id is the query param (lowercased when alphanumeric) and any part
// whose value is missing is left out.

export function mpSignatureManifest(dataId: string | null, requestId: string | null, ts: string): string {
  const id = dataId ? (/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId) : null;
  return `${id ? `id:${id};` : ""}${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
}

export function verifyMpSignature(params: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  if (!params.signatureHeader) return false;
  const parts = Object.fromEntries(
    params.signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1 || !/^[0-9a-f]+$/i.test(v1)) return false;
  const expected = createHmac("sha256", params.secret).update(mpSignatureManifest(params.dataId, params.requestId, ts)).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1.toLowerCase(), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
