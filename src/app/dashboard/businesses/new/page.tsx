import Link from "next/link";
import { auth } from "@/auth";
import { createBusiness } from "@/lib/actions";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { getAccountLineStatus } from "@/lib/lineLimits";
import { PLAN_LABELS } from "@/lib/plans";

const SUPPORT_WHATSAPP_LINK = "https://wa.me/message/F2RWC3YUI7EYM1";

export default async function NewBusinessPage() {
  const session = await auth();
  const lineStatus = session?.user?.id ? await getAccountLineStatus(session.user.id) : null;

  if (lineStatus?.atLimit) {
    return (
      <div className="mx-auto max-w-md">
        <div className="fl-card-hero space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-2xl">
            🔒
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold">Llegaste al límite de tu plan</h1>
            <p className="text-sm text-ink-muted">
              Tu plan <span className="font-semibold text-ink">{PLAN_LABELS[lineStatus.planTier]}</span> permite
              hasta {lineStatus.limit} {lineStatus.limit === 1 ? "línea" : "líneas"} de WhatsApp, y ya tienes{" "}
              {lineStatus.count}. Actualiza de plan o escríbenos y te ayudamos a agregar más.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a
              href={SUPPORT_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover"
            >
              Hablar con soporte
            </a>
            <Link
              href="/dashboard"
              className="rounded-md border border-border-strong px-4 py-2 text-sm font-medium text-ink transition hover:border-accent"
            >
              Volver a agentes de IA
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-bold">Nuevo agente de IA</h1>

      <form action={createBusiness} className="fl-card space-y-4 p-5">
        <Field label="Nombre del negocio" name="name" placeholder="Pizzería El Sabor" required />
        <Field
          label="Phone Number ID (Meta Cloud API)"
          name="wabaPhoneNumberId"
          placeholder="123456789012345"
          required
        />
        <Field
          label="Access Token (Meta Cloud API)"
          name="wabaAccessToken"
          type="password"
          placeholder="EAAG..."
          required
        />
        <div className="space-y-1">
          <label htmlFor="industry" className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
            Tipo de negocio
          </label>
          <select
            id="industry"
            name="industry"
            defaultValue="otro"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
          >
            {INDUSTRY_OPTIONS.map((option) => (
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
          <p className="text-xs text-ink-muted">
            Pega aquí el prompt ya completado con la info real del negocio.
          </p>
          <textarea
            id="systemPrompt"
            name="systemPrompt"
            required
            rows={16}
            placeholder="Pega aquí las instrucciones del agente para este negocio..."
            className="fl-mono w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover"
        >
          Crear agente de IA
        </button>
      </form>
    </div>
  );
}

function Field(props: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  const { label, name, placeholder, type = "text", required } = props;
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="fl-mono text-xs tracking-wide text-ink-muted uppercase">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-ink outline-none focus:border-accent"
      />
    </div>
  );
}
