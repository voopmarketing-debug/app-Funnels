"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createBusiness } from "@/lib/actions";

type CreateState = { error: string | null };

export function NewBusinessForm({ industryOptions }: { industryOptions: { value: string; label: string }[] }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<CreateState, FormData>(
    async (_prevState, formData) => {
      try {
        const result = await createBusiness(formData);
        if (result?.error) return { error: result.error };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "No se pudo crear el agente, intenta de nuevo" };
      }
      router.push("/dashboard/agentes");
      return { error: null };
    },
    { error: null },
  );

  return (
    <form action={formAction} className="fl-card space-y-4 p-5">
      <Field label="Nombre del negocio" name="name" placeholder="Pizzería El Sabor" required disabled={isPending} />
      <Field
        label="Phone Number ID (Meta Cloud API)"
        hint="Un número largo (unos 15 dígitos) de WhatsApp Manager → Configuración de la API. No es el teléfono del negocio."
        name="wabaPhoneNumberId"
        placeholder="123456789012345"
        required
        disabled={isPending}
      />
      <Field
        label="Access Token (Meta Cloud API)"
        hint="El token permanente de tu usuario del sistema en Meta. Comprobamos con Meta que sirva para ese número antes de crear el agente."
        name="wabaAccessToken"
        type="password"
        placeholder="EAAG..."
        required
        disabled={isPending}
      />
      <div className="space-y-1">
        <label htmlFor="industry" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Tipo de negocio
        </label>
        <select
          id="industry"
          name="industry"
          defaultValue="otro"
          disabled={isPending}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
        >
          {industryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <label htmlFor="systemPrompt" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
          Instrucciones del agente de IA
        </label>
        <p className="text-xs text-ink-muted">Pega aquí el prompt ya completado con la info real del negocio.</p>
        <textarea
          id="systemPrompt"
          name="systemPrompt"
          required
          rows={16}
          disabled={isPending}
          placeholder="Pega aquí las instrucciones del agente para este negocio..."
          className="fl-mono w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
      >
        {isPending ? "Creando..." : "Crear agente de IA"}
      </button>
      {state.error && <p className="text-sm text-error">{state.error}</p>}
    </form>
  );
}

function Field(props: { label: string; hint?: string; name: string; placeholder?: string; type?: string; required?: boolean; disabled?: boolean }) {
  const { label, hint, name, placeholder, type = "text", required, disabled } = props;
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
        {label}
      </label>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
      />
    </div>
  );
}
