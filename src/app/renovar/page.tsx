import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignupShell } from "@/components/SignupShell";
import { SUPPORT_WHATSAPP_LINK } from "@/lib/constants";
import { claimReturnedPayment, claimReturnedRenewal, renewalContext } from "@/lib/renewal";
import { WaitForActivation } from "../activar/TrialForm";

const ID = /^[\w-]{1,64}$/;

// Where Mercado Pago sends the client back after renewing. It carries the
// subscription id or the payment id; whoever is signed in is who just paid,
// so the plan is reactivated here without waiting for the webhook.
export default async function RenovarPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; preapproval_id?: string; payment_id?: string; collection_id?: string }>;
}) {
  const q = await searchParams;
  const session = await auth();
  if (!session?.user?.id) {
    // Back in a browser without their session (e.g. the Mercado Pago app opened
    // another one): signing in finishes the renewal.
    const back = new URLSearchParams();
    for (const key of ["estado", "preapproval_id", "payment_id", "collection_id"] as const) if (q[key]) back.set(key, q[key]!);
    redirect(`/login?callbackUrl=${encodeURIComponent(back.size ? `/renovar?${back}` : "/renovar")}`);
  }
  const userId = session.user.id;

  const paymentId = q.payment_id ?? q.collection_id;
  if (q.preapproval_id && ID.test(q.preapproval_id)) {
    await claimReturnedRenewal(userId, q.preapproval_id).catch((err) => console.error("Could not claim returned renewal:", err));
  }
  if (paymentId && ID.test(paymentId)) {
    await claimReturnedPayment(userId, paymentId).catch((err) => console.error("Could not claim returned payment:", err));
  }

  const ctx = await renewalContext(userId);
  // Opened by hand, or not an owner: nothing to show here.
  if (!ctx || (q.estado !== "listo" && ctx.active)) redirect("/dashboard");

  return (
    <SignupShell
      aside={
        <div className="space-y-2">
          <h2 className="text-3xl font-bold text-ink">Tu agente vuelve a trabajar</h2>
          <p className="text-ink-muted">En cuanto Mercado Pago confirma el pago, todo queda como lo dejaste.</p>
        </div>
      }
    >
      {ctx.active ? (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-accent-ink">✓</span>
          <h1 className="text-2xl font-bold">¡Listo! Tu plan está activo</h1>
          <p className="text-sm text-ink-muted">Tu agente ya vuelve a responder a tus clientes.</p>
          <Link href="/dashboard" className="block w-full rounded-lg bg-accent px-4 py-3 font-semibold text-accent-ink transition hover:bg-accent-hover">
            Entrar a mi panel
          </Link>
        </div>
      ) : (
        <WaitForActivation supportLink={SUPPORT_WHATSAPP_LINK} />
      )}
    </SignupShell>
  );
}
