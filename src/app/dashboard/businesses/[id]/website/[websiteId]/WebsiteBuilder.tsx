"use client";

import { fromPanelUrl } from "@/lib/panelBackLink";
import { TrackingSettings } from "./TrackingSettings";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editWebsiteBlocksV2, restoreWebsiteContentV2, setWebsiteSectionImageV2, updateWebsiteDesignV2, updateWebsiteTextV2 } from "@/lib/actions";
import type { BlockOp } from "@/lib/websiteBlocks";
import { lookParts, type Look } from "@/lib/websiteLook";
import {
  PAGE_TYPE_LABELS,
  SECTION_LABELS,
  type ExtraElement,
  STYLE_INFO,
  STYLE_KEYS,
  type StyleKey,
  type WebsiteContentV2,
} from "@/lib/websiteContentV2";
import { FONT_OPTIONS } from "@/lib/websiteContent";
import { ScaledPagePreview } from "@/components/ScaledPagePreview";
import { ColorCodeInput } from "@/components/ColorCodeInput";
import { ColorSwatchButton } from "@/components/ColorSwatchButton";
import { STYLE_THEME } from "@/lib/websiteStylePreview";
import { ImagePicker } from "./ImagePicker";
import { BlocksPanel } from "./BlocksPanel";
import { BlockLibraryDialog } from "./BlockLibrary";
import { StylePanel } from "./StylePanel";
import { ChromePanel } from "./ChromePanel";
import { ButtonLinksPanel } from "./ButtonLinksPanel";
import { ElementPanel, type Inspect } from "./ElementPanel";
import { ButtonShapePicker } from "./ButtonShapePicker";
import { attachPreviewEditor, hoverSection, showSection, type EditorHandlers } from "./previewEditor";
import { BagIcon, CursorIcon, EyeIcon, ChevronLeftIcon, ChevronRightIcon, BackIcon, DesktopIcon, EditIcon, ExternalIcon, GearIcon, LinkIcon, MinusIcon, PaletteIcon, PhoneIcon, PlusIcon, PlusSquareIcon, RedoIcon, TabletIcon, UndoIcon } from "./builderIcons";
import { PublishControl } from "./PublishControl";
import { HtmlCodeDialog } from "./HtmlCodeDialog";

type Tab = "bloques" | "estilo" | "elemento" | "diseno" | "ajustes";
type Device = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "820px", mobile: "390px" };
const HINT_KEY = "fl-builder-edit-hint";
type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Full-screen builder for v2 pages: live preview in the middle (desktop /
 * tablet / phone), and on the side the AI chat for any change in plain
 * words, the block list (add from a library, drag to reorder, duplicate,
 * delete), the style of each block, the page's colors and fonts, and undo/redo.
 */
