import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { diagnoseMpSignature, mpSignatureManifest, verifyMpSignature } from "./mercadopagoSignature";

const secret = "test-secret";
const sign = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex");

describe("verifyMpSignature", () => {
  it("accepts a correctly signed notification", () => {
    const v1 = sign("id:123456;request-id:req-1;ts:1700000000;");
    expect(verifyMpSignature({ signatureHeader: `ts=1700000000,v1=${v1}`, requestId: "req-1", dataId: "123456", secret })).toBe(true);
  });

  it("lowercases alphanumeric ids and drops missing parts", () => {
    expect(mpSignatureManifest("ABC123", null, "1")).toBe("id:abc123;ts:1;");
    const v1 = sign("id:abc123;ts:1;");
    expect(verifyMpSignature({ signatureHeader: `ts=1,v1=${v1}`, requestId: null, dataId: "ABC123", secret })).toBe(true);
  });

  it("rejects a wrong signature, a different id, or no header", () => {
    const v1 = sign("id:1;request-id:r;ts:2;");
    expect(verifyMpSignature({ signatureHeader: `ts=2,v1=${v1}`, requestId: "r", dataId: "999", secret })).toBe(false);
    expect(verifyMpSignature({ signatureHeader: "ts=2,v1=zz", requestId: "r", dataId: "1", secret })).toBe(false);
    expect(verifyMpSignature({ signatureHeader: null, requestId: "r", dataId: "1", secret })).toBe(false);
  });
});

describe("diagnoseMpSignature", () => {
  it("names the manifest variant that matches, without exposing the secret", () => {
    const v1 = sign("id:123456;ts:9;");
    const d = diagnoseMpSignature({ signatureHeader: `ts=9,v1=${v1}`, requestId: "req-x", queryDataId: "123456", bodyDataId: "123456", secret });
    expect(d.matched).toBe("no_request_id");
    expect(JSON.stringify(d)).not.toContain(secret);
  });

  it("says none when the secret is wrong", () => {
    const v1 = createHmac("sha256", "otra-clave").update("id:1;request-id:r;ts:2;").digest("hex");
    expect(diagnoseMpSignature({ signatureHeader: `ts=2,v1=${v1}`, requestId: "r", queryDataId: "1", bodyDataId: null, secret }).matched).toBe("none");
  });
});
