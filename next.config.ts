import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ffmpeg-static ships a native binary (voice-note conversion, see
  // lib/audioConvert.ts) — keep it out of the server bundle and make sure
  // Vercel's file tracer actually copies the binary into the deployment.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/*": ["node_modules/ffmpeg-static/**/*"],
  },
};

export default nextConfig;
