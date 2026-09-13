import { createBusiness } from "@/lib/actions";
import { INDUSTRY_OPTIONS } from "@/lib/agentOptions";
import { AGENT_PROMPT_TEMPLATE } from "@/lib/promptTemplate";

export default function NewBusinessPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-bold">Nuevo negocio</h1>

      <form action={createBusiness} className="space-y-4">
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
            Ya está pre-llenado con una plantilla — reemplaza cada{" "}
            <span className="fl-mono text-ink">[texto entre corchetes]</span> con la info real del
            negocio (o bórralo si no aplica) antes de crear el negocio.
          </p>
          <textarea
            id="systemPrompt"
            name="systemPrompt"
            required
            rows={16}
            defaultValue={AGENT_PROMPT_TEMPLATE}
            className="fl-mono w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent"
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 font-semibold text-accent-ink transition hover:bg-accent-hover"
        >
          Crear negocio
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
