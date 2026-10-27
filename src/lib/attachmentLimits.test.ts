import { describe, expect, it } from "vitest";
import { isAllowedUploadType } from "./attachmentLimits";

describe("isAllowedUploadType", () => {
  it("allows pictures, audio, video and office documents", () => {
    for (const ok of ["image/jpeg", "image/png", "audio/ogg", "audio/webm;codecs=opus", "video/mp4", "application/pdf", "text/plain", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]) {
      expect(isAllowedUploadType(ok), ok).toBe(true);
    }
  });
  it("refuses active content and empty types", () => {
    for (const bad of ["text/html", "image/svg+xml", "application/javascript", "application/x-msdownload", "application/octet-stream", "application/zip", ""]) {
      expect(isAllowedUploadType(bad), bad).toBe(false);
    }
  });
});
