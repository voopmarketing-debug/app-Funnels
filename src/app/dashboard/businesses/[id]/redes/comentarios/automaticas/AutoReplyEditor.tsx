"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCommentAutoReply,
  runCommentAutoRepliesNow,
  saveCommentAutoReply,
  setCommentAutoReplyEnabled,
  type AutoReplyInput,
} from "@/lib/socialActions";
import { askConfirm } from "@/components/ConfirmHost";

export type RuleView = {
  id: string;
  name: string;
  keywords: string[];
  networks: string[];
  publicReplies: string[];
  privateMessage: string | null;
  enabled: boolean;
  replyCount: number;
  lastTriggeredLabel: string | null;
};

const NETWORK_LABEL: Record<string, string> = { facebook: "Facebook", instagram: "Instagram" };

const EXAMPLE: AutoReplyInput = {
  name: "Pide info",
  keywords: "info, precio, cuánto, valor",
  networks: ["facebook", "instagram"],
  publicReplies: ["¡Hola {nombre}! Te enviamos la información por mensaje privado 📩", "¡Claro {nombre}! Revisa tus mensajes, ya te escribimos 😊"],
  privateMessage: "¡Hola {nombre}! Gracias por comentar 🙌 Te cuento los precios y cómo agendar. ¿Para qué día te gustaría?",
};

const field =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none";

