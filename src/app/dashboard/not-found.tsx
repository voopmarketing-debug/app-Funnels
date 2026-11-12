import Link from "next/link";

// Shown inside the panel (menu and all) when a link points to something that
// isn't there or isn't this account's: an old bookmark, a deleted contact, a
// page for another business. Without this, Next shows its bare black 404 and
// the whole platform looks like it is down.
export default function DashboardNotFound() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <div className="fl-card space-y-5 p-6 sm:p-8">
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-ink">No encontramos esta página</h1>
          <p className="text-sm text-ink-muted">
            El enlace puede ser viejo, o la página ya no existe o no es de tu cuenta. La plataforma sigue funcionando.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="block w-full rounded-xl bg-accent px-4 py-3 text-base font-semibold text-accent-ink transition hover:bg-accent-hover"
        >
          Ir a mi panel
        </Link>
      </div>
    </div>
  );
}
