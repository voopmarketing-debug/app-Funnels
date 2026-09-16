import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="fl-ambient-bg" />
      <div className="fl-grid-bg pointer-events-none absolute inset-0" />
      <ThemeToggle className="fl-nav-icon absolute right-4 top-4 z-10" />

      <div className="relative w-full max-w-sm space-y-6 fl-card-hero p-7">
        <div className="flex items-center gap-3">
          <FunnelsLogoMark className="h-7 w-7 flex-none" />
          <span className="fl-mono text-xs font-medium tracking-[0.14em] text-ink uppercase">
            Funnels_Labs
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold">Elige tu nueva contraseña</h1>
        </div>

        <ResetPasswordForm token={token ?? ""} />
      </div>
    </main>
  );
}
