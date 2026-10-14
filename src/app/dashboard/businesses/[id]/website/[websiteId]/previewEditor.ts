// Click-to-edit for the builder's live preview, like the visual editors people
// already know: tap any text to type on it, tap a picture to replace it, and
// hover (or tap) a block to get its own small toolbar.
//
// The preview is the real page (/sitio/<slug>?preview=1&edit=1) in a
// same-origin iframe. In that mode the page marks what can be edited
// (data-edit="<path of the text>", data-img="<section>", data-sec="<section>");
// this module, running in the dashboard, listens to the iframe's document.
// Nothing runs inside the public page itself (it ships with script-src 'none').

export type SectionInfo = { index: number; label: string; canMoveUp: boolean; canMoveDown: boolean; hasBg: boolean };

export type EditorHandlers = {
  /** Saves one edited text. `refresh` asks for a reload of the preview (something appeared or disappeared). */
  saveText(path: string, value: string): Promise<{ ok: boolean; error?: string; refresh?: boolean }>;
  pickImage(index: number, field: "image" | "bgImage"): void;
  move(index: number, direction: -1 | 1): void;
  hide(index: number): void;
  section(index: number): SectionInfo | null;
  notice(message: string): void;
};

const ACCENT = "#5b6cf0";

const CSS = `
[data-edit]{cursor:text;border-radius:4px;transition:outline-color .12s,background-color .12s}
[data-edit]:hover{outline:2px dashed ${ACCENT};outline-offset:3px}
[data-edit].fl-editing{outline:2px solid ${ACCENT}!important;outline-offset:3px;background:rgba(91,108,240,.1);-webkit-user-select:text;user-select:text}
[data-note]{cursor:help}
img[data-img]{cursor:pointer;transition:filter .12s}
img[data-img]:hover{outline:3px solid ${ACCENT};outline-offset:-3px;filter:brightness(.9)}
section[data-sec].fl-active{box-shadow:inset 0 0 0 2px rgba(91,108,240,.55)}
.fl-bar-wrap{position:absolute;right:12px;top:8px;z-index:2147483000;font:600 12px/1 system-ui,sans-serif;text-transform:none;letter-spacing:0;text-align:left}
.fl-bar{display:flex;align-items:center;gap:2px;padding:4px;background:#111827;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.fl-label{color:#9ca3af;padding:0 8px 0 6px;font-weight:600;white-space:nowrap}
.fl-bar button{all:unset;box-sizing:border-box;cursor:pointer;color:#fff;padding:8px 10px;border-radius:8px;white-space:nowrap;font:600 12px/1 system-ui,sans-serif}
.fl-bar button:hover{background:#374151}
.fl-bar button:focus-visible{outline:2px solid #fff}
.fl-bar button[disabled]{opacity:.3;cursor:default}
.fl-bar button[disabled]:hover{background:none}
@media (max-width:700px){.fl-label{display:none}}
`;

const MULTILINE = /\.(body|answer|description|intro|subheading)$/;

// The page lives in another window (the iframe), whose Element and Node classes are not
// ours: `instanceof Element` is always false for its nodes, so nodes are recognized by type.
const asElement = (t: EventTarget | null): Element | null => (t && (t as Node).nodeType === 1 ? (t as Element) : null);
const isInside = (container: Element, t: EventTarget | null): boolean => !!t && (t as Node).nodeType !== undefined && container.contains(t as Node);

