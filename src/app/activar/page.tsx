import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SignupShell, CheckList } from "@/components/SignupShell";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";
import { PLAN_PRICE_COP, STARTER_FEATURES, TRIAL_DAYS, TRIAL_PLAN, PLAN_LABELS } from "@/lib/plans";
import { claimReturnedPreapproval } from "@/lib/trial";
import { TrialForm, WaitForActivation } from "./TrialForm";

function trialEndLabel() {
  const end = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).format(end);
}

// Step 2 of signing up: register a card in Mercado Pago to start the free
// trial (nothing is charged until it ends). The dashboard sends every
// self-registered account here until the subscription is authorized.
export default async function ActivarPage({ searchParams }: { searchParams: Promise<{ estado?: string; preapproval_id?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/activar");
  const { estado, preapproval_id: preapprovalId } = await searchParams;
  // Mercado Pago appends the subscription id when it sends them back: link it
  // to whoever is signed in right away instead of waiting on the webhook.
  if (preapprovalId && /^[\w-]{1,64}$/.test(preapprovalId)) {
    await claimReturnedPreapproval(session.user.id, preapprovalId).catch((err) => console.error("Could not claim returned subscription:", err));
  }
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, activationRequired: true },
  });
  if (!user) redirect("/login");

  const firstChargeLabel = trialEndLabel();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  let body: React.ReactNode;
  if (!user.activationRequired) {
    if (estado !== "listo") redirect("/dashboard");
    body = (
      <div className="space-y-4 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-accent-ink">✓</span>
        <h1 className="text-2xl font-bold">¡Tu prueba gratis ya empezó!</h1>
        <p className="text-sm text-ink-muted">
          Tienes {TRIAL_DAYS} días para probar todo. Para volver a entrar, usa siempre el correo y la contraseña que creaste en agente.funnelslabs.app.
        </p>
        <Link href="/dashboard" className="block w-full rounded-lg bg-accent px-4 py-3 font-semibold text-accent-ink transition hover:bg-accent-hover">
          Entrar a mi panel
        </Link>
      </div>
    );
  } else if (estado === "listo") {
    body = <WaitForActivation supportLink={SUPPORT_WHATSAPP_LINK} />;
  } else {
    body = (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Activa tus {TRIAL_DAYS} días gratis</h1>
          <p className="text-sm text-ink-muted">Registra tu tarjeta en Mercado Pago y empieza ahora. Cancelas cuando quieras.</p>
        </div>

        <ol className="grid grid-cols-2 gap-2 text-sm">
          <li className="rounded-xl border border-accent/50 bg-accent/10 p-3">
            <span className="block text-xs text-ink-muted">Hoy</span>
            <span className="block text-lg font-bold text-ink">$0</span>
            <span className="block text-xs text-ink-muted">Empiezas tu prueba</span>
          </li>
          <li className="rounded-xl border border-border p-3">
            <span className="block text-xs text-ink-muted">{firstChargeLabel}</span>
            <span className="block text-lg font-bold text-ink">${PLAN_PRICE_COP[TRIAL_PLAN].toLocaleString("es-CO")}</span>
            <span className="block text-xs text-ink-muted">Primer cobro mensual</span>
          </li>
        </ol>

        <details className="group rounded-xl border border-border p-3 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-ink">
            Plan {PLAN_LABELS[TRIAL_PLAN]}: todo lo que incluye
            <span className="text-accent transition group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <CheckList items={STARTER_FEATURES} className="mt-3" />
        </details>

        <TrialForm supportLink={SUPPORT_WHATSAPP_LINK} />

        <ul className="space-y-1.5 text-xs text-ink-muted">
          <li>🔒 Pago seguro con Mercado Pago. Nosotros nunca vemos tu tarjeta.</li>
          <li>✅ Al terminar vuelves aquí y entras directo a tu panel con el correo y la contraseña que creaste.</li>
          <li>
            ¿Necesitas el plan Pro?{" "}
            <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Escríbenos
            </a>{" "}
            y lo activamos contigo.
          </li>
        </ul>
      </div>
    );
  }

  return (
    <SignupShell
      step={user.activationRequired && estado !== "listo" ? 2 : undefined}
      topRight={
        <form action={logout}>
          <button type="submit" className="text-xs text-ink-muted underline hover:text-ink">
            Salir
          </button>
        </form>
      }
      aside={
        <>
          <div className="space-y-2">
            <span className="inline-block rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">{TRIAL_DAYS} días gratis</span>
            <h2 className="text-3xl font-bold text-ink">Plan {PLAN_LABELS[TRIAL_PLAN]}</h2>
            <p className="text-ink-muted">
              <strong className="text-2xl text-ink">${PLAN_PRICE_COP[TRIAL_PLAN].toLocaleString("es-CO")}</strong> /mes después de la prueba
            </p>
          </div>
          <CheckList items={STARTER_FEATURES} />
        </>
      }
    >
      {body}
      <p className="text-center text-xs text-ink-muted">
        ¿Dudas?{" "}
        <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          Escríbenos por WhatsApp
        </a>
      </p>
    </SignupShell>
  );
}
