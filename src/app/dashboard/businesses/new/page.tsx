import { createBusiness } from "@/lib/actions";

export default function NewBusinessPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold">Nuevo negocio</h1>

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
          <label htmlFor="systemPrompt" className="text-sm font-medium">
            Instrucciones del agente de IA
          </label>
          <textarea
            id="systemPrompt"
            name="systemPrompt"
            required
            rows={6}
            placeholder="Eres el asistente de WhatsApp de [negocio]. Responde de forma breve y amable, ayuda a los clientes a..."
            className="w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20"
          />
        </div>

        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
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
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20"
      />
    </div>
  );
}
