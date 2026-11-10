"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Flow, Step, StepType } from "@/lib/automations/flow";
import { buildTree, stepTitle, TERMINAL_TYPES, type TreeNode } from "@/lib/automations/flowEdit";
import { StepIcon } from "../StepIcon";
import { MENU_ORDER, STEP_META } from "../stepMeta";
import { StepForm, type EditorData } from "./StepForm";

// The flow drawn from top to bottom. A step with several arrows (buttons, a
// condition…) shows them side by side, each with its own chain underneath.
// Every empty arrow ends in "Agregar paso", which opens the menu of steps.

type Handlers = {
  flow: Flow;
  data: EditorData;
  issues: Record<string, string[]>;
  openId: string | null;
  onToggle: (id: string) => void;
  onChange: (step: Step) => void;
  onAdd: (parentId: string, key: string, type: StepType) => void;
  onRemove: (id: string) => void;
};

const connector = <div aria-hidden="true" className="mx-auto h-6 w-px bg-border-strong" />;

const MENU_WIDTH = 320;

function AddStep({ parentId, slotKey, occupied, onAdd }: { parentId: string; slotKey: string; occupied: boolean; onAdd: Handlers["onAdd"] }) {
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const openedAt = useRef(0);
  const open = pos !== null;

  // The canvas scrolls and clips what sticks out of it, so the menu is placed
  // on the screen itself, next to the button.
  const show = () => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const margin = 8;
    const left = Math.min(Math.max(margin, r.left + r.width / 2 - MENU_WIDTH / 2), window.innerWidth - MENU_WIDTH - margin);
    const below = window.innerHeight - r.bottom - margin * 2;
    const above = r.top - margin * 2;
    const useBelow = below >= 280 || below >= above;
    const maxHeight = Math.max(200, Math.min(520, useBelow ? below : above));
    openedAt.current = Date.now();
    setPos({ left, maxHeight, top: useBelow ? r.bottom + margin : Math.max(margin, r.top - margin - maxHeight) });
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const outside = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) close();
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && close();
    // Scrolling the page or the canvas moves the button away; scrolling the menu's own list doesn't.
    const scrolled = (e: Event) => {
      // The view may still be settling on a step that was just added.
      if (Date.now() - openedAt.current < 500) return;
      if (box.current && e.target instanceof Node && box.current.contains(e.target)) return;
      close();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", scrolled, true);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", scrolled, true);
    };
  }, [open]);

  return (
    <div ref={box} className="relative flex flex-col items-center">
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? setPos(null) : show())}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={occupied ? "Insertar un paso aquí" : "Agregar paso"}
        className={
          occupied
            ? "flex h-6 w-6 items-center justify-center rounded-full border border-border-strong bg-surface text-sm font-semibold leading-none text-ink-muted transition hover:border-accent hover:text-ink"
            : "flex items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-accent hover:text-ink"
        }
      >
        <span aria-hidden="true" className={occupied ? "" : "text-base leading-none"}>
          +
        </span>
        {!occupied && "Agregar paso"}
      </button>
      {pos && (
        <div role="menu" aria-label="Agrega el siguiente paso" style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_WIDTH, maxHeight: pos.maxHeight }} className="z-50 flex flex-col rounded-2xl border border-border bg-surface p-2 shadow-xl">
          <p className="flex-none px-3 pb-1.5 pt-2 text-sm font-semibold text-ink">Agrega el siguiente paso</p>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1">
            {MENU_ORDER.map((type) => {
              const blocked = occupied && TERMINAL_TYPES.includes(type);
              return (
                <li key={type}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={blocked}
                    title={blocked ? "Este paso termina el flujo: solo va al final de un camino." : undefined}
                    onClick={() => {
                      setPos(null);
                      onAdd(parentId, slotKey, type);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <StepIcon type={type} size={32} />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">{STEP_META[type].label}</span>
                      <span className="block text-xs leading-snug text-ink-muted">{STEP_META[type].hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function summary(step: Step): string {
  switch (step.type) {
    case "message":
      return step.text;
    case "list":
      return step.text;
    case "comment":
    case "internal":
      return step.text;
    case "ai_condition":
      return step.question;
    case "validation":
      return step.prompt;
    case "actions":
      return `${step.actions.length} ${step.actions.length === 1 ? "acción" : "acciones"}`;
    case "condition":
      return `${step.rules.length} ${step.rules.length === 1 ? "regla" : "reglas"}`;
    case "http":
      return step.url;
    case "round_robin":
      return `${step.pipelineIds.length} embudos`;
    default:
      return STEP_META[step.type].hint;
  }
}

function StepCard({ step, h }: { step: Step; h: Handlers }) {
  const open = h.openId === step.id;
  const problems = h.issues[step.id] ?? [];
  const isStart = h.flow.start === step.id;
  return (
    <article id={`step-card-${step.id}`} className={`w-full max-w-[20rem] lg:w-[20rem] rounded-2xl border bg-surface shadow-sm transition ${open ? "border-accent" : problems.length ? "border-[#fab219]/70" : "border-border"}`}>
      <div className="flex items-start gap-3 p-3">
        <StepIcon type={step.type} />
        <button type="button" onClick={() => h.onToggle(step.id)} aria-expanded={open} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{STEP_META[step.type].label}</span>
            {isStart && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Primer paso</span>}
          </span>
          <span className="mt-0.5 line-clamp-2 break-words text-xs leading-snug text-ink-muted [overflow-wrap:anywhere]">{summary(step)}</span>
          {problems.length > 0 && !open && <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#b97d00]">⚠ {problems[0]}</span>}
        </button>
        <button type="button" onClick={() => h.onToggle(step.id)} aria-label={open ? "Cerrar" : "Editar este paso"} className="flex-none rounded-lg p-1.5 text-ink-muted transition hover:bg-surface-2 hover:text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`transition ${open ? "rotate-180" : ""}`} aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="space-y-4 border-t border-border p-3">
          {problems.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-[#fab219]/50 bg-[#fab219]/10 px-3 py-2 text-xs text-ink">
              {problems.map((p, i) => (
                <li key={i}>⚠ {p}</li>
              ))}
            </ul>
          )}
          <StepForm step={step} flow={h.flow} data={h.data} onChange={h.onChange} />
          <div className="flex justify-end border-t border-border pt-3">
            <button type="button" onClick={() => h.onRemove(step.id)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#d03b3b] transition hover:bg-[#d03b3b]/10">
              Quitar este paso
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function Branch({ slot, child, parent, h, labelled }: { slot: TreeNode["slots"][number]["slot"]; child: TreeNode["slots"][number]["child"]; parent: Step; h: Handlers; labelled: boolean }) {
  return (
    <div className={`flex w-full flex-col items-center lg:w-auto ${child !== null && !("ref" in child) ? "lg:min-w-[20rem]" : "lg:min-w-[9rem]"}`}>
      {connector}
      {labelled && (
        <>
          <span className="max-w-full truncate rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-semibold text-ink" title={slot.label}>
            {slot.label || "Sin texto"}
          </span>
          {connector}
        </>
      )}
      {child === null ? (
        <AddStep parentId={parent.id} slotKey={slot.key} occupied={false} onAdd={h.onAdd} />
      ) : "ref" in child ? (
        <div className="max-w-[20rem] rounded-xl border border-dashed border-border-strong px-3 py-2 text-center text-xs text-ink-muted">
          ↪ Continúa en <strong className="text-ink">{h.flow.steps[child.ref] ? stepTitle(h.flow.steps[child.ref]) : "otro paso"}</strong>
        </div>
      ) : (
        <>
          <div className="mb-0 flex w-full flex-col items-center">
            <AddStep parentId={parent.id} slotKey={slot.key} occupied onAdd={h.onAdd} />
            {connector}
          </div>
          <NodeView node={child} h={h} />
        </>
      )}
    </div>
  );
}

function NodeView({ node, h }: { node: TreeNode; h: Handlers }) {
  const { step, slots } = node;
  const labelled = slots.length > 1 || slots.some((s) => s.slot.key !== "next");
  return (
    <div className="flex w-full flex-col items-center lg:w-auto">
      <StepCard step={step} h={h} />
      {step.type === "goto" && h.flow.steps[step.target] && (
        <p className="mt-2 max-w-[20rem] text-center text-xs text-ink-muted">
          ↪ Salta a <strong className="text-ink">{stepTitle(h.flow.steps[step.target])}</strong>
        </p>
      )}
      {slots.length === 1 && !labelled && (
        <Branch slot={slots[0].slot} child={slots[0].child} parent={step} h={h} labelled={false} />
      )}
      {(slots.length > 1 || labelled) && slots.length > 0 && (
        <div className="flex w-full flex-col items-center lg:w-auto lg:flex-row lg:items-start lg:justify-center lg:gap-6">
          {slots.map((s) => (
            <Branch key={s.slot.key} slot={s.slot} child={s.child} parent={step} h={h} labelled />
          ))}
        </div>
      )}
      {slots.length === 0 && <div aria-hidden="true" className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Fin del camino</div>}
    </div>
  );
}

export function FlowCanvas(props: Handlers) {
  const tree = buildTree(props.flow);
  const scroller = useRef<HTMLDivElement>(null);

  // A tree with several branches is wider than the screen. The first step sits
  // in the middle of it, so that is where the view starts.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2);
  }, []);

  // Opening a step (or adding one) brings it into view.
  const { openId } = props;
  useEffect(() => {
    if (!openId) return;
    document.getElementById(`step-card-${openId}`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [openId]);

  return (
    <div ref={scroller} className="overflow-x-auto pb-6">
      <div className="mx-auto flex min-w-full flex-col items-center px-2 lg:w-max">
        <div className="flex items-center gap-2 rounded-xl border-2 border-accent/60 bg-accent/10 px-4 py-2 text-sm font-semibold text-ink">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13l10-6.5-10-6.5Z" />
          </svg>
          Inicia el flujo
        </div>
        {connector}
        {tree ? <NodeView node={tree} h={props} /> : <p className="text-sm text-ink-muted">Este flujo no tiene pasos.</p>}
      </div>
    </div>
  );
}