export function RuleForm({
  businessId,
  rule,
  hasIg,
  onDone,
}: {
  businessId: string;
  rule: RuleView | null;
  hasIg: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(rule?.name ?? "");
  const [keywords, setKeywords] = useState(rule?.keywords.join(", ") ?? "");
  const [networks, setNetworks] = useState<string[]>(rule?.networks ?? (hasIg ? ["facebook", "instagram"] : ["facebook"]));
  const [replies, setReplies] = useState<string[]>(rule?.publicReplies.length ? rule.publicReplies : [""]);
  const [privateMessage, setPrivateMessage] = useState(rule?.privateMessage ?? "");

  function useExample() {
    setName(EXAMPLE.name);
    setKeywords(EXAMPLE.keywords);
    setNetworks(hasIg ? EXAMPLE.networks : ["facebook"]);
    setReplies(EXAMPLE.publicReplies);
    setPrivateMessage(EXAMPLE.privateMessage);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await saveCommentAutoReply(businessId, rule?.id ?? null, { name, keywords, networks, publicReplies: replies, privateMessage });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.warning) window.alert(res.warning);
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {!rule && (
        <button type="button" onClick={useExample} className="text-sm font-semibold text-accent hover:underline">
          ✨ Llenar con un ejemplo
        </button>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="rule-keywords" className="block text-sm font-semibold text-ink">
            Palabras clave
          </label>
          <input id="rule-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="info, precio, quiero" className={field} />
          <p className="text-xs text-ink-muted">Sepáralas con comas. No importan mayúsculas ni tildes: «Cuánto» y «cuanto» cuentan igual.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rule-name" className="block text-sm font-semibold text-ink">
            Nombre de la regla <span className="font-normal text-ink-muted">(opcional)</span>
          </label>
          <input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ej. Promo blanqueamiento" className={field} />
        </div>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-sm font-semibold text-ink">Dónde responde</legend>
        <div className="flex flex-wrap gap-2">
          {(["facebook", "instagram"] as const).map((n) => {
            const on = networks.includes(n);
            const disabled = n === "instagram" && !hasIg;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                title={disabled ? "Tu página no tiene una cuenta de Instagram conectada" : undefined}
                onClick={() => setNetworks(on ? networks.filter((x) => x !== n) : [...networks, n])}
                className="fl-chip rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
              >
                {on ? "✓ " : ""}
                {NETWORK_LABEL[n]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-ink">Respuesta pública en el comentario</p>
        <p className="text-xs text-ink-muted">
          Si escribes varias, la plataforma elige una al azar para no repetir siempre lo mismo. Usa <code className="rounded bg-surface-2 px-1">{"{nombre}"}</code> para
          saludar a la persona.
        </p>
        {replies.map((r, i) => (
          <div key={i} className="flex gap-2">
            <label htmlFor={`rule-reply-${i}`} className="sr-only">
              Respuesta {i + 1}
            </label>
            <textarea
              id={`rule-reply-${i}`}
              value={r}
              onChange={(e) => setReplies(replies.map((x, j) => (j === i ? e.target.value : x)))}
              rows={2}
              maxLength={1000}
              placeholder="¡Hola {nombre}! Te escribimos por privado 📩"
              className={field}
            />
            {replies.length > 1 && (
              <button
                type="button"
                onClick={() => setReplies(replies.filter((_, j) => j !== i))}
                aria-label={`Quitar respuesta ${i + 1}`}
                className="h-9 flex-none rounded-lg px-2 text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {replies.length < 5 && (
          <button type="button" onClick={() => setReplies([...replies, ""])} className="text-xs font-semibold text-accent hover:underline">
            + Otra versión
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="rule-private" className="block text-sm font-semibold text-ink">
          Mensaje privado <span className="font-normal text-ink-muted">(opcional)</span>
        </label>
        <textarea
          id="rule-private"
          value={privateMessage}
          onChange={(e) => setPrivateMessage(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="¡Hola {nombre}! Gracias por comentar. Te cuento…"
          className={field}
        />
        <p className="text-xs text-ink-muted">Le llega por Messenger o Instagram Direct. Lo que conteste aparece en Redes → Mensajes para que tu equipo siga la conversación.</p>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink">
          Cancelar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Guardando…" : rule ? "Guardar cambios" : "Crear regla"}
        </button>
      </div>
    </div>
  );
}

export function AutoReplyManager({ businessId, rules, hasIg, canEdit }: { businessId: string; rules: RuleView[]; hasIg: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(rules.length === 0 && canEdit ? "new" : null);
  const [pending, start] = useTransition();
  const [checked, setChecked] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">Tus reglas</h2>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {rules.some((r) => r.enabled) && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await runCommentAutoRepliesNow(businessId);
                    setChecked(res.answered ? `Se respondieron ${res.answered} comentario${res.answered === 1 ? "" : "s"}.` : "No hay comentarios nuevos con esas palabras.");
                    router.refresh();
                  })
                }
                className="rounded-lg border border-border-strong px-3 py-2 text-sm font-semibold text-ink transition hover:border-accent disabled:opacity-60"
              >
                {pending ? "Revisando…" : "↻ Revisar comentarios ahora"}
              </button>
            )}
            {editing !== "new" && (
              <button type="button" onClick={() => setEditing("new")} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover">
                + Nueva regla
              </button>
            )}
          </div>
        )}
      </div>
      {checked && <p className="text-sm text-ink-muted">{checked}</p>}

      {editing === "new" && (
        <section className="fl-card-hero space-y-1 p-5">
          <h3 className="text-base font-semibold text-ink">Nueva respuesta automática</h3>
          <RuleForm businessId={businessId} rule={null} hasIg={hasIg} onDone={() => setEditing(null)} />
        </section>
      )}

      {rules.length === 0 && editing !== "new" && (
        <p className="fl-card p-6 text-center text-sm text-ink-muted">Aún no tienes reglas. Crea la primera y la plataforma empezará a responder sola.</p>
      )}

      <ul className="space-y-3">
        {rules.map((r) => (
          <li key={r.id} className={`fl-card space-y-3 p-4 ${r.enabled ? "" : "opacity-70"}`}>
            {editing === r.id ? (
              <RuleForm businessId={businessId} rule={r} hasIg={hasIg} onDone={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <p className="font-semibold text-ink">
                      {r.name}{" "}
                      <span className="text-xs font-normal text-ink-muted">· {r.networks.map((n) => NETWORK_LABEL[n]).join(" y ")}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {r.keywords.map((k) => (
                        <span key={k} className="rounded-md bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                  {canEdit && (
                    <div role="radiogroup" aria-label={`Estado de ${r.name}`} className="fl-seg flex-none">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={r.enabled}
                        onClick={() => start(async () => { await setCommentAutoReplyEnabled(businessId, r.id, true); router.refresh(); })}
                        className="fl-seg-item px-3 py-1 text-xs"
                      >
                        Activa
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={!r.enabled}
                        onClick={() => start(async () => { await setCommentAutoReplyEnabled(businessId, r.id, false); router.refresh(); })}
                        className="fl-seg-item px-3 py-1 text-xs"
                      >
                        Pausada
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-surface-2/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                      💬 Responde en público{r.publicReplies.length > 1 ? ` · ${r.publicReplies.length} versiones` : ""}
                    </p>
                    <p className="mt-1 text-sm text-ink">{r.publicReplies[0] ?? <span className="text-ink-muted">No responde en público</span>}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-2/50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">✉️ Mensaje privado</p>
                    <p className="mt-1 text-sm text-ink">{r.privateMessage ?? <span className="text-ink-muted">No envía mensaje privado</span>}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-ink-muted">
                    {r.replyCount > 0 ? `Respondió ${r.replyCount} comentario${r.replyCount === 1 ? "" : "s"}${r.lastTriggeredLabel ? ` · último ${r.lastTriggeredLabel}` : ""}` : "Todavía no ha respondido ningún comentario"}
                  </p>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setEditing(r.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-2 hover:text-ink">
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!(await askConfirm({ message: `¿Borrar la regla «${r.name}»?`, confirmLabel: "Sí, borrar", tone: "danger" }))) return;
                          start(async () => {
                            await deleteCommentAutoReply(businessId, r.id);
                            router.refresh();
                          });
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-surface-2 hover:text-error"
                      >
                        Borrar
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
