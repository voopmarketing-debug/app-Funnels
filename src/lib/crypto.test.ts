import { describe, expect, it, beforeAll } from "vitest";
import { encryptSecret, decryptSecret } from "./crypto";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("crypto secret encryption", () => {
  it("round-trips a plaintext secret", () => {
    const plaintext = "EAAG-fake-whatsapp-access-token";
    const encrypted = encryptSecret(plaintext);

    expect(encrypted).not.toEqual(plaintext);
    expect(decryptSecret(encrypted)).toEqual(plaintext);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-input");
    const b = encryptSecret("same-input");
    expect(a).not.toEqual(b);
  });

  it("rejects a tampered payload", () => {
    const encrypted = encryptSecret("sensitive-value");
    const [iv, tag, data] = encrypted.split(".");
    const tampered = [iv, tag, Buffer.from("tampered").toString("base64")].join(".");

    expect(() => decryptSecret(tampered)).toThrow();
  });
});
