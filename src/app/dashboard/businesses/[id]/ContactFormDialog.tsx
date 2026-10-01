"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContact, updateContactInfo } from "@/lib/actions";
import { formatPhone } from "@/lib/contactDisplay";

type Props =
  | {
      mode: "create";
      businessId: string;
      stages: { id: string; name: string }[];
      triggerClassName?: string;
    }
  | {
      mode: "edit";
      businessId: string;
      conversationId: string;
      customerPhone: string;
      customerName: string | null;
      customerEmail: string | null;
      triggerClassName?: string;
    };

// "＋ Contacto" in the CRM toolbar (create) and "✎ Editar" in the chat
// header on phones (edit — on desktop the lead panel edits inline). One
// dialog for both so the fields and validation stay identical.
export function ContactFormDialog(props: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFormKey((k) => k + 1);
          dialogRef.current?.showModal();
        }}
        className={
          props.triggerClassName ??
          "rounded-md border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent"
        }
      >
        {props.mode === "create" ? "＋ Contacto" : "✎ Editar"}
      </button>
      <dialog ref={dialogRef} className="fl-card-hero w-[calc(100%-2rem)] max-w-md p-0">
        <ContactForm key={formKey} {...props} onClose={() => dialogRef.current?.close()} />
      </dialog>
    </>
  );
}

function ContactForm(props: Props & { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState(props.mode === "edit" ? (props.customerName ?? "") : "");
  const [email, setEmail] = useState(props.mode === "edit" ? (props.customerEmail ?? "") : "");
  const [stageId, setStageId] = useState(props.mode === "create" ? (props.stages[0]?.id ?? "") : "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        if (props.mode === "create") {
          const result = await createContact(props.businessId, { phone, name, email, stageId: stageId || null });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          props.onClose();
          router.push(`/dashboard/businesses/${props.businessId}/crm?tab=chat&conv=${result.conversationId}`);
        } else {
          await updateContactInfo(props.businessId, props.conversationId, { name, email });
          props.onClose();
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar el contacto");
      }
    });
  }

  const inputClass =
    "w-full rounded-md border border-border bg-background px-3 py-2 text-base text-ink outline-none focus:border-accent md:text-sm";

  return (
    <form onSubmit={submit} className="space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold text-ink">{props.mode === "create" ? "Agregar contacto" : "Editar contacto"}</h2>
        {props.mode === "edit" && <p className="fl-mono mt-1 text-xs text-ink-muted">{formatPhone(props.customerPhone)}</p>}
      </div>

      {props.mode === "create" && (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-muted">WhatsApp *</span>
          <input
            type="tel"
            required
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+57 300 123 4567"
            className={inputClass}
          />
          <span className="block text-[13px] text-ink-faint">Sin indicativo se asume Colombia (+57).</span>
        </label>
      )}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink-muted">Nombre</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="Ej. María López"
          autoFocus={props.mode === "edit"}
          className={inputClass}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink-muted">Correo</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          placeholder="Ej. maria@correo.com"
          className={inputClass}
        />
      </label>

      {props.mode === "create" && props.stages.length > 0 && (
        <label className="block space-y-1">
          <span className="text-xs font-medium text-ink-muted">Etapa</span>
          <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={inputClass}>
            {props.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="text-xs font-medium text-error">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={props.onClose}
          className="rounded-md border border-border px-4 py-2 text-sm text-ink-muted transition hover:text-ink"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isPending ? "Guardando..." : props.mode === "create" ? "Agregar" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
