import { describe, expect, it } from "vitest";
import { toEmbedUrl } from "./websiteTemplate";

describe("toEmbedUrl", () => {
  it("rebuilds YouTube and Vimeo links into our own embed address", () => {
    expect(toEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://youtu.be/dQw4w9WgXcQ?si=x")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(toEmbedUrl("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
  });
  it("refuses look-alike hosts, odd ids and other schemes", () => {
    for (const bad of ["https://youtube.com.evil.test/embed/dQw4w9WgXcQ", "https://evil-youtube.com/watch?v=dQw4w9WgXcQ", "http://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/watch?v=../../x", "https://vimeo.com.evil.test/123456789", "javascript:alert(1)"]) {
      expect(toEmbedUrl(bad), bad).toBeNull();
    }
  });
});
