import { createHash } from "node:crypto";

// The pages' own inline scripts (the ones written as a bare <script>…</script>) are allowed in the
// Content-Security-Policy by the SHA-256 of their exact text, so any other script is still blocked.
// Hashing what the page really contains keeps the policy right whatever the page is built from.

export function inlineScriptHashes(html: string): string[] {
  const out: string[] = [];
  const re = /<script>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(createHash("sha256").update(m[1]).digest("base64"));
  return Array.from(new Set(out));
}

/** Adds the given script hashes to the script-src of a policy (leaves the policy alone when there are none). */
export function addScriptHashes(csp: string | undefined, hashes: string[]): string | undefined {
  if (!csp || hashes.length === 0) return csp;
  const extra = hashes.map((h) => `'sha256-${h}'`).join(" ");
  return csp.replace(/script-src ([^;]*)/, (_m, list: string) => `script-src ${list.replace(/'none'/g, "").trim()} ${extra}`.replace(/\s+/g, " "));
}
