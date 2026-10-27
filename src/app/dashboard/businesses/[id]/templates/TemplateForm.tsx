"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { createMessageTemplate } from "@/lib/actions";
import { MAX_BUTTON_TEXT, MAX_TEMPLATE_BUTTONS, normalizeButtons, type TemplateButton } from "@/lib/templateButtons";

const LANGUAGE_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "es_CO", label: "Español (Colombia)" },
  { value: "es_MX", label: "Español (México)" },
  { value: "en_US", label: "Inglés (EE. UU.)" },
];

const MAX_BODY = 1024;

type Category = "MARKETING" | "UTILITY";
type DraftType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
type DraftButton = { key: number; type: DraftType; text: string; url: string; phone: string };

const BUTTON_KINDS: { type: DraftType; icon: string; title: string; help: string; example: string }[] = [
  { type: "QUICK_REPLY", icon: "↩", title: "Respuesta rápida", help: "El cliente la toca y esa frase te llega al chat como su respuesta. Tu agente le contesta.", example: "Sí, me interesa" },
  { type: "URL", icon: "🔗", title: "Abrir un enlace", help: "Lleva a tu página, tu agenda o tu catálogo.", example: "Ver oferta" },
  { type: "PHONE_NUMBER", icon: "📞", title: "Llamar", help: "Abre la llamada a un número que tú elijas.", example: "Llamar ahora" },
];

// Starting points: a message already written, with its buttons, so nobody has
// to face an empty box. Everything can be edited.
const EXAMPLES: { id: string; title: string; hint: string; name: string; category: Category; body: string; buttons: Omit<DraftButton, "key">[] }[] = [
  {
    id: "promo",
    title: "Promoción",
    hint: "Para contarle una oferta a tus clientes",
    name: "promo_semana",
    category: "MARKETING",
    body: "Hola 👋 Esta semana tenemos una promoción especial para ti. ¿Quieres que te cuente los detalles?",
    buttons: [
      { type: "QUICK_REPLY", text: "Sí, cuéntame", url: "", phone: "" },
      { type: "QUICK_REPLY", text: "Ahora no", url: "", phone: "" },
    ],
  },
  {
    id: "recordatorio",
    title: "Recordatorio de cita",
    hint: "Para confirmar que vienen",
    name: "recordatorio_cita",
    category: "UTILITY",
    body: "Hola, te recordamos tu cita de mañana. ¿Nos confirmas que vas a asistir?",
    buttons: [
      { type: "QUICK_REPLY", text: "Confirmo", url: "", phone: "" },
      { type: "QUICK_REPLY", text: "Necesito reagendar", url: "", phone: "" },
    ],
  },
  {
    id: "reactivar",
    title: "Volver a hablarle a un cliente",
    hint: "Para clientes que no te escriben hace tiempo",
    name: "reactivar_cliente",
    category: "MARKETING",
    body: "Hola, hace tiempo no hablamos y queríamos saber cómo estás. Tenemos novedades que pueden interesarte.",
    buttons: [
      { type: "QUICK_REPLY", text: "Quiero saber más", url: "", phone: "" },
      { type: "URL", text: "Ver novedades", url: "", phone: "" },
    ],
  },
];

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)+/g, "");

const suggestName = (body: string) => slugify(body.split(/\s+/).slice(0, 4).join(" ")).slice(0, 40);

