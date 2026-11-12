import Link from "next/link";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";

// The 404 for everything outside the panel (a mistyped address, an old link).
// Same look as the rest of the platform instead of Next's bare default.
export default function NotFound() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="fl-ambient-bg" />
      <div className="fl-card-hero relative w-full max-w-md space-y-5 p-6 text-center sm:p-8">
        <div className="flex items-center justify-center gap-3">
          <FunnelsLogoMark className="h-8 w-8 flex-none" />
          <span className="font-bold tracking-tight text-ink">Funnels Labs</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-ink">No encontramos esta página</h1>
          <p className="text-sm text-ink-muted">Revisa la dirección o entra desde tu panel.</p>
        </div>
        <Link
          href="/dashboard"
          className="block w-full rounded-xl bg-accent px-4 py-3 text-base font-semibold text-accent-ink transition hover:bg-accent-hover"
        >
          Ir a mi panel
        </Link>
      </div>
    </main>
  );
}
