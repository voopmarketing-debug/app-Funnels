"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FunnelsLogoMark } from "@/components/FunnelsLogoMark";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Credenciales inválidas.");
      return;
    }

    router.push(searchParams.get("callbackUrl") ?? "/dashboard");
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      <div className="fl-grid-bg pointer-events-none absolute inset-0" />

      <form
        action={handleSubmit}
        autoComplete="on"
        className="relative w-full max-w-sm space-y-6 rounded-xl border border-border bg-surface p-7"
      >
        <div className="flex items-center gap-3">
          <FunnelsLogoMark className="h-7 w-7 flex-none" />
          <span className="fl-mono text-xs font-medium tracking-[0.14em] text-ink uppercase">
            Funnels_Labs
          </span>
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-bold">Iniciar sesión</h1>
          <p className="text-sm text-ink-muted">Tu negocio, respondiendo en WhatsApp 24/7 con IA</p>
        </div>

        {searchParams.get("registered") === "1" && (
          <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            Cuenta creada. Ya puedes iniciar sesión.
          </p>
        )}

        {searchParams.get("reset") === "1" && (
          <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent">
            Contraseña actualizada. Ya puedes iniciar sesión con la nueva.
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="tu@correo.com"
            autoComplete="username"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
              Contraseña
            </label>
            <Link href="/forgot-password" className="text-xs text-accent hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-ink outline-none focus:border-accent"
          />
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-3 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-center text-sm text-ink-muted">
          ¿Eres cliente nuevo?{" "}
          <Link href="/register" className="text-accent hover:underline">
            Crea tu cuenta
          </Link>
        </p>
      </form>
    </main>
  );
}