/** Mimics a WhatsApp message bubble (header image, body, buttons) so the person sees what the client will receive. Close enough to catch mistakes before sending to Meta. */
export function TemplateMessagePreview({ headerImageUrl, bodyText, buttons, sticky = false }: { headerImageUrl: string | null; bodyText: string; buttons: TemplateButton[]; sticky?: boolean }) {
  const quick = buttons.filter((b) => b.type === "QUICK_REPLY");
  const cta = buttons.filter((b) => b.type !== "QUICK_REPLY");
  return (
    <div className={sticky ? "space-y-2 lg:sticky lg:top-16" : "space-y-2"}>
      <div className="rounded-xl p-4" style={{ background: "#0b141a" }}>
        <div className="ml-auto max-w-[260px] overflow-hidden rounded-lg rounded-tr-sm shadow-sm" style={{ background: "#005c4b" }}>
          {headerImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={headerImageUrl} alt="" className="h-28 w-full object-cover" />
          )}
          <div className="px-2.5 pt-2 pb-1.5">
            <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-white">{bodyText.trim() || "Escribe el mensaje para verlo aquí…"}</p>
            <p className="mt-1 text-right text-[12px] text-white/60">10:42 a. m. ✓✓</p>
          </div>
          {cta.length > 0 && (
            <div className="border-t border-white/15">
              {cta.map((b, i) => (
                <div key={i} className={`px-2 py-2 text-center text-[13px] font-medium ${i > 0 ? "border-t border-white/15" : ""}`} style={{ color: "#53bdeb" }}>
                  {b.type === "PHONE_NUMBER" ? "📞" : "🔗"} {b.text}
                </div>
              ))}
            </div>
          )}
        </div>
        {quick.length > 0 && (
          <div className="ml-auto mt-1.5 flex max-w-[260px] flex-col gap-1">
            {quick.map((b, i) => (
              <div key={i} className="rounded-lg px-2 py-2 text-center text-[13px] font-medium shadow-sm" style={{ background: "#202c33", color: "#53bdeb" }}>
                ↩ {b.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type FormState = { error: string | null; done: boolean; renamed?: { from: string; to: string } };
const INITIAL_STATE: FormState = { error: null, done: false };

const fieldLabel = "text-sm font-semibold text-ink";
const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-ink outline-none focus:border-accent";

function SectionTitle({ n, title, hint, optional }: { n: number; title: string; hint?: string; optional?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-ink" aria-hidden="true">
        {n}
      </span>
      <div>
        <h3 className="text-[15px] font-semibold text-ink">
          {title} {optional && <span className="text-xs font-normal text-ink-faint">(opcional)</span>}
        </h3>
        {hint && <p className="text-[13px] text-ink-muted">{hint}</p>}
      </div>
    </div>
  );
}

export function NewTemplateForm({ businessId, onClose }: { businessId: string; onClose: () => void }) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(async (_prev, formData) => {
    try {
      const res = await createMessageTemplate(businessId, formData);
      if (!res.ok) return { error: res.error, done: false };
      return { error: null, done: true, renamed: res.renamedFrom ? { from: res.renamedFrom, to: res.name } : undefined };
    } catch {
      return { error: "No se pudo crear la plantilla. Recarga la página e inténtalo de nuevo.", done: false };
    }
  }, INITIAL_STATE);

  const [category, setCategory] = useState<Category>("MARKETING");
  const [language, setLanguage] = useState("es");
  const [bodyText, setBodyText] = useState("");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [buttons, setButtons] = useState<DraftButton[]>([]);
  const [adding, setAdding] = useState(false);
  const [headerImagePreviewUrl, setHeaderImagePreviewUrl] = useState<string | null>(null);
  const [headerImageName, setHeaderImageName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const keySeq = useRef(0);

  useEffect(() => {
    return () => {
      if (headerImagePreviewUrl) URL.revokeObjectURL(headerImagePreviewUrl);
    };
  }, [headerImagePreviewUrl]);

  const checked = useMemo(() => normalizeButtons(buttons), [buttons]);
  const previewButtons: TemplateButton[] = useMemo(() => {
    // Live preview: whatever has text, in the order Meta will use.
    const shown = buttons.filter((b) => b.text.trim());
    const order = { QUICK_REPLY: 0, URL: 1, PHONE_NUMBER: 2 } as const;
    return [...shown]
      .sort((a, b) => order[a.type] - order[b.type])
      .map((b) => (b.type === "QUICK_REPLY" ? { type: "QUICK_REPLY", text: b.text.trim() } : b.type === "URL" ? { type: "URL", text: b.text.trim(), url: b.url } : { type: "PHONE_NUMBER", text: b.text.trim(), phone: b.phone }));
  }, [buttons]);

  const finalName = slugify(name);
  const nameOk = finalName.length > 0;
  const bodyOk = bodyText.trim().length > 0 && bodyText.length <= MAX_BODY;
  const buttonsOk = checked.ok;
  const canSend = nameOk && bodyOk && buttonsOk && !isPending;

  function changeBody(value: string) {
    setBodyText(value);
    if (!nameTouched) setName(suggestName(value));
  }

  function addButton(type: DraftType) {
    setButtons((prev) => (prev.length >= MAX_TEMPLATE_BUTTONS ? prev : [...prev, { key: ++keySeq.current, type, text: "", url: "", phone: "" }]));
    setAdding(false);
  }

  function patchButton(key: number, patch: Partial<DraftButton>) {
    setButtons((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));
  }

  function applyExample(id: string) {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    setCategory(ex.category);
    setBodyText(ex.body);
    setName(ex.name);
    setNameTouched(true);
    setButtons(ex.buttons.map((b) => ({ ...b, key: ++keySeq.current })));
  }

  // What each kind may still be added: at most 2 links and 1 call, 3 buttons in all.
  const urlCount = buttons.filter((b) => b.type === "URL").length;
  const phoneCount = buttons.filter((b) => b.type === "PHONE_NUMBER").length;
  const canAdd = (type: DraftType) => buttons.length < MAX_TEMPLATE_BUTTONS && (type !== "URL" || urlCount < 2) && (type !== "PHONE_NUMBER" || phoneCount < 1);

  if (state.done) {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent/15 text-lg text-accent">✓</span>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-ink">Plantilla enviada a revisión</h2>
            <p className="text-sm text-ink-muted">
              Meta la revisa y la aprueba o la rechaza. Suele tardar entre unos minutos y 1 o 2 días. Cuando esté aprobada podrás usarla en una difusión. En su tarjeta, pulsa «↻ Revisar estado» para ver si ya cambió.
            </p>
            {state.renamed && (
              <p className="text-sm text-ink-muted">
                Meta todavía tiene reservado el nombre <span className="font-semibold text-ink">{state.renamed.from}</span> por una plantilla que borraste, así que la creamos como{" "}
                <span className="font-semibold text-ink">{state.renamed.to}</span>.
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover">
            Listo
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6 p-6">
      <input type="hidden" name="name" value={finalName} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="bodyText" value={bodyText} />
      <input type="hidden" name="buttonsJson" value={JSON.stringify(buttons.map(({ type, text, url, phone }) => ({ type, text, url, phone })))} />

      <div className="sticky top-0 z-10 -mx-6 -mt-6 flex items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3">
        <h2 className="text-lg font-bold text-ink">Nueva plantilla de mensaje</h2>
        <button type="button" onClick={onClose} aria-label="Cerrar" className="flex-none rounded-md p-1 text-ink-muted transition hover:bg-background hover:text-ink">
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface-2/50 p-3 text-[13px] text-ink-muted">
        <p className="font-semibold text-ink">¿Para qué sirve una plantilla?</p>
        <p className="mt-0.5">
          Es un mensaje que Meta aprueba una sola vez y que luego puedes mandar a muchos clientes, incluso a los que no te escriben hace más de 24 horas. El mismo texto le llega a todos.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink">¿Empiezas de cero? Parte de un ejemplo:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex.id} type="button" onClick={() => applyExample(ex.id)} title={ex.hint} className="rounded-full border border-border-strong px-3 py-1 text-xs font-semibold text-ink transition hover:border-accent hover:text-accent">
              {ex.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-7">
          <section className="space-y-3">
            <SectionTitle n={1} title="¿Para qué es este mensaje?" hint="Meta lo clasifica así y puede cobrar distinto cada tipo." />
            <div role="radiogroup" aria-label="Tipo de mensaje" className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { value: "MARKETING", title: "Marketing", text: "Ofertas, promociones, novedades, volver a hablarle a un cliente." },
                  { value: "UTILITY", title: "Utilidad", text: "Recordatorios, confirmaciones y avisos de algo que el cliente ya pidió." },
                ] as const
              ).map((c) => {
                const on = category === c.value;
                return (
                  <button key={c.value} type="button" role="radio" aria-checked={on} onClick={() => setCategory(c.value)} className={`rounded-xl border p-3 text-left transition ${on ? "border-accent bg-accent/10" : "border-border hover:border-border-strong"}`}>
                    <span className="block text-sm font-semibold text-ink">{c.title}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{c.text}</span>
                  </button>
                );
              })}
            </div>
            <div className="max-w-xs space-y-1">
              <label htmlFor="tpl-language" className={fieldLabel}>
                Idioma del mensaje
              </label>
              <select id="tpl-language" value={language} onChange={(e) => setLanguage(e.target.value)} className={inputClass}>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle n={2} title="Escribe el mensaje" hint="Habla como le hablarías a un cliente. Meta rechaza textos confusos, con muchas mayúsculas o que prometen de más." />
            <div className="space-y-1">
              <textarea
                id="tpl-body"
                value={bodyText}
                onChange={(e) => changeBody(e.target.value)}
                rows={5}
                maxLength={MAX_BODY}
                aria-label="Texto del mensaje"
                placeholder="Hola 👋 Esta semana tenemos una promoción especial para ti…"
                className={`${inputClass} resize-none`}
              />
              <div className="flex items-center justify-between text-xs text-ink-faint">
                <span>Para resaltar: *negrita* y _cursiva_. Por ahora el texto es fijo, sin variables.</span>
                <span className="fl-mono tabular-nums">
                  {bodyText.length}/{MAX_BODY}
                </span>
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="tpl-name" className={fieldLabel}>
                Nombre para ti <span className="text-xs font-normal text-ink-faint">(solo lo ves tú)</span>
              </label>
              <input
                id="tpl-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameTouched(true);
                }}
                placeholder="promo_semana"
                className={inputClass}
                autoComplete="off"
              />
              <p className="text-xs text-ink-faint">
                {nameOk ? (
                  <>
                    Se guardará como <span className="fl-mono font-semibold text-ink">{finalName}</span> (Meta solo admite minúsculas, números y guiones bajos).
                  </>
                ) : (
                  "Se completa solo cuando escribes el mensaje. Puedes cambiarlo."
                )}
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle n={3} title="Imagen de arriba" optional hint="Aparece sobre el mensaje. JPG o PNG." />
            {headerImagePreviewUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={headerImagePreviewUrl} alt="" className="h-16 w-24 rounded-lg object-cover" />
                <p className="min-w-0 flex-1 truncate text-sm text-ink">{headerImageName || "Imagen elegida"}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (fileRef.current) fileRef.current.value = "";
                    setHeaderImagePreviewUrl(null);
                    setHeaderImageName("");
                  }}
                  className="rounded-lg border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink-muted transition hover:text-error"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <label htmlFor="headerImage" className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border px-4 py-5 text-sm text-ink-muted transition hover:border-accent hover:text-ink">
                📷 Elegir una imagen
              </label>
            )}
            <input
              ref={fileRef}
              id="headerImage"
              name="headerImage"
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setHeaderImageName(file?.name ?? "");
                setHeaderImagePreviewUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return file ? URL.createObjectURL(file) : null;
                });
              }}
            />
          </section>

          <section className="space-y-3">
            <SectionTitle n={4} title="Botones" optional hint={`Hasta ${MAX_TEMPLATE_BUTTONS}. Mezcla respuestas rápidas y botones de acción como quieras.`} />

            {buttons.length === 0 && <p className="rounded-xl border border-dashed border-border px-3 py-3 text-[13px] text-ink-muted">Sin botones. El cliente solo verá el mensaje. Agrega uno si quieres que te responda con un toque o que abra un enlace.</p>}

            <ul className="space-y-2">
              {buttons.map((b, i) => {
                const kind = BUTTON_KINDS.find((k) => k.type === b.type)!;
                return (
                  <li key={b.key} className="space-y-2 rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-md bg-accent/15 text-sm text-accent" aria-hidden="true">
                        {kind.icon}
                      </span>
                      <p className="min-w-0 flex-1 text-sm font-semibold text-ink">
                        Botón {i + 1}: {kind.title}
                      </p>
                      <button type="button" onClick={() => setButtons((prev) => prev.filter((x) => x.key !== b.key))} aria-label={`Quitar el botón ${i + 1}`} className="rounded-md px-2 py-1 text-xs font-semibold text-ink-muted transition hover:bg-error/10 hover:text-error">
                        Quitar
                      </button>
                    </div>
                    <div className={`grid gap-2 ${b.type === "QUICK_REPLY" ? "" : "sm:grid-cols-2"}`}>
                      <div className="space-y-1">
                        <label htmlFor={`btn-text-${b.key}`} className="text-xs font-medium text-ink-muted">
                          {b.type === "QUICK_REPLY" ? "Lo que dirá el botón (y lo que te llegará)" : "Texto del botón"}
                        </label>
                        <input id={`btn-text-${b.key}`} value={b.text} maxLength={MAX_BUTTON_TEXT} onChange={(e) => patchButton(b.key, { text: e.target.value })} placeholder={kind.example} className={`${inputClass} text-sm`} />
                        <p className="text-right text-[11px] tabular-nums text-ink-faint">
                          {b.text.length}/{MAX_BUTTON_TEXT}
                        </p>
                      </div>
                      {b.type === "URL" && (
                        <div className="space-y-1">
                          <label htmlFor={`btn-url-${b.key}`} className="text-xs font-medium text-ink-muted">
                            Enlace que abre
                          </label>
                          <input id={`btn-url-${b.key}`} type="url" value={b.url} onChange={(e) => patchButton(b.key, { url: e.target.value })} placeholder="https://tu-sitio.com/oferta" className={`${inputClass} text-sm`} />
                        </div>
                      )}
                      {b.type === "PHONE_NUMBER" && (
                        <div className="space-y-1">
                          <label htmlFor={`btn-phone-${b.key}`} className="text-xs font-medium text-ink-muted">
                            Teléfono (con código de país)
                          </label>
                          <input id={`btn-phone-${b.key}`} type="tel" value={b.phone} onChange={(e) => patchButton(b.key, { phone: e.target.value })} placeholder="+57 300 123 4567" className={`${inputClass} text-sm`} />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {buttons.length < MAX_TEMPLATE_BUTTONS && (
              <div className="space-y-2">
                {!adding ? (
                  <button type="button" onClick={() => setAdding(true)} className="rounded-lg border border-accent/60 bg-accent/10 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-accent/20">
                    + Agregar un botón
                  </button>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Tipo de botón">
                    {BUTTON_KINDS.map((k) => {
                      const allowed = canAdd(k.type);
                      return (
                        <button key={k.type} type="button" disabled={!allowed} onClick={() => addButton(k.type)} className="rounded-xl border border-border p-3 text-left transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-45">
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                            <span aria-hidden="true">{k.icon}</span> {k.title}
                          </span>
                          <span className="mt-1 block text-[12px] leading-snug text-ink-muted">{allowed ? k.help : k.type === "URL" ? "Ya pusiste 2 enlaces." : "Ya hay un botón de llamada."}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {!checked.ok && buttons.length > 0 && (
              <p role="status" className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-[13px] text-ink">
                {checked.error}
              </p>
            )}
            {buttons.some((b) => b.type === "QUICK_REPLY") && buttons.some((b) => b.type !== "QUICK_REPLY") && (
              <p className="text-[12px] text-ink-faint">WhatsApp pone las respuestas rápidas primero y los botones de enlace o llamada después; lo ordenamos por ti.</p>
            )}
          </section>
        </div>

        <aside className="space-y-3">
          <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Así se verá en WhatsApp</p>
          <TemplateMessagePreview sticky headerImageUrl={headerImagePreviewUrl} bodyText={bodyText} buttons={previewButtons} />
          <ul className="space-y-1.5 rounded-xl border border-border p-3 text-[13px]" aria-label="Antes de enviar">
            {[
              { ok: bodyOk, label: "Escribiste el mensaje" },
              { ok: nameOk, label: "Tiene un nombre" },
              { ok: buttonsOk, label: buttons.length === 0 ? "Sin botones (está bien)" : "Los botones están completos" },
            ].map((item) => (
              <li key={item.label} className={`flex items-center gap-2 ${item.ok ? "text-ink" : "text-ink-muted"}`}>
                <span className={`flex h-4 w-4 flex-none items-center justify-center rounded-full text-[10px] font-bold ${item.ok ? "bg-accent text-accent-ink" : "border border-border-strong"}`} aria-hidden="true">
                  {item.ok ? "✓" : ""}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg border border-error/40 bg-error/10 px-3 py-2.5 text-sm text-error">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-ink-faint">Al enviarla, Meta la revisa. No se puede editar después: si te equivocas, se borra y se crea otra.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onClose} className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent">
            Cancelar
          </button>
          <button type="submit" disabled={!canSend} className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover disabled:opacity-50">
            {isPending ? "Enviando a Meta…" : "Enviar a Meta para revisión"}
          </button>
        </div>
      </div>
    </form>
  );
}
