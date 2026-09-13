"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
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
    <details className="rounded-md border border-border bg-surface p-4">
      <summary className="cursor-pointer fl-mono text-xs tracking-wide text-ink-muted uppercase">
        Editar etapas del CRM
      </summary>

      <p className="mt-3 text-sm text-ink-muted">
        Estas son las columnas del tablero de este negocio. Puedes renombrarlas, agregar nuevas,
        borrarlas o cambiar su orden — cada negocio tiene las suyas propias.
      </p>

      <ul className="mt-4 space-y-2">
        {stages.map((stage, index) => (
          <li key={stage.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={isPending || index === 0}
              onClick={() => run(() => movePipelineStage(businessId, stage.id, "left"))}
              className="rounded border border-border px-2 py-1 text-xs text-ink-muted transition hover:border-border-strong disabled:opacity-30"
              title="Mover a la izquierda"
            >
              ←
            </button>
            <button
              type="button"
              disabled={isPending || index === stages.length - 1}
              onClick={() => run(() => movePipelineStage(businessId, stage.id, "right"))}
              className="rounded border border-border px-2 py-1 text-xs text-ink-muted transition hover:border-border-strong disabled:opacity-30"
              title="Mover a la derecha"
            >
              →
            </button>

            <input
              type="text"
              defaultValue={stage.name}
              disabled={isPending}
              onBlur={(e) => {
                const newName = e.target.value.trim();
                if (newName && newName !== stage.name) {
                  run(() => renamePipelineStage(businessId, stage.id, newName));
                } else {
                  e.target.value = stage.name;
                }
              }}
              className="w-full flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-ink outline-none focus:border-accent"
            />

            <button
              type="button"
              disabled={isPending || stages.length <= 1}
              onClick={() => {
                if (confirm(`¿Borrar la etapa "${stage.name}"? Sus conversaciones pasan a la primera etapa.`)) {
                  run(() => deletePipelineStage(businessId, stage.id));
                }
              }}
              title={stages.length <= 1 ? "Debe quedar al menos una etapa" : "Borrar etapa"}
              className="rounded border border-error/40 px-2 py-1 text-xs text-error transition hover:bg-error/10 disabled:opacity-30"
            >
              Borrar
            </button>
          </li>
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