export function attachPreviewEditor(doc: Document, getHandlers: () => EditorHandlers): () => void {
  const win = doc.defaultView;
  if (!win || !doc.head || !doc.body) return () => {};

  const style = doc.createElement("style");
  style.setAttribute("data-fl-editor", "");
  style.textContent = CSS;
  doc.head.appendChild(style);

  doc.querySelectorAll<HTMLElement>("img[data-img]").forEach((img) => {
    img.title = "Toca para cambiar la imagen";
  });
  // Every answer of the FAQ open, so each one can be edited.
  doc.querySelectorAll("details").forEach((d) => {
    d.open = true;
  });

  const wrap = doc.createElement("div");
  wrap.className = "fl-bar-wrap";
  wrap.setAttribute("contenteditable", "false");
  const bar = doc.createElement("div");
  bar.className = "fl-bar";
  wrap.appendChild(bar);

  let active: HTMLElement | null = null;
  let editing: HTMLElement | null = null;
  let original = "";

  function placeBar() {
    if (!active) return;
    const r = active.getBoundingClientRect();
    // Stays in view under the page's sticky header while the block is on screen.
    const top = Math.max(8, 76 - r.top);
    wrap.style.top = `${Math.min(top, Math.max(8, r.height - 52))}px`;
  }

  function renderBar(section: HTMLElement) {
    const index = Number(section.dataset.sec);
    const info = getHandlers().section(index);
    if (!info) return false;
    bar.textContent = "";
    const label = doc.createElement("span");
    label.className = "fl-label";
    label.textContent = info.label;
    bar.appendChild(label);
    const add = (act: string, text: string, title: string, disabled = false) => {
      const b = doc.createElement("button");
      b.type = "button";
      b.dataset.act = act;
      b.textContent = text;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.disabled = disabled;
      bar.appendChild(b);
    };
    add("bg", info.hasBg ? "🖼 Cambiar fondo" : "🖼 Imagen de fondo", "Pon una foto detrás de este bloque");
    add("up", "↑", "Subir este bloque", !info.canMoveUp);
    add("down", "↓", "Bajar este bloque", !info.canMoveDown);
    add("hide", "Ocultar", "Ocultar este bloque de la página", index === 0);
    return true;
  }

  function setActive(section: HTMLElement | null) {
    if (section === active) return;
    active?.classList.remove("fl-active");
    active = section;
    if (section && renderBar(section)) {
      section.classList.add("fl-active");
      section.appendChild(wrap);
      placeBar();
    } else {
      active = null;
      wrap.remove();
    }
  }

  const sectionOf = (t: EventTarget | null) => asElement(t)?.closest<HTMLElement>("section[data-sec]") ?? null;

  const readValue = (el: HTMLElement) => {
    const raw = MULTILINE.test(el.dataset.edit ?? "") ? el.innerText : (el.textContent ?? "");
    return raw.replace(/ /g, " ");
  };

  // Puts the caret where the person clicked (or at the end if that spot is outside the text).
  function placeCaret(el: HTMLElement, x: number, y: number) {
    const d = doc as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    let range: Range | null = null;
    if (d.caretRangeFromPoint) range = d.caretRangeFromPoint(x, y);
    else if (d.caretPositionFromPoint) {
      const pos = d.caretPositionFromPoint(x, y);
      if (pos) {
        range = doc.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (!range || !el.contains(range.startContainer)) {
      range = doc.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    const selection = win!.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function startEditing(el: HTMLElement) {
    editing = el;
    original = readValue(el);
    el.classList.add("fl-editing");
    el.setAttribute("contenteditable", "plaintext-only");
    // Browsers without plaintext-only fall back to plain contenteditable (paste is cleaned below).
    if (el.contentEditable !== "plaintext-only") el.setAttribute("contenteditable", "true");
    el.focus();
  }

  function stopEditing(el: HTMLElement) {
    el.removeAttribute("contenteditable");
    el.classList.remove("fl-editing");
  }

  async function commit(el: HTMLElement) {
    if (editing !== el) return;
    editing = null;
    stopEditing(el);
    const path = el.dataset.edit ?? "";
    const before = original;
    const value = MULTILINE.test(path) ? readValue(el).trim() : readValue(el).replace(/\s+/g, " ").trim();
    if (value === before.trim() || value === before) {
      el.textContent = before;
      return;
    }
    el.textContent = value;
    const result = await getHandlers().saveText(path, value);
    if (!result.ok) {
      el.textContent = before;
      getHandlers().notice(result.error ?? "No se pudo guardar el cambio");
    }
  }

  function cancel(el: HTMLElement) {
    if (editing !== el) return;
    editing = null;
    stopEditing(el);
    el.textContent = original;
    el.blur();
  }

  const onMouseOver = (e: MouseEvent) => {
    const section = sectionOf(e.target);
    if (section) setActive(section);
  };

  const onMouseDown = (e: MouseEvent) => {
    const t = asElement(e.target);
    if (!t || t.closest(".fl-bar-wrap")) return;
    const el = t.closest<HTMLElement>("[data-edit]");
    if (!el || el === editing) return;
    if (editing) void commit(editing);
    // The browser's own click handling would move the focus away from an element that
    // only just became editable: do the focusing ourselves.
    e.preventDefault();
    startEditing(el);
    placeCaret(el, e.clientX, e.clientY);
  };

  const onClick = (e: MouseEvent) => {
    const t = asElement(e.target);
    if (!t) return;
    const button = t.closest<HTMLElement>(".fl-bar-wrap button");
    if (button) {
      e.preventDefault();
      e.stopPropagation();
      if (!active) return;
      const index = Number(active.dataset.sec);
      const h = getHandlers();
      const act = button.dataset.act;
      if (act === "bg") h.pickImage(index, "bgImage");
      else if (act === "up") h.move(index, -1);
      else if (act === "down") h.move(index, 1);
      else if (act === "hide") h.hide(index);
      return;
    }
    // The page's own links, buttons and form must not do anything while editing.
    if (t.closest("a, summary, button, label, form")) e.preventDefault();
    const plus = t.closest(".faq-plus");
    if (plus) {
      const d = plus.closest("details");
      if (d) d.open = !d.open;
    }
    const noted = t.closest<HTMLElement>("[data-note]");
    if (noted?.dataset.note) {
      e.preventDefault();
      getHandlers().notice(noted.dataset.note);
      return;
    }
    const img = t.closest<HTMLElement>("img[data-img]");
    if (img) {
      e.preventDefault();
      getHandlers().pickImage(Number(img.dataset.img), "image");
      return;
    }
    const section = sectionOf(t);
    if (section) setActive(section);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const el = editing;
    if (!el || !isInside(el, e.target)) return;
    // Keys typed in a title inside a <summary> must not fold the answer.
    e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      cancel(el);
    } else if (e.key === "Enter") {
      const multiline = MULTILINE.test(el.dataset.edit ?? "");
      if (!multiline || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        el.blur();
      }
    }
  };

  // Space released inside a <summary> toggles it in some browsers.
  const onKeyUp = (e: KeyboardEvent) => {
    if (editing && isInside(editing, e.target)) {
      e.stopPropagation();
      if (e.key === " ") e.preventDefault();
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const el = editing;
    if (!el || !isInside(el, e.target)) return;
    e.preventDefault();
    const raw = e.clipboardData?.getData("text/plain") ?? "";
    doc.execCommand("insertText", false, MULTILINE.test(el.dataset.edit ?? "") ? raw : raw.replace(/\s+/g, " "));
  };

  const onFocusOut = (e: FocusEvent) => {
    const el = editing;
    if (el && e.target === el) void commit(el);
  };

  const onSubmit = (e: Event) => e.preventDefault();
  const onScroll = () => placeBar();

  doc.addEventListener("mouseover", onMouseOver, true);
  doc.addEventListener("mousedown", onMouseDown, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("keyup", onKeyUp, true);
  doc.addEventListener("paste", onPaste, true);
  doc.addEventListener("focusout", onFocusOut, true);
  doc.addEventListener("submit", onSubmit, true);
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", onScroll, { passive: true });

  return () => {
    doc.removeEventListener("mouseover", onMouseOver, true);
    doc.removeEventListener("mousedown", onMouseDown, true);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("keydown", onKeyDown, true);
    doc.removeEventListener("keyup", onKeyUp, true);
    doc.removeEventListener("paste", onPaste, true);
    doc.removeEventListener("focusout", onFocusOut, true);
    doc.removeEventListener("submit", onSubmit, true);
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onScroll);
    wrap.remove();
    style.remove();
  };
}
