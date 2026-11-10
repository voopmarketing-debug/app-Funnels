import { describe, expect, it } from "vitest";
import { callPublicUrl, checkOutboundUrl, isPublicAddress } from "./safeHttp";

describe("isPublicAddress", () => {
  it("accepts public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "142.250.80.46", "172.15.0.1", "172.32.0.1", "100.63.0.1", "2606:4700:4700::1111", "2001:4860:4860::8888"]) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });
  it("refuses everything that points inside", () => {
    for (const ip of [
      "127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1", "255.255.255.255", "198.18.0.1",
      "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "2001:db8::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "64:ff9b::a00:1", "2002:7f00:1::1",
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });
  it("refuses what isn't an address", () => {
    expect(isPublicAddress("example.com")).toBe(false);
    expect(isPublicAddress("999.1.1.1")).toBe(false);
  });
});

describe("checkOutboundUrl", () => {
  it("accepts a normal https address", () => {
    expect(checkOutboundUrl("https://hooks.example.com/flow?a=1").ok).toBe(true);
  });
  it("refuses http, credentials, other ports, local names and private IPs", () => {
    for (const url of [
      "http://example.com/x",
      "https://user:pass@example.com/x",
      "https://example.com:8443/x",
      "https://localhost/x",
      "https://api.localhost/x",
      "https://intranet/x",
      "https://db.internal/x",
      "https://printer.local/x",
      "https://127.0.0.1/x",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/x",
      "https://10.1.2.3/x",
      "ftp://example.com/x",
      "no es una url",
    ]) {
      expect(checkOutboundUrl(url).ok, url).toBe(false);
    }
  });
  it("won't even try to connect to a refused address", async () => {
    await expect(callPublicUrl("https://127.0.0.1/x", { method: "POST" })).rejects.toThrow("no es pública");
    await expect(callPublicUrl("http://example.com/x", { method: "GET" })).rejects.toThrow("https");
  });
});
