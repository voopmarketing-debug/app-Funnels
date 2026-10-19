import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// The ffmpeg binary (80 MB) comes from the ffmpeg-static package, but it is NOT
// imported: an import makes Vercel copy it into every serverless function of
// the app (62 of 63 of them), and each deploy then costs gigabytes of function
// storage. Instead next.config.ts copies it only into the routes that send
// voice notes, and it is looked up by path here.
function ffmpegPath(): string | null {
  const file = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  // Built from parts so the file tracer cannot see the path and copy the binary everywhere.
  const pkg = ["ffmpeg", "static"].join("-");
  const found = path.join(process.cwd(), "node_modules", pkg, file);
  return existsSync(found) ? found : null;
}

/**
 * WhatsApp only accepts/plays voice notes in Ogg/Opus — a browser's
 * MediaRecorder can't reliably record straight to that (Chrome only
 * supports WebM/Opus), so a manually-recorded or manually-attached audio
 * file has to be transcoded before it's sent, or Meta silently fails to
 * deliver/play it. Opus is the payload either way, so this is closer to a
 * remux than a lossy re-encode.
 */
// Containers browsers and phones record voice notes in (WebM/Matroska from
// Chrome, MP4/M4A from Safari and iPhones, Ogg, MP3, WAV, AAC, AMR, 3GP).
const AUDIO_FORMATS = "matroska,webm,mov,mp4,m4a,3gp,3g2,mj2,ogg,mp3,wav,aac,amr,flac";
const MAX_SECONDS = 600;
const TIMEOUT_MS = 45_000;

export async function convertToOggOpus(bytes: Buffer): Promise<Buffer> {
  const ffmpegBinary = ffmpegPath();
  if (!ffmpegBinary) throw new Error("ffmpeg binary not available on this server");

  const dir = await mkdtemp(path.join(tmpdir(), "voice-"));
  const inputPath = path.join(dir, "input");
  const outputPath = path.join(dir, "output.ogg");

  try {
    await writeFile(inputPath, bytes);
    await new Promise<void>((resolve, reject) => {
      // -ac 1 forces mono — WhatsApp's voice-note player expects a single
      // channel; a stereo/multi-channel Ogg/Opus file (some mics record
      // stereo by default) is another way this silently fails to play on
      // the recipient's phone even though it decodes fine everywhere else.
      //
      // The input is a user's file, so ffmpeg is fenced in: only local-file
      // input (no http/concat/playlist tricks reaching other files or the
      // network), only real audio containers, at most 10 minutes of audio,
      // and the process is killed if it hangs.
      const proc = spawn(ffmpegBinary, [
        "-hide_banner",
        "-nostdin",
        "-y",
        "-protocol_whitelist",
        "file,pipe",
        "-format_whitelist",
        AUDIO_FORMATS,
        "-i",
        inputPath,
        "-t",
        String(MAX_SECONDS),
        "-map",
        "0:a:0",
        "-c:a",
        "libopus",
        "-ac",
        "1",
        "-b:a",
        "32k",
        "-vn",
        outputPath,
      ]);
      const timer = setTimeout(() => proc.kill("SIGKILL"), TIMEOUT_MS);
      let stderr = "";
      proc.stderr.on("data", (chunk) => {
        if (stderr.length < 20_000) stderr += chunk;
      });
      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      proc.on("close", (code, signal) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else if (signal === "SIGKILL") reject(new Error("ffmpeg took too long converting the audio"));
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
      });
    });
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
