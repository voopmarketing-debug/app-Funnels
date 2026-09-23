import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

/**
 * WhatsApp only accepts/plays voice notes in Ogg/Opus — a browser's
 * MediaRecorder can't reliably record straight to that (Chrome only
 * supports WebM/Opus), so a manually-recorded or manually-attached audio
 * file has to be transcoded before it's sent, or Meta silently fails to
 * deliver/play it. Opus is the payload either way, so this is closer to a
 * remux than a lossy re-encode.
 */
export async function convertToOggOpus(bytes: Buffer): Promise<Buffer> {
  if (!ffmpegPath) throw new Error("ffmpeg binary not available on this server");
  const ffmpegBinary: string = ffmpegPath;

  const dir = await mkdtemp(path.join(tmpdir(), "voice-"));
  const inputPath = path.join(dir, "input");
  const outputPath = path.join(dir, "output.ogg");

  try {
    await writeFile(inputPath, bytes);
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegBinary, ["-y", "-i", inputPath, "-c:a", "libopus", "-b:a", "32k", "-vn", outputPath]);
      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      });
    });
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
