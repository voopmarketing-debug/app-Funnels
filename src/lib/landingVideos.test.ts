import { describe, expect, it } from "vitest";
import { videoSource } from "./landingVideos";

describe("videoSource", () => {
  it("reads the usual YouTube links", () => {
    for (const link of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ", "https://youtube.com/shorts/dQw4w9WgXcQ"]) {
      expect(videoSource(link)).toEqual({ kind: "youtube", url: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
    }
  });
  it("reads Vimeo and direct files", () => {
    expect(videoSource("https://vimeo.com/123456789")).toEqual({ kind: "vimeo", url: "https://player.vimeo.com/video/123456789" });
    expect(videoSource("https://files.example.com/videos/hero.mp4?v=2")).toEqual({ kind: "file", url: "https://files.example.com/videos/hero.mp4?v=2" });
  });
  it("reads video files kept in the public folder", () => {
    expect(videoSource("/landing/vsl-hero.mp4")).toEqual({ kind: "file", url: "/landing/vsl-hero.mp4" });
    expect(videoSource("//evil.example/x.mp4")).toBeNull();
    expect(videoSource("/landing/../secret.mp4")).toBeNull();
  });
  it("refuses anything else", () => {
    expect(videoSource("")).toBeNull();
    expect(videoSource("http://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(videoSource("https://evil.example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(videoSource("javascript:alert(1)")).toBeNull();
    expect(videoSource("https://example.com/page.html")).toBeNull();
  });
});
