"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createPipeline,
  renamePipeline,
  deletePipeline,
  addPipelineStage,
  renamePipelineStage,
  deletePipelineStage,
  movePipelineStage,
} from "@/lib/actions";

export type PipelineStageData = { id: string; name: string; position: number };
export type PipelineData = { id: string; name: string; isDefault: boolean; stages: PipelineStageData[] };

type AddState = { addedCount: number };

export function PipelineManager({ businessId, pipelines }: { businessId: string; pipelines: PipelineData[] }) {
  const router = useRouter();
  const [isCreating, startCreating] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);
  const createFormRef = useRef<HTMLFormElement>(null);

  function handleCreate(formData: FormData) {
    setCreateError(null);
    startCreating(async () => {
      try {
        await createPipeline(businessId, formData);
        createFormRef.current?.reset();
        router.refresh();
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : "No se pudo crear el embudo");
      }
    });
  }

  return (
    <details className="fl-card p-4">
      <summary className="cursor-pointer fl-mono text-xs tracking-wide text-ink-muted uppercase">
        Editar embudos y etapas del CRM ({pipelines.length})
      </summary>

      <p className="mt-3 text-sm text-ink-muted">
        Cada embudo es un tablero de leads aparte — crea uno por vendedor para que cada quien trabaje solo lo suyo,
        aunque todos compartan el mismo número de WhatsApp. Los leads nuevos siempre entran al embudo principal;
        desde ahí se mueven a mano al embudo de quien los va a atender.
      </p>

      <div className="mt-4 space-y-4">
        {pipelines.map((pipeline) => (
          <PipelineSection key={pipeline.id} businessId={businessId} pipeline={pipeline} canDelete={pipelines.length > 1} />
        ))}
      </div>

      <form ref={createFormRef} action={handleCreate} className="mt-5 flex items-center gap-2 border-t border-border pt-4">
        <input
          type="text"
          name="name"
          required
          placeholder='Nombre del nuevo embudo, ej: "Vendedor Juan"'
          disabled={isCreating}
          className="w-full flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={isCreating}
          className="flex-none rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isCreating ? "..." : "+ Nuevo embudo"}
        </button>
      </form>
      {createError && <p className="mt-1 text-xs text-error">{createError}</p>}
    </details>
  );
}

function PipelineSection({
  businessId,
  pipeline,
  canDelete,
}: {
  businessId: string;
  pipeline: PipelineData;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nameValue, setNameValue] = useState(pipeline.name);
  const [isSavingName, startSavingName] = useTransition();
  const [nameSaved, setNameSaved] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const addFormRef = useRef<HTMLFormElement>(null);

  const [addState, addFormAction, isAddPending] = useActionState<AddState, FormData>(
    async (prevState, formData) => {
      await addPipelineStage(businessId, pipeline.id, formData);
      router.refresh();
      return { addedCount: prevState.addedCount + 1 };
    },
    { addedCount: 0 },
  );

  useEffect(() => {
    if (!isAddPending) addFormRef.current?.reset();
  }, [isAddPending, addState.addedCount]);

  useEffect(() => setNameValue(pipeline.name), [pipeline.name]);

  useEffect(() => {
    if (!nameSaved) return;
    const timeout = setTimeout(() => setNameSaved(false), 2000);
    return () => clearTimeout(timeout);
  }, [nameSaved]);

  function run(action: () => Promise<void>) {
    startTransition(async () => {
      await action();
      router.refresh();
    });
  }

  const trimmedName = nameValue.trim();
  const nameDirty = trimmedName.length > 0 && trimmedName !== pipeline.name;

  function saveName() {
    if (!nameDirty) return;
    startSavingName(async () => {
      await renamePipeline(businessId, pipeline.id, trimmedName);
      router.refresh();
      setNameSaved(true);
    });
  }

  function handleDeletePipeline() {
    if (!confirm(`¿Borrar el embudo "${pipeline.name}"? Sus conversaciones pasan al embudo principal.`)) return;
    setDeleteError(null);
    startTransition(async () => {
      try {
        await deletePipeline(businessId, pipeline.id);
        router.refresh();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "No se pudo borrar el embudo");
      }
    });
  }

  return (
    <div className="rounded-lg border border-border-strong bg-background p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={nameValue}
          disabled={isSavingName}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveName();
            }
          }}
          className="w-full flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm font-semibold text-ink outline-none focus:border-accent"
        />
        {pipeline.isDefault && (
          <span className="fl-mono flex-none rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
            Principal
          </span>
        )}
        {nameDirty || isSavingName ? (
          <button
            type="button"
            disabled={isSavingName}
            onClick={saveName}
            className="flex-none rounded-md bg-accent px-3 py-1 text-xs font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
          >
            {isSavingName ? "Guardando..." : "Guardar"}
          </button>
        ) : nameSaved ? (
          <span className="fl-mono flex-none text-xs text-accent">✓ Guardado</span>
        ) : null}
        <button
          type="button"
          disabled={isPending || !canDelete || pipeline.isDefault}
          onClick={handleDeletePipeline}
          title={
            pipeline.isDefault
              ? "El embudo principal no se puede borrar"
              : !canDelete
                ? "Debe quedar al menos un embudo"
                : "Borrar embudo"
          }
          className="flex-none rounded border border-error/40 px-2 py-1 text-xs text-error transition hover:bg-error/10 disabled:opacity-30"
        >
          Borrar embudo
        </button>
      </div>
      {deleteError && <p className="mt-1 text-xs text-error">{deleteError}</p>}

      <ul className="mt-3 space-y-2">
        {pipeline.stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            businessId={businessId}
            stage={stage}
            isFirst={index === 0}
            isLast={index === pipeline.stages.length - 1}
            canDelete={pipeline.stages.length > 1}
            movePending={isPending}
            onMove={(direction) => run(() => movePipelineStage(businessId, pipeline.id, stage.id, direction))}
            onDelete={() => {
              if (confirm(`¿Borrar la etapa "${stage.name}"? Sus conversaciones pasan a la primera etapa de este embudo.`)) {
                run(() => deletePipelineStage(businessId, pipeline.id, stage.id));
              }
            }}
          />
        ))}
      </ul>

      <form ref={addFormRef} action={addFormAction} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          name="name"
          required
          placeholder="Nombre de la nueva etapa"
          disabled={isAddPending}
          className="w-full flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={isAddPending}
          className="flex-none rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {isAddPending ? "..." : "+ Etapa"}
        </button>
      </form>
    </div>
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
        className="w-full flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-accent"
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
