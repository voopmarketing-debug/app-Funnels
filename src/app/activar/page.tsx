import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";
import { PLAN_LIMITS, PLAN_PRICE_COP, TRIAL_DAYS } from "@/lib/plans";
import { TrialForm, WaitForActivation } from "./TrialForm";

function trialEndLabel() {
  const end = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).format(end);
}

// Step 2 of signing up: register a card in Mercado Pago to start the free
// trial (nothing is charged until it ends). The dashboard sends every
// self-registered account here until the subscription is authorized.
export default async function ActivarPage({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/activar");
  const { estado } = await searchParams;
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
          Tienes {TRIAL_DAYS} días para probar todo. Te enviamos un correo con tu acceso: entra siempre con el correo y la contraseña que creaste.
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
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">Paso 2 de 2</p>
          <h1 className="text-2xl font-bold leading-tight">Activa tus {TRIAL_DAYS} días gratis</h1>
          <p className="text-sm text-ink-muted">
            Registra tu tarjeta en Mercado Pago para empezar. <strong className="text-ink">Hoy no te cobramos nada</strong>: el primer cobro es el{" "}
            {firstChargeLabel} y puedes cancelar antes cuando quieras.
          </p>
        </div>
        <TrialForm
          plans={[
            { key: "STARTER", name: "Starter", priceCop: PLAN_PRICE_COP.STARTER, detail: `${PLAN_LIMITS.STARTER} clientes atendidos por IA al mes · 1 línea` },
            { key: "PRO", name: "Pro", priceCop: PLAN_PRICE_COP.PRO, detail: `${PLAN_LIMITS.PRO?.toLocaleString("es-CO")} clientes atendidos por IA al mes · 3 líneas` },
          ]}
        />
        <ul className="space-y-1.5 text-xs text-ink-muted">
          <li>🔒 Pago seguro con Mercado Pago. Nosotros nunca vemos tu tarjeta.</li>
          <li>📩 Al terminar te llega un correo con tu acceso.</li>
        </ul>
      </div>
    );
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="fl-ambient-bg" />
      <div className="fl-grid-bg pointer-events-none absolute inset-0" />
      <div className="fl-card-hero relative w-full max-w-md space-y-6 p-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FunnelsLogoMark className="h-7 w-7 flex-none" />
            <span className="text-sm font-bold tracking-tight text-ink">Funnels Labs</span>
          </div>
          <form action={logout}>
            <button type="submit" className="text-xs text-ink-muted underline hover:text-ink">
              Salir
            </button>
          </form>
        </div>
        {body}
        <p className="text-center text-xs text-ink-muted">
          ¿Dudas?{" "}
          <a href={SUPPORT_WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            Escríbenos por WhatsApp
          </a>
        </p>
      </div>
    </main>
  );
}