export function WebsiteBuilder({
  businessId,
  websiteId,
  name,
  slug,
  publicUrl,
  initialContent,
  stats,
  tracking,
  initialTab = "bloques",
  published = true,
}: {
  businessId: string;
  websiteId: string;
  name: string;
  slug: string;
  publicUrl: string;
  initialContent: WebsiteContentV2;
  stats: { views: number; clicks: number; leads: number };
  tracking: { metaPixelId: string | null; googleTagId: string | null };
  // ?tab=ajustes from the pages list's "Píxel" shortcut.
  initialTab?: Tab;
  // The prompt this page was made from, offered again when remaking it.
  published?: boolean;
}) {
  const [content, setContent] = useState(initialContent);
  // Undo / redo: the versions of the page before and after this one (this session only).
  const contentRef = useRef(initialContent);
  const pastRef = useRef<WebsiteContentV2[]>([]);
  const futureRef = useRef<WebsiteContentV2[]>([]);
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const [selected, setSelected] = useState<number | null>(null);
  // Bumped when the page changes from outside the style panel (undo, AI, another block op): the panel starts over from it.
  const [rev, setRev] = useState(0);
  const [library, setLibrary] = useState<{ at: number } | null>(null);
  const focusAfterLoad = useRef<number | null>(null);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [phoneMenu, setPhoneMenu] = useState(false);
  // The window where an HTML block's code is pasted (the block's number), or null.
  const [htmlDialog, setHtmlDialog] = useState<number | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  // Canvas zoom (desktop toolbar): 50–150 %.
  const [zoom, setZoom] = useState(100);
  // Desktop: the left panel folds away to give the page the whole width.
  const [panelOpen, setPanelOpen] = useState(true);
  const [logoPicker, setLogoPicker] = useState(false);
  // The element chosen on the page (a button or a text): its settings open in the left panel.
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  // Unsaved colors/fonts from the Diseño tab, shown live in the preview.
  const [draftTheme, setDraftTheme] = useState<WebsiteContentV2["theme"] | null>(null);
  const [previewTheme, setPreviewTheme] = useState<WebsiteContentV2["theme"] | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setPreviewTheme(draftTheme), 350);
    return () => clearTimeout(id);
  }, [draftTheme]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"panel" | "preview">("panel");
  const [, startTransition] = useTransition();

  // Click-to-edit on the preview itself (see previewEditor.ts).
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const scrollRef = useRef(0);
  const detachRef = useRef<(() => void) | null>(null);
  const handlersRef = useRef<EditorHandlers | null>(null);
  const [extraPhoto, setExtraPhoto] = useState<{ index: number; at: number | null; cell?: number } | null>(null);
  const [imageTarget, setImageTarget] = useState<{ index: number; field: "image" | "bgImage" } | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [toastUndo, setToastUndo] = useState(false);
  const showToast = (text: string, undo = false) => {
    setToast(text);
    setToastUndo(undo);
  };
  const [hintDismissed, setHintDismissed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_KEY)) setHintDismissed(true);
    } catch {
      // Storage blocked: the tip just shows again.
    }
  }, []);
  useEffect(() => () => detachRef.current?.(), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const refreshPreview = () => {
    // The reload keeps the person where they were instead of jumping back to the top.
    try {
      scrollRef.current = iframeRef.current?.contentWindow?.scrollY ?? 0;
    } catch {
      scrollRef.current = 0;
    }
    setPreviewVersion((v) => v + 1);
  };

  function attachTo(frame: HTMLIFrameElement | null) {
    detachRef.current?.();
    detachRef.current = null;
    const doc = frame?.contentDocument;
    if (!frame || !doc) return;
    try {
      // "instant": the page itself scrolls smoothly, and a smooth scroll here would slide the page up and down on every change.
      frame.contentWindow?.scrollTo({ top: scrollRef.current, left: 0, behavior: "instant" });
    } catch {
      // Not scrollable yet: harmless.
    }
    detachRef.current = attachPreviewEditor(doc, () => handlersRef.current!);
    if (focusAfterLoad.current !== null) {
      showSection(doc, focusAfterLoad.current);
      focusAfterLoad.current = null;
    }
  }

  function onPreviewLoad() {
    attachTo(iframeRef.current);
  }

  // A new version of the page loads behind the one on screen and takes its place when it is ready:
  // no white flash, no jump (it opens at the same scroll).
  const targetKey = `${previewVersion}-${previewTheme ? themeQuery(previewTheme) : ""}`;
  const targetSrc = `/sitio/${slug}?preview=1&edit=1&v=${previewVersion}${previewTheme ? `&${themeQuery(previewTheme)}` : ""}`;
  const [shown, setShown] = useState({ key: targetKey, src: targetSrc });
  const nextRef = useRef<HTMLIFrameElement>(null);
  function onNextLoad() {
    const next = nextRef.current;
    if (!next) return;
    attachTo(next);
    setShown({ key: targetKey, src: targetSrc });
  }

  // The first preview can finish loading before React hydrates this page, and then its
  // onLoad never fires: attach the editor to it here.
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc && doc.readyState === "complete" && doc.querySelector("[data-edit], [data-code-edit]") && !doc.querySelector("style[data-fl-editor]")) onPreviewLoad();
  }, []);

  function applyImage(url: string | null) {
    if (!imageTarget) return;
    const { index, field } = imageTarget;
    setImageTarget(null);
    setBusy("Aplicando la imagen…");
    startTransition(async () => {
      try {
        const res = await setWebsiteSectionImageV2(businessId, websiteId, index, field, url);
        if (!res.ok) {
          showToast(res.error);
          return;
        }
        adopt(res.content);
        refreshPreview();
      } finally {
        setBusy(null);
      }
    });
  }

  function runDesign(label: string, patch: Parameters<typeof updateWebsiteDesignV2>[2]) {
    setBusy(label);
    startTransition(async () => {
      try {
        const next = await updateWebsiteDesignV2(businessId, websiteId, patch);
        adopt(next);
        refreshPreview();
      } finally {
        setBusy(null);
      }
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the link is still visible to copy by hand.
    }
  }

  // Server re-renders hand us fresh content after regenerate.
  // (Saving an edit refreshes the page too: a version we already know from this session is not news.)
  useEffect(() => {
    const incoming = JSON.stringify(initialContent);
    const known = [contentRef.current, ...pastRef.current, ...futureRef.current].some((c) => JSON.stringify(c) === incoming);
    if (known) return;
    setContent(initialContent);
    contentRef.current = initialContent;
    pastRef.current = [];
    futureRef.current = [];
    setHistory({ undo: 0, redo: 0 });
    setRev((r) => r + 1);
  }, [initialContent]);

  /** Every change to the page goes through here, so it can be undone. */
  function adopt(next: WebsiteContentV2, opts: { quiet?: boolean } = {}) {
    if (!opts.quiet) setRev((r) => r + 1);
    const previous = contentRef.current;
    if (JSON.stringify(previous) !== JSON.stringify(next)) {
      pastRef.current = [...pastRef.current.slice(-49), previous];
      futureRef.current = [];
      setHistory({ undo: pastRef.current.length, redo: 0 });
    }
    contentRef.current = next;
    setContent(next);
  }

  function travel(direction: "undo" | "redo") {
    if (busy) return;
    const from = direction === "undo" ? pastRef : futureRef;
    const to = direction === "undo" ? futureRef : pastRef;
    const target = from.current.at(-1);
    if (!target) return;
    setBusy(direction === "undo" ? "Deshaciendo…" : "Rehaciendo…");
    startTransition(async () => {
      try {
        const res = await restoreWebsiteContentV2(businessId, websiteId, target);
        if (!res.ok) {
          showToast(res.error);
          return;
        }
        from.current = from.current.slice(0, -1);
        to.current = [...to.current, contentRef.current];
        contentRef.current = res.content;
        setContent(res.content);
        setRev((r) => r + 1);
        setHistory({ undo: pastRef.current.length, redo: futureRef.current.length });
        refreshPreview();
      } finally {
        setBusy(null);
      }
    });
  }

  // Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, unless the person is typing in a field of this page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      travel(e.shiftKey ? "redo" : "undo");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** Add / duplicate / delete / move a block. */
  /** A text, a button or a photo goes inside a block, right under its title. */
  // A title, text, button or photo goes into one column of a Contenedor.
  function addToCell(index: number, cell: number, kind: string) {
    const sec = content.sections[index];
    if (!sec || sec.type !== "layout" || !sec.cells[cell]) return;
    if (kind === "image") {
      setExtraPhoto({ index, at: null, cell });
      return;
    }
    const items = [...sec.cells[cell].items];
    if (items.length >= 8) {
      showToast("Una columna admite hasta 8 elementos.");
      return;
    }
    items.push(kind === "button" ? { type: "button", label: "Escríbenos", url: "" } : kind === "heading" ? { type: "heading", text: "Escribe tu título" } : { type: "text", text: "Escribe aquí tu texto." });
    setSelected(index);
    runBlock({ kind: "cellItems", index, cell, items }, "Agregando el elemento…");
  }

  function addExtra(kind: string, index: number | null) {
    if (index === null || !content.sections[index]) {
      showToast("Toca primero el bloque donde lo quieres, o arrástralo encima de uno.");
      return;
    }
    const target = content.sections[index];
    if (target.type === "layout") {
      // In a Contenedor an element goes into a column: the first empty one, or else the first.
      if (target.cells.length === 0) {
        showToast("Primero elige la estructura del contenedor.");
        return;
      }
      const empty = target.cells.findIndex((c) => c.items.length === 0);
      addToCell(index, empty >= 0 ? empty : 0, kind);
      return;
    }
    if (kind === "image") {
      setExtraPhoto({ index, at: null });
      return;
    }
    const list = [...((content.sections[index].extras ?? []) as ExtraElement[])];
    if (list.length >= 6) {
      showToast("Un bloque admite hasta 6 elementos.");
      return;
    }
    list.push(kind === "button" ? { type: "button", label: "Escríbenos", url: "" } : kind === "heading" ? { type: "heading", text: "Escribe tu título" } : { type: "text", text: "Escribe aquí tu descripción." });
    setSelected(index);
    runBlock({ kind: "extras", index, extras: list }, "Agregando el elemento…");
  }

  // Writes one text (from a panel) and shows it in the page.
  function saveTextRefresh(path: string, value: string) {
    setBusy("Guardando…");
    startTransition(async () => {
      try {
        const res = await updateWebsiteTextV2(businessId, websiteId, path, value);
        if (!res.ok) showToast(res.error);
        else {
          adopt(res.content);
          refreshPreview();
        }
      } finally {
        setBusy(null);
      }
    });
  }

  function runBlock(op: BlockOp, label = "Actualizando…") {
    setBusy(label);
    startTransition(async () => {
      try {
        const res = await editWebsiteBlocksV2(businessId, websiteId, op);
        if (!res.ok) {
          showToast(res.error);
          return;
        }
        adopt(res.content);
        setSelected(op.kind === "remove" ? null : res.focus);
        // Only a block that just appeared (or was moved) is brought into view; changing a block's options leaves the page exactly where it is.
        focusAfterLoad.current = op.kind === "add" || op.kind === "duplicate" || op.kind === "move" ? res.focus : null;
        if (op.kind === "remove") showToast("Bloque eliminado.", true);
        // A "Código HTML" block starts empty: open the window to paste the code right away.
        if (op.kind === "add" && res.content.sections[res.focus]?.type === "html") setHtmlDialog(res.focus);
        // On a phone the panel and the page are not side by side: after adding a block, show it.
        else if (op.kind === "add" && typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
          setMobilePanel("preview");
          showToast("Bloque agregado", true);
        }
        refreshPreview();
      } finally {
        setBusy(null);
      }
    });
  }

  /** The style panel saves quietly in the background: the preview already shows the change. */
  async function saveLook(index: number, look: Look | undefined) {
    const patch = Object.fromEntries((["bg", "color", "surface", "padY", "width", "align", "size", "titleScale", "textScale", "headingFont", "bodyFont", "hideOn"] as const).map((k) => [k, look?.[k] ?? null]));
    const res = await editWebsiteBlocksV2(businessId, websiteId, { kind: "look", index, patch });
    if (!res.ok) {
      showToast(res.error);
      refreshPreview();
      return;
    }
    adopt(res.content, { quiet: true });
  }

  /** Shows a style in the preview right away, before it is saved. */
  function liveLook(index: number, look: Look | undefined) {
    const el = iframeRef.current?.contentDocument?.querySelector<HTMLElement>(`section[data-sec="${index}"]`);
    if (!el) return;
    [...el.classList].filter((c) => c.startsWith("lk-")).forEach((c) => el.classList.remove(c));
    el.style.removeProperty("--lkbg");
    el.style.removeProperty("--lkc");
    el.style.removeProperty("--lks");
    for (const v of ["--ts", "--lkbs", "--hf", "--bf"]) el.style.removeProperty(v);
    const parts = lookParts(look, { photoBg: el.classList.contains("has-bg") || el.classList.contains("hero-full"), showAll: true });
    parts.classes.forEach((c) => el.classList.add(c));
    for (const [k, v] of Object.entries(parts.vars)) el.style.setProperty(k, v);
  }

  function selectBlock(index: number) {
    setSelected(index);
    const doc = iframeRef.current?.contentDocument;
    if (doc) showSection(doc, index, { scroll: false });
  }

  // What the preview's own editor can do: save a text, open the image window, move or hide a block.
  const editorHandlers: EditorHandlers = {
    async saveText(path, value) {
      setSaveState("saving");
      const res = await updateWebsiteTextV2(businessId, websiteId, path, value);
      if (!res.ok) {
        setSaveState("error");
        return { ok: false, error: res.error };
      }
      adopt(res.content);
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2500);
      // Something appeared or disappeared (an emptied text, the highlighted words of the headline): redraw.
      const sectionIndex = Number(path.split(".")[1]);
      const refresh = value === "" || /\.lines\.\d+$/.test(path) || (/^sections\.\d+\.heading$/.test(path) && res.content.sections[sectionIndex]?.type === "hero") || (/^sections\.\d+\.url$/.test(path) && res.content.sections[sectionIndex]?.type === "video");
      if (refresh) refreshPreview();
      return { ok: true, refresh };
    },
    pickImage: (index, field) => setImageTarget({ index, field }),
    move: (index, direction) => runBlock({ kind: "move", from: index, to: index + direction }, "Moviendo…"),
    hide: (index) => runDesign("Ocultando…", { hidden: [...content.hidden, index] }),
    style(index) {
      setSelected(index);
      setTab("estilo");
      setMobilePanel("panel");
    },
    code(index) {
      setSelected(index);
      setHtmlDialog(index);
    },
    dropBlock: (type, at) => runBlock({ kind: "add", type: type as never, at }, "Agregando el bloque…"),
    dropExtra: (kind, index, cell) => (cell !== undefined ? addToCell(index, cell, kind) : addExtra(kind, index)),
    layoutStructure: (index, structure) => runBlock({ kind: "layoutStructure", index, structure }, "Aplicando la estructura…"),
    addToCell: (index, cell, kind) => addToCell(index, cell, kind),
    removeFromCell: (index, cell, k) => {
      const sec = content.sections[index];
      if (!sec || sec.type !== "layout" || !sec.cells[cell]) return;
      runBlock({ kind: "cellItems", index, cell, items: sec.cells[cell].items.filter((_, i) => i !== k) }, "Quitando…");
    },
    // The "+" of a block adds an empty container right below it: its structure is picked in the page itself.
    add: (index) => runBlock({ kind: "add", type: "layout", at: index + 1 }, "Agregando el contenedor…"),
    addContainer: () => runBlock({ kind: "add", type: "layout" }, "Agregando el contenedor…"),
    openLibrary: () => setLibrary({ at: content.sections.length }),
    duplicate: (index) => runBlock({ kind: "duplicate", index }, "Duplicando…"),
    remove: (index) => runBlock({ kind: "remove", index }, "Eliminando…"),
    select: (index) => setSelected(index),
    undo: () => travel("undo"),
    redo: () => travel("redo"),
    section(index) {
      const s = content.sections[index];
      if (!s) return null;
      return { index, label: SECTION_LABELS[s.type], canMoveUp: index >= 2, canMoveDown: index >= 1 && index < content.sections.length - 1, canRemove: index >= 1, hasBg: !!s.bgImage };
    },
    notice: (message) => showToast(message),
    palette: () => [content.theme.primaryColor, content.theme.textColor, content.theme.backgroundColor, content.theme.surfaceColor],
    setHeaderColor: (key, color) => {
      setSaveState("saving");
      void updateWebsiteDesignV2(businessId, websiteId, { chrome: { [key]: color } }).then(
        (next) => {
          adopt(next);
          setSaveState("saved");
          setTimeout(() => setSaveState((v) => (v === "saved" ? "idle" : v)), 2500);
        },
        () => {
          setSaveState("error");
          showToast("No se pudo guardar el color.");
        },
      );
    },
    inspect: (path, kind) => {
      setInspect({ path, kind });
      setTab("elemento");
      setPanelOpen(true);
    },
    setIcon: (path, name) => saveTextRefresh(path, name),
    pickLogo: () => setLogoPicker(true),
    removeLogo: () => runDesign("Quitando el logo…", { chrome: { logo: null } }),
    setTextColor: (path, color) => {
      const m = /^sections\.(\d+)\.(.+)$/.exec(path);
      if (!m) return;
      setSaveState("saving");
      void editWebsiteBlocksV2(businessId, websiteId, { kind: "fieldColor", index: Number(m[1]), key: m[2], color }).then((res) => {
        if (!res.ok) {
          setSaveState("error");
          showToast(res.error);
          return;
        }
        adopt(res.content);
        setSaveState("saved");
        setTimeout(() => setSaveState((v) => (v === "saved" ? "idle" : v)), 2500);
      });
    },
  };
  useEffect(() => {
    handlersRef.current = editorHandlers;
  });

  const sel = selected !== null && selected < content.sections.length ? selected : null;
  // Editing comes first (like a page builder); the AI chat is the second way to change the page.
  // "Estilo" only exists while a block is chosen (it is that block's style): with nothing chosen it was an empty twin of Elementos.
  const TABS: { key: Tab; label: string; Icon: (p: { className?: string }) => React.JSX.Element; hint: string }[] = [
    { key: "bloques", label: "Elementos", Icon: PlusSquareIcon, hint: "Agrega bloques y elementos a tu página" },
    ...(inspect !== null ? [{ key: "elemento" as const, label: inspect.kind === "button" ? "Botón" : inspect.kind === "video" ? "Video" : "Texto", Icon: CursorIcon, hint: "Ajustes del elemento que elegiste en la página" }] : []),
    ...(sel !== null ? [{ key: "estilo" as const, label: "Estilo", Icon: EditIcon, hint: "Fondo, colores, espacios y tamaños del bloque elegido" }] : []),
    { key: "diseno", label: "Diseño", Icon: PaletteIcon, hint: "Colores y estilo de toda la página" },
    { key: "ajustes", label: "Ajustes", Icon: GearIcon, hint: "Link, formulario, pixel y estadísticas" },
  ];
  const activeTab: Tab = (tab === "estilo" && sel === null) || (tab === "elemento" && inspect === null) ? "bloques" : tab;

  return (
    <>
    {/* Phones do not build: the page is built from a computer or tablet. Here they only see it, copy its link and go back. */}
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-10 text-center md:hidden">
      <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/12 text-accent">
        <DesktopIcon className="h-8 w-8" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-lg font-bold">Esta página se edita desde un computador</h1>
        <p className="text-sm text-ink-muted">«{name}» se construye en la versión de escritorio de la plataforma. Desde el celular puedes verla y compartir su link.</p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <a href={fromPanelUrl(publicUrl)} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-accent-ink">
          Ver mi página
        </a>
        <button type="button" onClick={() => void copyLink()} className="h-12 rounded-xl border border-border px-4 text-sm font-semibold">
          {copied ? "¡Link copiado!" : "Copiar el link"}
        </button>
        <Link href={`/dashboard/businesses/${businessId}/website`} className="flex h-12 items-center justify-center rounded-xl text-sm font-semibold text-ink-muted">
          ← Volver a mis sitios
        </Link>
      </div>
    </div>
    <div className="-m-4 flex h-[calc(100dvh-4rem)] flex-col max-md:hidden md:-m-6">
      {/* Phone top bar: one row. Back, name, publish chip, undo/redo and a menu. */}
      <header className="flex items-center gap-1.5 border-b border-border bg-surface px-2 py-1.5 md:hidden">
        <Link href={`/dashboard/businesses/${businessId}/website`} aria-label="Volver a mis sitios" className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-xl text-ink-muted active:bg-surface-2">
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">{name}</p>
          <p aria-live="polite" className={`truncate text-[11px] leading-tight ${saveState === "error" ? "text-error" : "text-ink-faint"}`}>
            {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "✓ Guardado" : saveState === "error" ? "No se guardó" : "Se guarda solo"}
          </p>
        </div>
        <PublishControl businessId={businessId} websiteId={websiteId} published={published} variant="chip" />
        <button type="button" onClick={() => travel("undo")} disabled={!!busy || history.undo === 0} aria-label="Deshacer" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-border text-lg disabled:opacity-30">
          ↶
        </button>
        <button type="button" onClick={() => setPhoneMenu(true)} aria-label="Más opciones" aria-haspopup="dialog" className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-border text-xl leading-none">
          ⋯
        </button>
      </header>

      {phoneMenu && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/50 md:hidden" onClick={() => setPhoneMenu(false)}>
          <div role="dialog" aria-label="Más opciones" className="w-full space-y-2 rounded-t-2xl border-t border-border bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]" onClick={(e) => e.stopPropagation()}>
            <p className="px-1 text-xs font-bold uppercase tracking-wide text-ink-faint">{name}</p>
            <a href={fromPanelUrl(publicUrl)} target="_blank" rel="noopener noreferrer" className="flex h-12 items-center gap-3 rounded-xl bg-accent px-4 text-sm font-bold text-accent-ink">
              <span aria-hidden="true">↗</span> Ver mi página
            </a>
            <button type="button" onClick={() => { void copyLink(); setPhoneMenu(false); }} className="flex h-12 w-full items-center gap-3 rounded-xl border border-border px-4 text-left text-sm font-semibold">
              <LinkIcon className="h-4 w-4" /> {copied ? "¡Link copiado!" : "Copiar el link"}
            </button>
            <button type="button" onClick={() => { travel("redo"); setPhoneMenu(false); }} disabled={!!busy || history.redo === 0} className="flex h-12 w-full items-center gap-3 rounded-xl border border-border px-4 text-left text-sm font-semibold disabled:opacity-40">
              <span aria-hidden="true">↷</span> Rehacer
            </button>
            <button type="button" onClick={() => setPhoneMenu(false)} className="h-12 w-full rounded-xl text-sm font-semibold text-ink-muted">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Top bar (tablet and desktop): back + page name, the editor's sections as icons, and publishing on the right. */}
      <header className="hidden items-center gap-2 border-b border-border bg-surface px-3 py-1.5 md:flex lg:gap-3 lg:px-4">
        <Link href={`/dashboard/businesses/${businessId}/website`} title="Volver a mis sitios" aria-label="Volver a mis sitios" className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink">
          <BackIcon />
        </Link>
        <div className="min-w-0 flex-1 basis-0 lg:max-w-[16rem] lg:flex-none lg:basis-auto">
          <p className="truncate text-sm font-bold leading-tight">{name}</p>
          <p className="truncate text-[11px] leading-tight text-ink-faint">{publicUrl.replace(/^https?:\/\//, "")}</p>
        </div>
        <nav aria-label="Secciones del editor" className="mx-auto flex items-center gap-0.5">
          {TABS.map((t) => {
            const on = activeTab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                title={t.hint}
                aria-pressed={on}
                onClick={() => {
                  setTab(t.key);
                  setPanelOpen(true);
                }}
                className={`relative flex min-w-[4.25rem] flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${on ? "bg-accent/12 text-accent" : "text-ink-muted hover:bg-surface-2 hover:text-ink"}`}
              >
                <t.Icon />
                {t.label}
                {on && <span aria-hidden="true" className="absolute inset-x-3 -bottom-[7px] h-0.5 rounded-full bg-accent" />}
              </button>
            );
          })}
        </nav>
        <div className="flex flex-1 basis-0 items-center justify-end gap-1.5 lg:flex-none lg:basis-auto">
          <span aria-live="polite" className={`hidden min-w-[5rem] text-right text-[11px] font-semibold xl:block ${saveState === "error" ? "text-error" : "text-ink-muted"}`}>
            {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "✓ Guardado" : saveState === "error" ? "No se guardó" : ""}
          </span>
          <button type="button" onClick={copyLink} title="Copiar el link de la página" aria-label={copied ? "Link copiado" : "Copiar el link de la página"} className={`flex h-9 w-9 flex-none items-center justify-center rounded-lg border transition ${copied ? "border-accent text-accent" : "border-border text-ink-muted hover:border-accent hover:text-ink"}`}>
            <LinkIcon />
          </button>
          <a href={fromPanelUrl(publicUrl)} target="_blank" rel="noopener noreferrer" title="Ver mi página en otra pestaña" aria-label="Ver mi página" className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-border text-ink-muted transition hover:border-accent hover:text-ink">
            <ExternalIcon />
          </a>
          <PublishControl businessId={businessId} websiteId={websiteId} published={published} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Side panel */}
        <aside className={`${mobilePanel === "panel" ? "flex" : "hidden"} w-full flex-col border-r border-border bg-surface ${panelOpen ? "md:flex" : "md:hidden"} md:w-[23rem] md:flex-none`}>
          <nav className="flex gap-1 border-b border-border p-1.5 md:hidden">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${activeTab === t.key ? "bg-background text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {activeTab === "diseno" && (
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-3">
              <ThemeEditor
                content={content}
                disabled={!!busy}
                onDraftChange={setDraftTheme}
                onSave={(theme) => {
                  setDraftTheme(null);
                  runDesign("Guardando colores…", { theme });
                }}
              />
              <div className="border-t border-border pt-5">
                <ButtonShapePicker label="Forma de todos los botones" value={content.btnShape} onChange={(v) => runDesign("Guardando…", { btnShape: v })} />
              </div>
              <ChromePanel
                key={`chrome:${rev}`}
                chrome={content.chrome}
                theme={content.theme}
                busy={!!busy}
                onChange={(patch) => runDesign("Guardando…", { chrome: patch })}
                onPickLogo={() => setLogoPicker(true)}
              />
              <div className="space-y-2 border-t border-border pt-5">
                <p className="text-sm font-semibold text-ink">Estilo de la página</p>
                <p className="text-[12px] text-ink-muted">Cambia formas, colores y tipografías de una vez.</p>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      disabled={!!busy}
                      onClick={() => runDesign("Cambiando estilo…", { style: k as StyleKey })}
                      className={`overflow-hidden rounded-lg border-2 text-left transition disabled:opacity-60 ${content.style === k ? "border-accent" : "border-border hover:border-border-strong"}`}
                    >
                      <ScaledPagePreview src={`/dashboard/businesses/${businessId}/website/muestra?style=${k}&type=${content.pageType}`} aspect={0.62} title={`Estilo ${STYLE_INFO[k as StyleKey].label}`} />
                      <p className="truncate px-2 py-1.5 text-[12px] font-semibold">{STYLE_INFO[k as StyleKey].label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "bloques" && (
            <BlocksPanel
              content={content}
              selected={sel}
              busy={!!busy}
              onTogglePlain={() => runDesign("Guardando…", { plain: !content.plain })}
              onAddExtra={(kind) => addExtra(kind, sel)}
              onSelect={selectBlock}
              onOp={(op) => runBlock(op, op.kind === "add" ? "Agregando el bloque…" : op.kind === "remove" ? "Eliminando…" : op.kind === "duplicate" ? "Duplicando…" : "Moviendo…")}
              onStyle={(i) => {
                setSelected(i);
                setTab("estilo");
              }}
              onPickPhoto={(index, field) => setImageTarget({ index, field })}
              onHover={(index) => {
                const doc = iframeRef.current?.contentDocument;
                if (doc) hoverSection(doc, index);
              }}
              onSaveEventDate={async (index, date) => {
                const res = await editWebsiteBlocksV2(businessId, websiteId, { kind: "eventDate", index, date });
                if (!res.ok) {
                  showToast(res.error);
                  return false;
                }
                adopt(res.content);
                refreshPreview();
                showToast("Fecha guardada.", true);
                return true;
              }}
              onSaveVideoUrl={async (index, url) => {
                const res = await updateWebsiteTextV2(businessId, websiteId, `sections.${index}.url`, url);
                if (!res.ok) {
                  showToast(res.error);
                  return false;
                }
                adopt(res.content);
                refreshPreview();
                showToast(url ? "Video guardado." : "Video quitado.", true);
                return true;
              }}
              onEditHtml={(index) => {
                setSelected(index);
                setHtmlDialog(index);
              }}
              onToggleHidden={(i) => runDesign("Actualizando…", { hidden: content.hidden.includes(i) ? content.hidden.filter((h) => h !== i) : [...content.hidden, i] })}
            />
          )}

          {activeTab === "elemento" && inspect && (
            <ElementPanel
              key={inspect.path}
              content={content}
              inspect={inspect}
              busy={!!busy}
              onClose={() => {
                setInspect(null);
                setTab("bloques");
              }}
              onVideoUrl={(index, url) => saveTextRefresh(`sections.${index}.url`, url)}
              onVideoOpts={(index, opts) => runBlock({ kind: "videoOpts", index, opts }, "Guardando…")}
              onText={(path, value) => {
                setBusy("Guardando…");
                startTransition(async () => {
                  try {
                    const res = await updateWebsiteTextV2(businessId, websiteId, path, value);
                    if (!res.ok) showToast(res.error);
                    else {
                      adopt(res.content);
                      refreshPreview();
                    }
                  } finally {
                    setBusy(null);
                  }
                });
              }}
              onLink={(path, url) => {
                const m = /^sections\.(\d+)\.(.+)$/.exec(path);
                if (path === "chrome.headerLabel") return runDesign("Guardando…", { chrome: { headerLink: url } });
                if (!m) return;
                const cell = /^cells\.(\d+)\.items\.(\d+)\.label$/.exec(m[2]);
                if (cell) {
                  const sec = content.sections[Number(m[1])];
                  if (sec?.type === "layout" && sec.cells[Number(cell[1])]) {
                    const items = [...sec.cells[Number(cell[1])].items];
                    const item = items[Number(cell[2])];
                    if (item && item.type === "button") {
                      items[Number(cell[2])] = { ...item, url: url ?? "" };
                      runBlock({ kind: "cellItems", index: Number(m[1]), cell: Number(cell[1]), items }, "Guardando…");
                    }
                  }
                  return;
                }
                const extra = /^extras\.(\d+)\.label$/.exec(m[2]);
                if (extra) {
                  const list = [...((content.sections[Number(m[1])]?.extras ?? []) as ExtraElement[])];
                  const at = Number(extra[1]);
                  const item = list[at];
                  if (item && item.type === "button") {
                    list[at] = { ...item, url: url ?? "" };
                    runBlock({ kind: "extras", index: Number(m[1]), extras: list }, "Guardando…");
                  }
                  return;
                }
                runBlock({ kind: "buttonLink", index: Number(m[1]), key: m[2], url }, "Guardando…");
              }}
              onStyle={(path, patch) => {
                if (path === "chrome.headerLabel") return runDesign("Guardando…", { chrome: { headerBtn: patch.bg ?? null } });
                const m = /^sections\.(\d+)\.(.+)$/.exec(path);
                if (m) runBlock({ kind: "buttonStyle", index: Number(m[1]), key: m[2], patch }, "Guardando…");
              }}
              onColor={(path, color) => {
                if (path === "chrome.headerLabel") return runDesign("Guardando…", { chrome: { headerColor: color } });
                const m = /^sections\.(\d+)\.(.+)$/.exec(path);
                if (m) runBlock({ kind: "fieldColor", index: Number(m[1]), key: m[2], color }, "Guardando…");
              }}
            />
          )}

          {activeTab === "estilo" &&
            (sel === null ? (
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 text-sm text-ink-muted">
                <p className="font-semibold text-ink">Elige un bloque</p>
                <p>Toca un bloque en la página o en la pestaña Bloques para cambiar su fondo, colores, espacios y tamaños.</p>
                <button type="button" onClick={() => setTab("bloques")} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-ink hover:border-accent">
                  Ver los bloques
                </button>
              </div>
            ) : (
              <StylePanel
                key={`${sel}:${rev}`}
                section={content.sections[sel]}
                index={sel}
                theme={content.theme}
                busy={!!busy}
                onLive={(look) => liveLook(sel, look)}
                onSave={(look) => void saveLook(sel, look)}
                onPickBgImage={() => setImageTarget({ index: sel, field: "bgImage" })}
                onGalleryLayout={(layout) => runBlock({ kind: "galleryLayout", index: sel, layout }, "Cambiando el diseño…")}
                onExtras={(extras) => runBlock({ kind: "extras", index: sel, extras }, "Guardando…")}
                onPickExtraPhoto={(at) => setExtraPhoto({ index: sel, at })}
                onEditText={saveTextRefresh}
                onLayoutStructure={(structure) => runBlock({ kind: "layoutStructure", index: sel, structure }, "Aplicando la estructura…")}
              />
            ))}

          {activeTab === "ajustes" && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Visitas", stats.views],
                  ["Clics", stats.clicks],
                  ["Registros", stats.leads],
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border border-border bg-background p-2.5">
                    <p className="text-[11px] text-ink-muted">{label}</p>
                    <p className="text-lg font-bold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">Link público</p>
                <p className="break-all rounded-md border border-border bg-background px-2.5 py-2 text-xs">{publicUrl}</p>
              </div>
              <CtaUrlEditor value={content.heroCtaUrl} disabled={!!busy} onSave={(url) => runDesign("Guardando…", { heroCtaUrl: url })} />
              <CtaUrlEditor
                key={`ty:${content.thankYouUrl ?? ""}`}
                value={content.thankYouUrl ?? null}
                disabled={!!busy}
                title="Página de gracias"
                help="Después de enviar el formulario, la persona va a este link (por ejemplo, tu página de gracias o el enlace de tu regalo). Vacío = ve un mensaje de gracias en esta misma página."
                onSave={(url) => runDesign("Guardando…", { thankYouUrl: url })}
              />
              <ButtonLinksPanel
                content={content}
                disabled={!!busy}
                onSection={(index, key, url) => runBlock({ kind: "buttonLink", index, key, url }, "Guardando…")}
                onHeader={(url) => runDesign("Guardando…", { chrome: { headerLink: url } })}
              />
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={!!content.plain} disabled={!!busy} onChange={(e) => runDesign("Guardando…", { plain: e.target.checked })} />
                <span>
                  <span className="font-semibold text-ink">Quitar la barra de arriba y el pie</span>
                  <span className="block text-[12px] text-ink-muted">La página se ve solo con tus bloques, sin el nombre ni el botón de arriba ni el pie «Escríbenos por WhatsApp».</span>
                </span>
              </label>
              {content.sections.some((s) => s.type === "html") && (
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={!!content.fullHtml} disabled={!!busy} onChange={(e) => runDesign("Guardando…", { fullHtml: e.target.checked })} />
                  <span>
                    <span className="font-semibold text-ink">Mostrar solo mi HTML</span>
                    <span className="block text-[12px] text-ink-muted">La página pública es únicamente tu código, sin encabezado ni pie nuestros.</span>
                  </span>
                </label>
              )}
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={!!content.sticky} disabled={!!busy} onChange={(e) => runDesign("Guardando…", { sticky: e.target.checked })} />
                <span>
                  <span className="font-semibold text-ink">Botón fijo en el celular</span>
                  <span className="block text-[12px] text-ink-muted">Deja el botón principal siempre visible al final de la pantalla.</span>
                </span>
              </label>
              <TrackingSettings businessId={businessId} websiteId={websiteId} metaPixelId={tracking.metaPixelId} googleTagId={tracking.googleTagId} />
              <Link href={`/dashboard/businesses/${businessId}/productos`} className="block rounded-lg border border-border bg-background p-3 text-sm hover:border-accent">
                <BagIcon className="mr-1.5 inline h-4 w-4 -translate-y-px" /><strong>Productos</strong>
                <span className="block text-xs text-ink-muted">Agrega o edita los productos que aparecen en tu tienda.</span>
              </Link>
            </div>
          )}
        </aside>

        {/* Live preview */}
        <div className={`${mobilePanel === "preview" ? "flex" : "hidden"} min-w-0 flex-1 flex-col bg-surface-2 md:relative md:flex md:bg-[radial-gradient(var(--border-strong)_1px,transparent_1.2px)] md:bg-[length:18px_18px]`}>
        <button type="button" onClick={() => setPanelOpen((v) => !v)} aria-label={panelOpen ? "Esconder el panel" : "Mostrar el panel"} title={panelOpen ? "Esconder el panel" : "Mostrar el panel"} className="absolute left-0 top-1/2 z-20 hidden h-12 w-4 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-border bg-surface text-ink-muted shadow transition hover:text-accent md:flex">
          {panelOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </button>
        {/* Not on a page that is only the owner's own code: it is edited from the code, not on the page. */}
        {!hintDismissed && !content.fullHtml && (
          <div className="flex items-center gap-3 border-b border-border bg-accent/10 px-3 py-2 text-[12.5px] leading-snug text-ink">
            <p className="min-w-0 flex-1">
              <span className="md:hidden"><strong>Toca un texto</strong> para escribir sobre él, o una imagen para cambiarla. Los botones sobre cada bloque lo mueven, lo duplican o lo borran.</span>
              <span className="hidden md:inline"><strong>Edita en la página:</strong> toca un texto o una imagen. Arrastra elementos desde la izquierda.</span>
            </p>
            <button
              type="button"
              onClick={() => {
                setHintDismissed(true);
                try {
                  localStorage.setItem(HINT_KEY, "1");
                } catch {
                  // Storage blocked: it will show again next time.
                }
              }}
              className="flex-none rounded-md border border-border-strong px-2.5 py-1 text-xs font-semibold hover:border-accent"
            >
              Entendido
            </button>
          </div>
        )}
        {/* Floating canvas toolbar (tablet and desktop): undo/redo, zoom, fit and the device the page is shown on. */}
        <div className="hidden flex-none justify-center px-3 pt-3 md:flex">
          <div role="toolbar" aria-label="Herramientas del lienzo" className="flex items-center gap-1 rounded-xl border border-border bg-surface px-1.5 py-1 shadow-md">
            <button type="button" onClick={() => travel("undo")} disabled={!!busy || history.undo === 0} title="Deshacer (Ctrl+Z)" aria-label="Deshacer" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-35">
              <UndoIcon />
            </button>
            <button type="button" onClick={() => travel("redo")} disabled={!!busy || history.redo === 0} title="Rehacer (Ctrl+Mayús+Z)" aria-label="Rehacer" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-35">
              <RedoIcon />
            </button>
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
            <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 10))} disabled={zoom <= 50} title="Alejar" aria-label="Alejar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-35">
              <MinusIcon />
            </button>
            <button type="button" onClick={() => setZoom(100)} title="Volver a 100 %" aria-label={`Zoom ${zoom} %, tocar para volver a 100 %`} className="h-8 min-w-[3.25rem] rounded-lg px-1 text-xs font-bold tabular-nums text-ink transition hover:bg-surface-2">
              {zoom}%
            </button>
            <button type="button" onClick={() => setZoom((z) => Math.min(150, z + 10))} disabled={zoom >= 150} title="Acercar" aria-label="Acercar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-35">
              <PlusIcon />
            </button>
            <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
            <div role="radiogroup" aria-label="Vista" className="flex items-center gap-0.5">
              {([
                ["desktop", "Computador", DesktopIcon],
                ["tablet", "Tablet", TabletIcon],
                ["mobile", "Celular", PhoneIcon],
              ] as const).map(([d, label, Icon]) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={device === d}
                  aria-label={label}
                  title={label}
                  onClick={() => setDevice(d)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${device === d ? "bg-accent/12 text-accent" : "text-ink-muted hover:bg-surface-2 hover:text-ink"}`}
                >
                  <Icon />
                </button>
              ))}
            </div>
          </div>
        </div>
        <main className="relative flex min-h-0 min-w-0 flex-1 justify-center overflow-auto p-0 md:p-4">
          <div
            className={`relative h-full overflow-hidden bg-white transition-[width] duration-300 md:rounded-xl md:border md:border-border md:shadow-2xl `}
            style={zoom === 100 ? { width: DEVICE_WIDTH[device], maxWidth: "100%" } : { zoom: zoom / 100, width: device === "desktop" ? `${10000 / zoom}%` : DEVICE_WIDTH[device], maxWidth: `${10000 / zoom}%`, height: "auto" }}
          >
            {(shown.key === targetKey ? [{ key: shown.key, src: shown.src }] : [{ key: shown.key, src: shown.src }, { key: targetKey, src: targetSrc }]).map((fr) => {
              const isShown = fr.key === shown.key;
              return (
                <iframe
                  key={fr.key}
                  ref={(el) => {
                    if (isShown) iframeRef.current = el;
                    else nextRef.current = el;
                  }}
                  src={fr.src}
                  title={isShown ? "Vista previa de la página, editable: toca un texto o una imagen para cambiarlos" : "Nueva versión de la página (cargando)"}
                  aria-hidden={isShown ? undefined : true}
                  tabIndex={isShown ? undefined : -1}
                  onLoad={isShown ? onPreviewLoad : onNextLoad}
                  className={isShown ? "h-full w-full border-0" : "pointer-events-none absolute inset-0 h-full w-full border-0 opacity-0"}
                />
              );
            })}
            {busy && (
              <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
                <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-lg ring-1 ring-border">{busy}</span>
              </div>
            )}
          </div>
          {toast && (
            <p role="status" className="absolute bottom-4 left-1/2 z-10 flex max-w-[90%] -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2 text-center text-sm font-semibold text-background shadow-lg">
              {toast}
              {toastUndo && (
                <button
                  type="button"
                  onClick={() => {
                    setToast(null);
                    travel("undo");
                  }}
                  className="rounded-full bg-background/20 px-2.5 py-0.5 text-xs font-bold hover:bg-background/30"
                >
                  Deshacer
                </button>
              )}
            </p>
          )}
        </main>
        </div>
      </div>

      {htmlDialog !== null && content.sections[htmlDialog]?.type === "html" && (
        <HtmlCodeDialog
          key={`html${htmlDialog}`}
          code={(content.sections[htmlDialog] as { code: string }).code}
          height={(content.sections[htmlDialog] as { height: number }).height}
          onSave={async (code, height) => {
            const res = await editWebsiteBlocksV2(businessId, websiteId, { kind: "html", index: htmlDialog, code, height });
            if (!res.ok) {
              showToast(res.error);
              return false;
            }
            adopt(res.content);
            refreshPreview();
            setMobilePanel("preview");
            showToast("Código guardado.", true);
            return true;
          }}
          onClose={() => setHtmlDialog(null)}
        />
      )}

      {library && (
        <BlockLibraryDialog
          where={library.at >= content.sections.length ? "al final de la página" : "justo debajo del bloque que elegiste"}
          onClose={() => setLibrary(null)}
          onPick={(type) => {
            const at = library.at;
            setLibrary(null);
            runBlock({ kind: "add", type, at }, "Agregando el bloque…");
          }}
        />
      )}

      {logoPicker && (
        <ImagePicker
          businessId={businessId}
          title="Logo de tu negocio"
          help="Sube tu logo o elige uno de tus archivos. Se ve pequeño en el menú de la página."
          current={content.chrome?.logo ?? null}
          removeLabel="Quitar el logo"
          onPick={(url) => {
            setLogoPicker(false);
            runDesign("Guardando el logo…", { chrome: { logo: url } });
          }}
          onRemove={content.chrome?.logo ? () => { setLogoPicker(false); runDesign("Quitando el logo…", { chrome: { logo: null } }); } : null}
          onClose={() => setLogoPicker(false)}
        />
      )}

      {extraPhoto && (
        <ImagePicker
          businessId={businessId}
          title="Foto dentro del bloque"
          help="Elige una de tus fotos o sube una nueva: se acomoda sola debajo del título, sin recortarse."
          current={null}
          removeLabel=""
          onPick={(url) => {
            const t = extraPhoto;
            setExtraPhoto(null);
            if (t.cell !== undefined) {
              const sec = content.sections[t.index];
              if (sec?.type === "layout" && sec.cells[t.cell]) runBlock({ kind: "cellItems", index: t.index, cell: t.cell, items: [...sec.cells[t.cell].items, { type: "image", url }] }, "Agregando la foto…");
              return;
            }
            const list = [...((content.sections[t.index]?.extras ?? []) as ExtraElement[])];
            if (t.at === null) list.push({ type: "image", url });
            else list[t.at] = { type: "image", url };
            runBlock({ kind: "extras", index: t.index, extras: list }, "Agregando la foto…");
          }}
          onRemove={null}
          onClose={() => setExtraPhoto(null)}
        />
      )}
      {imageTarget && (() => {
        const section = content.sections[imageTarget.index];
        const isBg = imageTarget.field === "bgImage";
        const current = (isBg ? section?.bgImage : section?.image) ?? null;
        return (
          <ImagePicker
            businessId={businessId}
            title={isBg ? `Imagen de fondo · ${section ? SECTION_LABELS[section.type] : "bloque"}` : "Cambiar imagen"}
            help={isBg ? "La foto queda detrás del bloque, con un velo oscuro para que el texto se lea bien." : "Elige una de tus fotos o sube una nueva: reemplaza esta imagen."}
            current={current}
            removeLabel={isBg ? "Quitar la imagen de fondo" : "Volver a la imagen automática"}
            onPick={(url) => applyImage(url)}
            onRemove={current ? () => applyImage(null) : null}
            onClose={() => setImageTarget(null)}
          />
        );
      })()}
      {/* Phone: the two things you do, at thumb reach. */}
      <nav aria-label="Modo" className="flex flex-none gap-2 border-t border-border bg-surface p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] md:hidden">
        {(["panel", "preview"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMobilePanel(p)}
            aria-pressed={mobilePanel === p}
            className={`flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${mobilePanel === p ? "bg-accent text-accent-ink" : "bg-surface-2 text-ink-muted"}`}
          >
            {p === "panel" ? <PlusSquareIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
            {p === "panel" ? "Elementos y ajustes" : "Mi página"}
          </button>
        ))}
      </nav>
    </div>
    </>
  );
}

function themeQuery(theme: WebsiteContentV2["theme"]): string {
  return new URLSearchParams({
    pc: theme.primaryColor,
    bg: theme.backgroundColor,
    sc: theme.surfaceColor,
    tc: theme.textColor,
    hf: theme.headingFont,
    bf: theme.bodyFont,
  }).toString();
}

const COLOR_FIELDS: { key: "primaryColor" | "backgroundColor" | "surfaceColor" | "textColor"; label: string; hint: string }[] = [
  { key: "primaryColor", label: "Color principal", hint: "Botones, enlaces y palabras destacadas" },
  { key: "backgroundColor", label: "Fondo", hint: "El color de fondo de toda la página" },
  { key: "surfaceColor", label: "Tarjetas y franjas", hint: "Bloques y secciones alternas" },
  { key: "textColor", label: "Texto", hint: "Títulos y párrafos" },
];

const PALETTE_STYLES = ["corporativo", "clinico", "calido", "producto", "pop", "tech", "lujo", "gourmet"] as const;

function PencilIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M13.6 3.6a2 2 0 0 1 2.8 2.8l-8.7 8.7-3.6.8.8-3.6 8.7-8.7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function ThemeEditor({
  content,
  disabled,
  onSave,
  onDraftChange,
}: {
  content: WebsiteContentV2;
  disabled: boolean;
  onSave: (theme: Partial<WebsiteContentV2["theme"]>) => void;
  onDraftChange: (theme: WebsiteContentV2["theme"] | null) => void;
}) {
  const [theme, setTheme] = useState(content.theme);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflect AI/style changes
    setTheme(content.theme);
    onDraftChange(null);
  }, [content.theme, onDraftChange]);
  const changed = JSON.stringify(theme) !== JSON.stringify(content.theme);

  function update(next: WebsiteContentV2["theme"]) {
    setTheme(next);
    onDraftChange(JSON.stringify(next) === JSON.stringify(content.theme) ? null : next);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <PencilIcon className="h-4 w-4 text-accent" /> Colores de tu página
        </p>
        <p className="text-[12px] text-ink-muted">Toca el color o pega su código (#F3F3EF o rgb). Verás el cambio en la página al instante.</p>
      </div>

      <div className="space-y-2">
        {COLOR_FIELDS.map(({ key, label, hint }) => {
          const value = /^#[0-9a-fA-F]{6}$/.test(theme[key]) ? theme[key] : "#000000";
          return (
            <div key={key} className="group flex items-center gap-3 rounded-xl border border-border bg-background p-2.5 transition hover:border-accent focus-within:border-accent">
              <ColorSwatchButton value={value} label={label.toLowerCase()} disabled={disabled} sizeClass="h-11 w-11" roundedClass="rounded-lg" onChange={(hex) => update({ ...theme, [key]: hex })}>
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-ink shadow">
                  <PencilIcon className="h-3 w-3" />
                </span>
              </ColorSwatchButton>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight text-ink">{label}</p>
                <p className="truncate text-[12px] text-ink-muted">{hint}</p>
              </div>
              <ColorCodeInput
                value={theme[key]}
                disabled={disabled}
                label={label.toLowerCase()}
                onChange={(hex) => update({ ...theme, [key]: hex })}
              />
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-ink">Combinaciones listas</p>
        <div className="grid grid-cols-4 gap-2">
          {PALETTE_STYLES.map((k) => {
            const p = STYLE_THEME[k];
            return (
              <button
                key={k}
                type="button"
                disabled={disabled}
                title={STYLE_INFO[k].label}
                onClick={() =>
                  update({ ...theme, primaryColor: p.primaryColor, backgroundColor: p.backgroundColor, surfaceColor: p.surfaceColor, textColor: p.textColor })
                }
                className="overflow-hidden rounded-lg border border-border transition hover:border-accent disabled:opacity-50"
              >
                <span className="flex h-9" style={{ background: p.backgroundColor }}>
                  <span className="m-auto flex gap-1">
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.primaryColor }} />
                    <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: p.surfaceColor }} />
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.textColor }} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[12px] font-semibold text-ink">Tipografía</p>
        {(["headingFont", "bodyFont"] as const).map((key) => (
          <label key={key} className="block space-y-1">
            <span className="text-[12px] text-ink-muted">{key === "headingFont" ? "Títulos" : "Textos"}</span>
            <select
              value={theme[key]}
              disabled={disabled}
              onChange={(e) => update({ ...theme, [key]: e.target.value as (typeof FONT_OPTIONS)[number] })}
              className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-accent"
              style={{ fontFamily: `"${theme[key]}", system-ui, sans-serif` }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {changed && (
        <div className="sticky bottom-0 -mx-3 flex items-center gap-2 border-t border-border bg-surface px-3 py-2.5 shadow-[0_-8px_16px_-12px_rgba(0,0,0,0.3)]">
          <p className="min-w-0 flex-1 text-[12px] text-ink-muted">Cambios sin guardar</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => update(content.theme)}
            className="rounded-lg border border-border-strong px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-60"
          >
            Descartar
          </button>
          <button
            type="button"
            disabled={disabled || COLOR_FIELDS.some(({ key }) => !/^#[0-9a-fA-F]{6}$/.test(theme[key]))}
            onClick={() => onSave(theme)}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-ink disabled:opacity-60"
          >
            Guardar cambios
          </button>
        </div>
      )}
    </div>
  );
}

function CtaUrlEditor({ value, disabled, onSave, title = "Botón principal", help = "Vacío = abre tu WhatsApp. O pon un link (agenda, checkout)." }: { value: string | null; disabled: boolean; onSave: (url: string | null) => void; title?: string; help?: string }) {
  const [url, setUrl] = useState(value ?? "");
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint">{title}</p>
      <p className="text-[12px] text-ink-muted">{help}</p>
      <div className="flex gap-1.5">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-accent"
        />
        <button type="button" disabled={disabled || url === (value ?? "")} onClick={() => onSave(url.trim() || null)} className="rounded-md border border-border-strong px-3 text-xs font-semibold disabled:opacity-40">
          Guardar
        </button>
      </div>
    </div>
  );
}
