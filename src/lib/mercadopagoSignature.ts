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

/**
 * For the logs when a signature doesn't verify: which way of building the
 * manifest (if any) matches, and the header's shape. Never includes the
 * secret or the signature itself. "none" means the secret is the wrong one.
 */
export function diagnoseMpSignature(params: {
  signatureHeader: string | null;
  requestId: string | null;
  queryDataId: string | null;
  bodyDataId: string | null;
  secret: string;
}): Record<string, string | number | boolean> {
  const parts = Object.fromEntries(
    (params.signatureHeader ?? "").split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=").trim()];
    }),
  );
  const ts = parts.ts ?? "";
  const v1 = (parts.v1 ?? "").toLowerCase();
  const candidates: Record<string, string> = {
    query_lower: mpSignatureManifest(params.queryDataId, params.requestId, ts),
    query_raw: `${params.queryDataId ? `id:${params.queryDataId};` : ""}${params.requestId ? `request-id:${params.requestId};` : ""}ts:${ts};`,
    body: mpSignatureManifest(params.bodyDataId, params.requestId, ts),
    no_request_id: mpSignatureManifest(params.queryDataId ?? params.bodyDataId, null, ts),
  };
  const matched = Object.entries(candidates).find(
    ([, manifest]) => !!v1 && createHmac("sha256", params.secret).update(manifest).digest("hex") === v1,
  );
  return {
    matched: matched ? matched[0] : "none",
    hasSignature: !!params.signatureHeader,
    hasTs: !!ts,
    v1Length: v1.length,
    hasRequestId: !!params.requestId,
    // Not secret: lets us see whether something on the way replaced
    // Mercado Pago's own request id (a UUID) before it reached us.
    requestId: params.requestId ?? "",
    ts,
    queryDataId: params.queryDataId ?? "",
    bodyDataId: params.bodyDataId ?? "",
    secretLength: params.secret.length,
  };
}
