"use client";

import { useRef, useState, useTransition } from "react";
import { deleteMessageTemplate, refreshTemplateStatus } from "@/lib/actions";
import { askConfirm } from "@/components/ConfirmHost";
import type { TemplateButton } from "@/lib/templateButtons";
import { NewTemplateForm, TemplateMessagePreview } from "./TemplateForm";

type Template = {
  id: string;
  name: string;
  language: string;
  category: string;
  bodyText: string;
  headerImageUrl: string | null;
  buttons: TemplateButton[];
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: Date;
};

const STATUS_STYLE: Record<Template["status"], string> = {
  PENDING: "bg-[#fab219]/15 text-[#fab219]",
  APPROVED: "bg-accent/15 text-accent",
  REJECTED: "bg-error/15 text-error",
};

const STATUS_HINT: Record<Template["status"], string> = {
  PENDING: "Meta la está revisando: suele tardar entre unos minutos y 1 o 2 días. Pulsa «Revisar estado» para ver si ya cambió.",
  APPROVED: "Aprobada: ya puedes usarla en una difusión.",
  REJECTED: "Meta no la aprobó. Crea otra corrigiendo el motivo de abajo; esta se puede eliminar.",
};

const STATUS_LABEL: Record<Template["status"], string> = {
  PENDING: "En revisión",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

export function TemplateManager({
  businessId,
  templates,
  hasWabaId,
  canDelete,
}: {
  canDelete: boolean;
  businessId: string;
  templates: Template[];
  hasWabaId: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-4">
      {!hasWabaId && (
        <div className="rounded-md border-2 border-[#fab219]/50 bg-surface p-4 text-sm text-ink">
          Antes de crear plantillas hay que <strong>conectar tu WhatsApp</strong> (o completar su <strong>WABA ID</strong>): sin eso Meta no deja crearlas. Ve a la página del negocio y abre la tarjeta «WhatsApp Business».
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setFormKey((k) => k + 1);
          dialogRef.current?.showModal();
        }}
        disabled={!hasWabaId}
        className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50"
      >
        + Nueva plantilla
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        className="fl-card-hero max-h-[90vh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto p-0"
      >
        <NewTemplateForm key={formKey} businessId={businessId} onClose={() => dialogRef.current?.close()} />
      </dialog>

      <div className="space-y-3">
        {templates.length === 0 && (
          <div className="fl-card space-y-1 p-6 text-center">
            <p className="text-sm font-semibold text-ink">Todavía no tienes plantillas</p>
            <p className="mx-auto max-w-md text-sm text-ink-muted">
              Crea la primera con «+ Nueva plantilla»: puedes partir de un ejemplo (promoción, recordatorio de cita…) y cambiarle lo que quieras.
            </p>
          </div>
        )}
        {templates.map((t) => (
          <TemplateCard key={t.id} businessId={businessId} template={t} canDelete={canDelete} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ businessId, template, canDelete }: { businessId: string; template: Template; canDelete: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function remove() {
    if (!(await askConfirm({ title: `¿Eliminar la plantilla "${template.name}"?`, message: "También se borra en Meta y ya no podrás usarla en difusiones. Si la vuelves a necesitar, tendrás que crearla y esperar la aprobación de nuevo.", confirmLabel: "Sí, eliminar", tone: "danger" }))) return;
    setDeleteError(null);
    startDelete(async () => {
      const res = await deleteMessageTemplate(businessId, template.id);
      if (!res.ok) setDeleteError(res.error);
    });
  }

  return (
    <div className="fl-card space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="fl-mono text-sm font-semibold text-ink">{template.name}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${STATUS_STYLE[template.status]}`}>
          {STATUS_LABEL[template.status]}
        </span>
        <span className="fl-mono text-[12px] uppercase tracking-wide text-ink-faint">
          {template.category} · {template.language}
        </span>
        {template.status === "PENDING" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => refreshTemplateStatus(businessId, template.id))}
            className="ml-auto text-xs font-medium text-accent hover:underline disabled:opacity-60"
          >
            {isPending ? "Consultando..." : "↻ Revisar estado"}
          </button>
        )}
        {canDelete && (
        <button
          type="button"
          onClick={remove}
          disabled={isDeleting}
          aria-label={`Eliminar plantilla ${template.name}`}
          title="Eliminar plantilla"
          className={`${template.status === "PENDING" ? "" : "ml-auto "}flex h-8 w-8 items-center justify-center rounded-md text-ink-faint transition hover:bg-error/10 hover:text-error disabled:opacity-50`}
        >
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
          </svg>
        </button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_280px] sm:items-start">
        <div className="space-y-2 text-sm text-ink-muted">
          <p>{STATUS_HINT[template.status]}</p>
          {template.buttons.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {template.buttons.map((btn, i) => (
                <li key={i} className="rounded-full border border-border-strong px-2.5 py-0.5 text-xs font-medium text-ink" title={btn.type === "URL" ? btn.url : btn.type === "PHONE_NUMBER" ? btn.phone : "Respuesta rápida"}>
                  {btn.type === "QUICK_REPLY" ? "↩ Respuesta rápida" : btn.type === "URL" ? "🔗 Enlace" : "📞 Llamada"}: {btn.text}
                </li>
              ))}
            </ul>
          )}
        </div>
        <TemplateMessagePreview headerImageUrl={template.headerImageUrl} bodyText={template.bodyText} buttons={template.buttons} />
      </div>
      {deleteError && <p className="text-sm text-error">⚠ {deleteError}</p>}
      {template.status === "REJECTED" && template.rejectionReason && (
        <p className="text-xs text-error">Motivo de Meta: {template.rejectionReason}</p>
      )}
    </div>
  );
}
