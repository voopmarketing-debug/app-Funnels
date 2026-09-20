"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addPipelineStage,
  renamePipelineStage,
  deletePipelineStage,
  movePipelineStage,
} from "@/lib/actions";

export type PipelineStageData = { id: string; name: string; position: number };

type AddState = { addedCount: number };

export function PipelineManager({
  businessId,
  stages,
}: {
  businessId: string;
  stages: PipelineStageData[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const addFormRef = useRef<HTMLFormElement>(null);

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  // useActionState (rather than a plain function on the form's `action`)
  // guards against React re-invoking the handler twice in dev Strict Mode,
  // which was silently creating two identical stages per click.
  const [addState, addFormAction, isAddPending] = useActionState<AddState, FormData>(
    async (prevState, formData) => {
      await addPipelineStage(businessId, formData);
      router.refresh();
      return { addedCount: prevState.addedCount + 1 };
    },
    { addedCount: 0 },
  );

  useEffect(() => {
    if (!isAddPending) addFormRef.current?.reset();
  }, [isAddPending, addState.addedCount]);

  return (
    <details className="fl-card p-4">
      <summary className="cursor-pointer fl-mono text-xs tracking-wide text-ink-muted uppercase">
        Editar etapas del CRM
      </summary>

      <p className="mt-3 text-sm text-ink-muted">
        Estas son las columnas del tablero de este negocio. Puedes renombrarlas, agregar nuevas,
        borrarlas o cambiar su orden — cada negocio tiene las suyas propias.
      </p>

      <ul className="mt-4 space-y-2">
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            businessId={businessId}
            stage={stage}
            isFirst={index === 0}
            isLast={index === stages.length - 1}
            canDelete={stages.length > 1}
            movePending={isPending}
            onMove={(direction) => run(() => movePipelineStage(businessId, stage.id, direction))}
            onDelete={() => {
              if (confirm(`¿Borrar la etapa "${stage.name}"? Sus conversaciones pasan a la primera etapa.`)) {
                run(() => deletePipelineStage(businessId, stage.id));
              }
            }}
          />
        ))}
      </ul>

      <form ref={addFormRef} action={addFormAction} className="mt-4 flex items-center gap-2">
        <input
          type="text"
          name="name"
          required
          placeholder="Nombre de la nueva etapa"
          disabled={isAddPending}
          className="w-full flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={isAddPending}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isAddPending ? "..." : "+ Agregar"}
        </button>
      </form>
    </details>
  );
}

function StageRow({
  businessId,
  stage,
  isFirst,
  isLast,
  canDelete,
  movePending,
  onMove,
  onDelete,
}: {
  businessId: string;
  stage: PipelineStageData;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  movePending: boolean;
  onMove: (direction: "left" | "right") => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(stage.name);
  const [isSaving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);

  // Once a rename lands and the parent re-fetches, stage.name catches up to
  // what we already saved — this just keeps the field in sync if it ever
  // changes from elsewhere (e.g. another tab).
  useEffect(() => setValue(stage.name), [stage.name]);

  useEffect(() => {
    if (!saved) return;
    const timeout = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timeout);
  }, [saved]);

  const trimmed = value.trim();
  const isDirty = trimmed.length > 0 && trimmed !== stage.name;

  function save() {
    if (!isDirty) return;
    startSaving(async () => {
      await renamePipelineStage(businessId, stage.id, trimmed);
      router.refresh();
      setSaved(true);
    });
  }

  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        disabled={movePending || isFirst}
        onClick={() => onMove("left")}
        className="rounded border border-border px-2 py-1 text-xs text-ink-muted transition hover:border-border-strong disabled:opacity-30"
        title="Mover a la izquierda"
      >
        ←
      </button>
      <button
        type="button"
        disabled={movePending || isLast}
        onClick={() => onMove("right")}
        className="rounded border border-border px-2 py-1 text-xs text-ink-muted transition hover:border-border-strong disabled:opacity-30"
        title="Mover a la derecha"
      >
        →
      </button>

      <input
        type="text"
        value={value}
        disabled={isSaving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
        className="w-full flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-ink outline-none focus:border-accent"
      />

      {isDirty || isSaving ? (
        <button
          type="button"
          disabled={isSaving}
          onClick={save}
          className="flex-none rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isSaving ? "Guardando..." : "Guardar"}
        </button>
      ) : saved ? (
        <span className="fl-mono flex-none text-xs text-accent">✓ Guardado</span>
      ) : null}

      <button
        type="button"
        disabled={movePending || !canDelete}
        onClick={onDelete}
        title={!canDelete ? "Debe quedar al menos una etapa" : "Borrar etapa"}
        className="flex-none rounded border border-error/40 px-2 py-1 text-xs text-error transition hover:bg-error/10 disabled:opacity-30"
      >
        Borrar
      </button>
    </li>
  );
}
