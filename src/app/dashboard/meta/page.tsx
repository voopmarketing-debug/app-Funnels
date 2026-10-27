import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { isAgencyAdmin } from "@/lib/authz";
import { envChecks, metaChecks, MANUAL_STEPS, type SetupCheck } from "@/lib/metaSetup";

// Agency-only: is everything ready for clients to press "Continuar con
// Facebook"? What can be checked from here is checked; what only Meta's own
// website can confirm is a short list, in order.
export const dynamic = "force-dynamic";

const STATUS = {
  ok: { mark: "✓", box: "border-accent/40 bg-accent/10", dot: "bg-accent text-accent-ink" },
  fail: { mark: "!", box: "border-error/40 bg-error/10", dot: "bg-error text-white" },
  unknown: { mark: "?", box: "border-border bg-surface-2/60", dot: "bg-ink/15 text-ink" },
} as const;

function CheckRow({ check }: { check: SetupCheck }) {
  const s = STATUS[check.status];
  return (
    <li className={`flex gap-3 rounded-xl border p-3.5 ${s.box}`}>
      <span className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${s.dot}`} aria-hidden="true">
        {s.mark}
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-ink">{check.label}</p>
        <p className="mt-0.5 text-ink-muted">{check.detail}</p>
        {check.fix && <p className="mt-1.5 text-[13px] leading-relaxed text-ink">Qué hacer: {check.fix}</p>}
      </div>
    </li>
  );
}

export default async function MetaSetupPage() {
  const session = await auth();
  if (!session?.user?.id || !(await isAgencyAdmin(session.user.id))) notFound();

  const checks = [...envChecks(), ...(await metaChecks())];
  const failing = checks.filter((c) => c.status === "fail").length;
  const configReady = checks.find((c) => c.id === "META_WA_CONFIG_ID")?.status === "ok";

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-ink">Conexión Meta</h1>
        <p className="max-w-prose text-sm text-ink-muted">
          Para que tus clientes conecten su WhatsApp con un solo botón, esta plataforma y tu app de Meta tienen que estar listas. Aquí ves qué falta.
        </p>
        <p className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${configReady && failing === 0 ? "bg-accent/15 text-accent" : "bg-error/10 text-error"}`}>
          {configReady && failing === 0 ? "Todo listo de nuestro lado" : failing === 1 ? "Falta 1 cosa" : `Faltan ${failing} cosas`}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-ink">Lo que revisamos solos</h2>
        <ul className="space-y-2">
          {checks.map((c) => (
            <CheckRow key={c.id} check={c} />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-ink">Lo que haces tú en Meta</h2>
        <p className="text-sm text-ink-muted">Solo Meta puede confirmarlo. Hazlo en este orden; los dos primeros son los que más tardan.</p>
        <ol className="space-y-2">
          {MANUAL_STEPS.map((step, i) => (
            <li key={step.id} className="flex gap-3 rounded-xl border border-border p-3.5">
              <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 border-accent/70 text-sm font-bold text-accent" aria-hidden="true">
                {i + 1}
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-ink">{step.title}</p>
                <p className="mt-0.5 leading-relaxed text-ink-muted">{step.how}</p>
                {step.link && (
                  <a href={step.link.href} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[13px] font-semibold text-accent hover:underline">
                    {step.link.label} ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="text-xs text-ink-faint">
          Mientras Meta no apruebe el acceso avanzado, el botón de Facebook solo funciona con personas que tengan un rol en tu app (tú y tus probadores). Para los demás clientes, el camino alterno es el token o la llamada guiada.
        </p>
      </section>
    </div>
  );
}
