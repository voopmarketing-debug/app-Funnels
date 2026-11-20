import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";

/**
 * What the Android / iPhone app shows where the web would offer a purchase (renewing, activating the
 * trial): no price and no payment, just how to get help. See lib/storeApp.ts.
 */
export function StoreAppNotice({ title, text, logout }: { title: string; text: string; logout?: () => Promise<void> }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="fl-card w-full space-y-5 p-6 text-center sm:p-8">
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-ink">{title}</h1>
          <p className="text-sm text-ink-muted">{text}</p>
        </div>
        <a
          href={SUPPORT_WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
        >
          Hablar con soporte
        </a>
        {logout && (
          <form action={logout}>
            <button type="submit" className="text-xs text-ink-muted underline hover:text-ink">
              Cerrar sesión
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
